import { app, BrowserWindow, crashReporter, Menu, nativeImage, Notification, safeStorage, Tray, ipcMain, screen } from 'electron';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppLogger } from './services/app-logger.js';
import { createPrintService } from './services/print-service.js';
import { JobStore } from './services/job-store.js';
import { isPrintJob, startJobWebSocket } from './services/job-websocket.js';
import { createSoundService, getSoundService } from './services/sound-service.js';
import { LocalGateway } from './services/local-gateway.js';
import { SettingsStore } from './services/settings-store.js';
import { CounterFeedStore } from './services/counter-feed-store.js';
import { CounterFeedSecretStore, pullCounterFeed } from './services/counter-feed-client.js';
import { CounterFeedWsClient } from './services/counter-feed-ws-client.js';
import { readCloseToTrayPreference, writeCloseToTrayPreference } from './services/window-settings.js';
import { createJobId, nextTokenNumber } from '../src/shared/services/jobIdentity.js';
import type { CustomerAppConfig, DesktopQueueJob, DesktopTrayAction } from '../src/shared/desktop-api.js';
import { isAppSettings } from '../src/shared/settings.js';
import type { PrintJob } from '../src/shared/types.js';
import type { WebContents } from 'electron';
import { isWithinWeeklyDndSchedule } from '../src/shared/services/customerPolicy.js';
import { COUNTER_ID_PATTERN } from '../src/shared/services/counterFeed.js';

const appDirectory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pdfToPrinter = require('pdf-to-printer') as typeof import('pdf-to-printer');
const developmentUrl = new URL(
  '/resources/views/desktop.html',
  process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000'
).toString();

/**
 * Every renderer window (main, settings, agent) may only ever navigate within
 * the packaged dist tree or the dev server's origin.
 */
const isAllowedNavigation = (url: string): boolean => {
  const distRoot = join(app.getAppPath(), 'dist');
  try {
    if (!app.isPackaged) return new URL(url).origin === new URL(developmentUrl).origin;
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') return false;
    const filePath = fileURLToPath(parsed);
    return filePath === distRoot || filePath.startsWith(distRoot + sep);
  } catch {
    return false;
  }
};

app.setName('Alif Shohoj Print');
const appDataDirectory = app.getPath('appData');
const userDataDirectory = join(appDataDirectory, 'AlifShohojPrint');
const legacyUserDataDirectory = join(appDataDirectory, 'BroxPrint Studio');
if (existsSync(legacyUserDataDirectory)) {
  if (existsSync(userDataDirectory)) {
    cpSync(legacyUserDataDirectory, userDataDirectory, { recursive: true, force: false, errorOnExist: false });
  } else {
    renameSync(legacyUserDataDirectory, userDataDirectory);
  }
}
app.setPath('userData', userDataDirectory);
const websocketHost = process.env.ALIF_SHOHOJ_PRINT_WS_HOST || '127.0.0.1';
const websocketPort = Number(process.env.ALIF_SHOHOJ_PRINT_WS_PORT || 43821);
const gatewayPort = Number(process.env.ALIF_SHOHOJ_PRINT_GATEWAY_PORT || 43822);
const websocketTlsCert = process.env.ALIF_SHOHOJ_PRINT_WS_TLS_CERT;
const websocketTlsKey = process.env.ALIF_SHOHOJ_PRINT_WS_TLS_KEY;
const hasWebSocketTls = Boolean(websocketTlsCert && websocketTlsKey);
// The customer gateway and the counter feed WS share one trust boundary:
// loopback by default, LAN only once TLS is configured.
const gatewayHost = hasWebSocketTls ? '0.0.0.0' : '127.0.0.1';
const isValidPort = Number.isInteger(websocketPort) && websocketPort > 0 && websocketPort <= 65535;
const crashDirectory = join(app.getPath('userData'), 'crashes');
app.setPath('crashDumps', crashDirectory);

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let agentWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let logger: AppLogger | null = null;
let jobStore: JobStore | null = null;
let settingsStore: SettingsStore | null = null;
let jobWebSocket: ReturnType<typeof startJobWebSocket> | null = null;
let counterFeedWsClient: CounterFeedWsClient | null = null;
let localGateway: LocalGateway | null = null;
let desktopPrintService: ReturnType<typeof createPrintService> | null = null;
let counterFeedStore: CounterFeedStore | null = null;
let counterFeedSecret: CounterFeedSecretStore | null = null;
let soundService: ReturnType<typeof createSoundService> | null = null;
let isQuitting = false;
let closeToTray = true;
const activePrints = new Set<string>();
let trayShopName = 'Shop';
let trayBadgeCount = 0;
let remindersTimer: NodeJS.Timeout | null = null;
const lastOrderReminderAt = new Map<string, number>();
let publishedCustomerServices: CustomerAppConfig['services'] = [];

const showWindow = (): void => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  trayBadgeCount = 0;
  updateTrayIcon();
};

const sendToDesktopWindows = (channel: string, payload: unknown): void => {
  for (const desktopWindow of [mainWindow, settingsWindow, agentWindow]) {
    if (desktopWindow && !desktopWindow.isDestroyed()) desktopWindow.webContents.send(channel, payload);
  }
};

// The queue is shared state: the agent window's console and the settings
// window both render it, so every desktop window must see each change.
const broadcastQueueJob = (queueJob: DesktopQueueJob): void => {
  sendToDesktopWindows('desktop:queue:changed', queueJob);
  updateTrayMenu();
};

const notify = (title: string, body: string): void => {
  const settings = settingsStore?.get();
  if (
    !settings ||
    !settings.notifications.windowsToastsEnabled ||
    isWithinWeeklyDndSchedule(Date.now(), settings.notifications.weeklyDndSchedule) ||
    !Notification.isSupported()
  ) return;
  new Notification({ title, body }).show();
};

const getToken = (userDataPath: string): string => {
  if (process.env.ALIF_SHOHOJ_PRINT_WS_TOKEN) return process.env.ALIF_SHOHOJ_PRINT_WS_TOKEN;
  const tokenPath = join(userDataPath, 'websocket.token');
  if (existsSync(tokenPath)) return readFileSync(tokenPath, 'utf8').trim();
  const token = randomBytes(32).toString('hex');
  writeFileSync(tokenPath, token, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return token;
};

const getConnectionHost = (): string => {
  if (websocketHost !== '0.0.0.0' && websocketHost !== '::') return websocketHost;
  for (const interfaces of Object.values(networkInterfaces())) {
    const address = interfaces?.find(item => item.family === 'IPv4' && !item.internal);
    if (address) return address.address;
  }
  return '127.0.0.1';
};

const getLanIpv4Address = (): string => {
  for (const interfaces of Object.values(networkInterfaces())) {
    const address = interfaces?.find(item => item.family === 'IPv4' && !item.internal);
    if (address) return address.address;
  }
  return '127.0.0.1';
};

const createTrayImage = (badgeCount: number) => {
  const badge = badgeCount > 0
    ? `<circle cx="25" cy="7" r="7" fill="#d13438"/><text x="25" y="10" text-anchor="middle" font-size="8" font-family="Segoe UI, sans-serif" font-weight="700" fill="#fff">${badgeCount > 9 ? '9+' : badgeCount}</text>`
    : '';
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0f766e"/><path d="M8 9h16v3H8zm2 5h12v10H10zm3 2v6h6v-6z" fill="#fff"/>${badge}</svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`);
};

const updateTrayIcon = (): void => {
  if (tray && !tray.isDestroyed()) tray.setImage(createTrayImage(trayBadgeCount));
};

const sendTrayAction = (action: 'open-dashboard' | 'show-status' | 'printer-settings' | 'shop-settings'): void => {
  showWindow();
  mainWindow?.webContents.send('desktop:tray:action', action);
};

const updateTrayMenu = (): void => {
  if (!tray || tray.isDestroyed()) return;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const queue = jobStore?.list() ?? [];
  const pendingCount = queue.filter(item =>
    item.status === 'queued' || item.status === 'printing' || item.status === 'failed'
  ).length;
  const todayPrintedCount = queue.filter(item =>
    item.status === 'completed' && item.updatedAt >= now.getTime()
  ).length;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Alif Shohoj Print', enabled: false },
    { type: 'separator' },
    { label: 'Connected', enabled: false },
    { label: `Shop: ${trayShopName}`, enabled: false },
    { type: 'separator' },
    { label: `Pending Jobs: ${pendingCount}`, enabled: false },
    { label: `Today Printed: ${todayPrintedCount}`, enabled: false },
    { type: 'separator' },
    { label: 'Open Dashboard', click: () => sendTrayAction('open-dashboard') },
    { label: 'Show Status Window', click: () => sendTrayAction('show-status') },
    { label: 'Printer Settings', click: () => sendTrayAction('printer-settings') },
    { label: 'Shop Settings', click: () => sendTrayAction('shop-settings') },
    { type: 'separator' },
    { label: 'Restart Agent', click: () => { app.relaunch(); app.quit(); } },
    { label: 'Quit', click: () => app.quit() },
  ]));
};

const markNewOrder = (): void => {
  trayBadgeCount += 1;
  updateTrayIcon();
};

const createTray = (): void => {
  tray = new Tray(createTrayImage(trayBadgeCount));
  tray.setToolTip('Alif Shohoj Print');
  updateTrayMenu();
  tray.on('double-click', showWindow);
};

interface PersistedWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
  closeToTray: boolean;
}

const DEFAULT_WINDOW_STATE: PersistedWindowState = { width: 1180, height: 780, closeToTray: true };

const windowStateFile = (): string => join(app.getPath('userData'), 'window-state.json');

/** Restore the last window size/position, dropping a position that no longer lands on a display. */
const readWindowState = (): PersistedWindowState => {
  try {
    const parsed = JSON.parse(readFileSync(windowStateFile(), 'utf8')) as Partial<PersistedWindowState>;
    const width = Number(parsed.width);
    const height = Number(parsed.height);
    const persistedCloseToTray = readCloseToTrayPreference(parsed);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 900 || height < 600) {
      return { ...DEFAULT_WINDOW_STATE, closeToTray: persistedCloseToTray };
    }
    const state: PersistedWindowState = {
      width: Math.round(width),
      height: Math.round(height),
      maximized: parsed.maximized === true,
      closeToTray: persistedCloseToTray,
    };
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const isOnScreen = screen.getAllDisplays().some(display => {
        const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = display.workArea;
        return x + 40 < displayX + displayWidth && x + state.width - 40 > displayX &&
          y + 10 < displayY + displayHeight && y + state.height - 10 > displayY;
      });
      if (isOnScreen) {
        state.x = Math.round(x);
        state.y = Math.round(y);
      }
    }
    return state;
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
};

const writeWindowState = (): boolean => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    const isMaximized = mainWindow.isMaximized();
    const bounds = isMaximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    const state: PersistedWindowState = writeCloseToTrayPreference({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: isMaximized,
    }, closeToTray);
    writeFileSync(windowStateFile(), JSON.stringify(state), 'utf8');
    return true;
  } catch (error) {
    logger?.error('Could not save the window position.', error);
    return false;
  }
};

const createWindow = async (): Promise<void> => {
  const windowState = readWindowState();
  closeToTray = windowState.closeToTray;
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    ...(windowState.x !== undefined && windowState.y !== undefined ? { x: windowState.x, y: windowState.y } : {}),
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(appDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (windowState.maximized) mainWindow.maximize();

  // Persist the size/position so the operator's layout survives a restart.
  let windowStateTimer: NodeJS.Timeout | null = null;
  const scheduleWindowStateSave = (): void => {
    if (windowStateTimer) clearTimeout(windowStateTimer);
    windowStateTimer = setTimeout(writeWindowState, 500);
  };
  mainWindow.on('resize', scheduleWindowStateSave);
  mainWindow.on('move', scheduleWindowStateSave);
  mainWindow.on('maximize', scheduleWindowStateSave);
  mainWindow.on('unmaximize', scheduleWindowStateSave);

  mainWindow.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) showWindow();
  });
  mainWindow.on('close', event => {
    writeWindowState();
    if (!isQuitting && closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger?.error('Renderer process exited unexpectedly.', undefined, { reason: details.reason, exitCode: details.exitCode });
  });

  // Security hardening: the sandboxed renderer must never be steered to a remote
  // URL, and it cannot open new windows (popups are denied outright). Auxiliary
  // windows are only ever created by the main-process IPC handler below.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logger?.info('Blocked a new-window request from the renderer.', { url });
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
    logger?.info('Blocked renderer navigation away from the app shell.', { url });
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(join(app.getAppPath(), 'dist', 'resources', 'views', 'desktop.html'));
  } else {
    await mainWindow.loadURL(developmentUrl);
  }
};

/**
 * IPC is honoured only from the app's own renderer windows: the main shell and
 * the settings/agent auxiliary windows it opens. All three run the same
 * sandboxed desktop shell, so they share the same privileges.
 */
const isTrustedDesktopSender = (sender: WebContents): boolean =>
  [mainWindow, settingsWindow, agentWindow].some(window =>
    window !== null && !window.isDestroyed() && window.webContents === sender
  );

/** The agent window's own page list, mirrored from the renderer's AgentPage. */
const AGENT_WINDOW_PAGES = new Set(['console', 'printers', 'services', 'counters', 'server']);

const registerIpcHandlers = (token: string): void => {
  ipcMain.handle('desktop:window:open-aux', (event, target: unknown, page: unknown) => {
    if (event.sender !== mainWindow?.webContents) {
      throw new Error('Only the main window can open an auxiliary window.');
    }
    if (target !== 'settings' && target !== 'agent') {
      throw new Error('Unknown auxiliary window.');
    }
    const agentPage = typeof page === 'string' && AGENT_WINDOW_PAGES.has(page) ? page : 'console';

    // Reuse the existing window instead of spawning duplicates; the agent
    // shell switches to the requested page in place.
    const existing = target === 'settings' ? settingsWindow : agentWindow;
    if (existing && !existing.isDestroyed()) {
      if (target === 'agent') existing.webContents.send('desktop:aux:navigate', { target, page: agentPage });
      existing.show();
      existing.focus();
      return;
    }

    const auxiliaryWindow = new BrowserWindow({
      width: target === 'settings' ? 1180 : 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      show: false,
      webPreferences: {
        preload: join(appDirectory, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    auxiliaryWindow.webContents.setWindowOpenHandler(({ url }) => {
      logger?.info('Blocked a new-window request from an auxiliary window.', { url });
      return { action: 'deny' };
    });
    auxiliaryWindow.webContents.on('will-navigate', (navEvent, url) => {
      if (isAllowedNavigation(url)) return;
      navEvent.preventDefault();
      logger?.info('Blocked auxiliary-window navigation away from the app shell.', { url });
    });
    // Keep the Windows taskbar able to tell the three desktop windows apart.
    auxiliaryWindow.webContents.on('page-title-updated', (titleEvent) => {
      titleEvent.preventDefault();
      auxiliaryWindow.setTitle(target === 'settings'
        ? 'Settings — Alif Shohoj Print'
        : 'Windows Agent & Drivers — Alif Shohoj Print');
    });
    auxiliaryWindow.once('ready-to-show', () => auxiliaryWindow.show());
    auxiliaryWindow.on('closed', () => {
      if (target === 'settings') settingsWindow = null;
      else agentWindow = null;
    });

    if (target === 'settings') settingsWindow = auxiliaryWindow;
    else agentWindow = auxiliaryWindow;
    logger?.info('Opened an auxiliary window.', { target, page: agentPage });

    if (app.isPackaged) {
      void auxiliaryWindow.loadFile(join(app.getAppPath(), 'dist', 'resources', 'views', 'desktop.html'), {
        search: `window=${target}${target === 'agent' ? `&page=${agentPage}` : ''}`,
      });
    } else {
      void auxiliaryWindow.loadURL(
        `${developmentUrl}?window=${target}${target === 'agent' ? `&page=${agentPage}` : ''}`
      );
    }
  });
  ipcMain.handle('desktop:settings:get', (event) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can read application settings.');
    if (!settingsStore) throw new Error('The application settings store is not ready.');
    return settingsStore.get();
  });
  ipcMain.handle('desktop:settings:save', (event, settings: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can update application settings.');
    if (!isAppSettings(settings)) throw new Error('A complete, valid application settings object is required.');
    if (!settingsStore) throw new Error('The application settings store is not ready.');
    const saved = settingsStore.save(settings);
    soundService?.setVolume(saved.notifications.soundVolume);
    soundService?.setSoundAlertEnabled(saved.notifications.soundEnabled);
    soundService?.setToastSoundEnabled(saved.notifications.windowsToastsEnabled);
    // The saving window already holds the new values; the other desktop
    // windows must adopt them without a reload.
    for (const desktopWindow of [mainWindow, settingsWindow, agentWindow]) {
      if (desktopWindow && !desktopWindow.isDestroyed() && desktopWindow.webContents !== event.sender) {
        desktopWindow.webContents.send('desktop:settings:changed', saved);
      }
    }
    return saved;
  });
  ipcMain.handle('desktop:tray:set-shop-name', (event, name: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can update tray details.');
    if (typeof name !== 'string' || name.length > 200) throw new Error('A valid shop name is required.');
    const normalizedName = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
    if (!normalizedName) throw new Error('The shop name cannot be empty.');
    trayShopName = normalizedName;
    updateTrayMenu();
  });
  ipcMain.handle('desktop:auto-launch:get', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('desktop:auto-launch:set', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('Auto-start setting must be a boolean.');
    if (process.platform !== 'win32') throw new Error('Windows login startup is only available in the Windows desktop app.');
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: ['--hidden'] });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('desktop:window:close-to-tray:get', () => closeToTray);
  ipcMain.handle('desktop:window:close-to-tray:set', (event, enabled: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can update window settings.');
    if (typeof enabled !== 'boolean') throw new Error('Close-to-tray setting must be a boolean.');
    const previousValue = closeToTray;
    closeToTray = enabled;
    if (!writeWindowState()) {
      closeToTray = previousValue;
      return false;
    }
    return closeToTray;
  });
  ipcMain.handle('desktop:websocket:info', () => ({
    url: `${hasWebSocketTls ? 'wss' : 'ws'}://${getConnectionHost()}:${websocketPort}`,
    host: websocketHost,
    port: websocketPort,
    token,
    secure: hasWebSocketTls,
  }));
  ipcMain.handle('desktop:customer-pwa:url', () => {
    if (app.isPackaged && !hasWebSocketTls) return null;
    const protocol = app.isPackaged ? 'https' : 'http';
    const port = app.isPackaged ? gatewayPort : 3000;
    return `${protocol}://${getLanIpv4Address()}:${port}/resources/views/pwa.html`;
  });
  ipcMain.handle('desktop:customer-pwa:publish-config', (event, config: CustomerAppConfig) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can publish customer settings.');
    if (!config || !Array.isArray(config.counters) || !Array.isArray(config.services)) {
      throw new Error('Invalid customer app configuration.');
    }
    const settings = settingsStore?.get();
    if (!settings) throw new Error('The application settings store is not ready.');
    publishedCustomerServices = config.services;
    localGateway?.publishCustomerConfig({
      ...config,
      operationalPolicy: {
        businessHours: settings.businessHours,
        orderLimits: settings.orderLimits,
        previewWatermarkEnabled: settings.previewWatermarkEnabled,
      },
    });
  });
  ipcMain.handle('desktop:printer:notify-status', (event, printerName: unknown, isOnline: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can report printer status.');
    if (typeof printerName !== 'string' || printerName.length < 1 || printerName.length > 256 || typeof isOnline !== 'boolean') {
      throw new Error('A valid printer name and status are required.');
    }
    const settings = settingsStore?.get();
    if (!settings || !settings.printer.alerts.offline) return;
    notify('Printer status', `${printerName} is offline.`);
    if (settings.notifications.soundEnabled &&
      !isWithinWeeklyDndSchedule(Date.now(), settings.notifications.weeklyDndSchedule)) {
      void soundService?.play('S05');
    }
  });
  ipcMain.handle('desktop:counters:get-statuses', (_event, counterIds: unknown) => {
    if (!Array.isArray(counterIds) || counterIds.some(id => typeof id !== 'string')) return [];
    return localGateway?.getCounterStatuses(counterIds as string[]) ?? [];
  });
  ipcMain.handle('desktop:counter:heartbeat:send', async (_event, masterUrl: unknown, counterId: unknown) => {
    if (typeof masterUrl !== 'string' || typeof counterId !== 'string' || !/^CTR-[A-Z0-9-]{1,32}$/i.test(counterId)) {
      throw new Error('A valid master URL and counter ID are required.');
    }
    let endpoint: URL;
    try {
      endpoint = new URL('/api/counter-heartbeat', masterUrl);
    } catch {
      throw new Error('The master PC URL is invalid.');
    }
    const configuredUrl = new URL(masterUrl);
    if (configuredUrl.username || configuredUrl.password || configuredUrl.search || configuredUrl.hash) {
      throw new Error('The master PC URL must not contain credentials or query parameters.');
    }
    if (endpoint.protocol !== 'https:' && !( !app.isPackaged && endpoint.protocol === 'http:')) {
      throw new Error('Counter heartbeat requires HTTPS on installed Windows PCs.');
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counterId }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  });
  ipcMain.handle('desktop:counters:feed-key:get', (event, counterId: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can read a counter feed key.');
    if (typeof counterId !== 'string' || !COUNTER_ID_PATTERN.test(counterId)) {
      throw new Error('A valid counter ID is required.');
    }
    return counterFeedStore?.getKey(counterId) ?? null;
  });
  ipcMain.handle('desktop:counters:feed-key:rotate', (event, counterId: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can issue a counter feed key.');
    if (typeof counterId !== 'string' || !COUNTER_ID_PATTERN.test(counterId)) {
      throw new Error('A valid counter ID is required.');
    }
    if (!counterFeedStore) throw new Error('The counter feed key store is not ready.');
    const key = counterFeedStore.rotateKey(counterId);
    logger?.info('A new counter feed key was issued.', { counterId });
    return key;
  });
  ipcMain.handle('desktop:counters:feed-key:revoke', (event, counterId: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can revoke a counter feed key.');
    if (typeof counterId !== 'string' || !COUNTER_ID_PATTERN.test(counterId)) {
      throw new Error('A valid counter ID is required.');
    }
    if (!counterFeedStore) throw new Error('The counter feed key store is not ready.');
    counterFeedStore.revokeKey(counterId);
    logger?.info('A counter feed key was revoked.', { counterId });
  });
  ipcMain.handle('desktop:counter:feed:status', () => ({
    hasKey: counterFeedSecret?.has() ?? false,
    protected: counterFeedSecret?.isProtected() ?? false,
  }));
  ipcMain.handle('desktop:counter:feed:secret:set', (event, key: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can pair this counter PC.');
    if (typeof key !== 'string') throw new Error('A valid counter feed key is required.');
    if (!counterFeedSecret) throw new Error('The counter feed key store is not ready.');
    counterFeedSecret.set(key);
    logger?.info('This PC was paired with a master counter feed key.');
    return { hasKey: true, protected: counterFeedSecret.isProtected() };
  });
  ipcMain.handle('desktop:counter:feed:secret:clear', (event) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can unpair this counter PC.');
    counterFeedSecret?.clear();
    counterFeedWsClient?.disconnect();
    counterFeedWsClient = null;
    return { hasKey: false, protected: false };
  });
  ipcMain.handle('desktop:counter:feed:ws:start', (event, masterUrl: unknown, counterId: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can manage counter feed.');
    if (typeof masterUrl !== 'string' || typeof counterId !== 'string' || !COUNTER_ID_PATTERN.test(counterId)) {
      throw new Error('A valid master URL and counter ID are required.');
    }
    const key = counterFeedSecret?.read();
    if (!key) throw new Error('This counter PC is not paired with the master PC yet.');
    counterFeedWsClient?.disconnect();
    counterFeedWsClient = new CounterFeedWsClient({
      masterUrl,
      counterId,
      key,
      allowInsecureHttp: !app.isPackaged,
      onUpdate: (orders, serverTime) => {
        mainWindow?.webContents.send('desktop:counter:feed:update', { orders, serverTime });
      },
      onError: error => logger?.error('Counter feed WebSocket client error.', error),
    });
    counterFeedWsClient.connect();
    return { ok: true };
  });
  ipcMain.handle('desktop:counter:feed:ws:stop', (event) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can manage counter feed.');
    counterFeedWsClient?.disconnect();
    counterFeedWsClient = null;
    return { ok: true };
  });
  ipcMain.handle('desktop:counter:feed:pull', async (event, masterUrl: unknown, counterId: unknown, since: unknown) => {
    if (!isTrustedDesktopSender(event.sender)) throw new Error('Only the desktop window can read the counter order feed.');
    if (typeof masterUrl !== 'string' || typeof counterId !== 'string' || !COUNTER_ID_PATTERN.test(counterId)) {
      throw new Error('A valid master URL and counter ID are required.');
    }
    const key = counterFeedSecret?.read();
    if (!key) throw new Error('This counter PC is not paired with the master PC yet.');
    const result = await pullCounterFeed({
      masterUrl,
      counterId,
      key,
      since: typeof since === 'number' && Number.isFinite(since) ? since : 0,
      allowInsecureHttp: !app.isPackaged,
    });
    if (!result.ok) throw new Error(result.error);
    return { orders: result.orders, serverTime: result.serverTime };
  });
  ipcMain.handle('desktop:printers:list', async () => {
    return (await pdfToPrinter.getPrinters()).map(printer => printer.name);
  });
  ipcMain.handle('desktop:queue:list', () => jobStore?.list() ?? []);
  ipcMain.handle('desktop:queue:remove-job', (_event, jobId: unknown) => {
    if (typeof jobId !== 'string' || !jobId) throw new Error('A valid print job ID is required.');
    if (!jobStore) throw new Error('The desktop print queue is not ready.');
    if (activePrints.has(jobId)) {
      throw new Error(`Print job ${jobId} is currently printing and cannot be removed.`);
    }
    jobStore.remove(jobId);
  });
  ipcMain.handle('desktop:queue:save-job', (_event, job: unknown) => {
    // Same full-shape validation as the WebSocket path so a compromised renderer
    // cannot enqueue a job the WS endpoint would have rejected.
    if (!isPrintJob(job)) throw new Error('Invalid print job payload.');
    const saved = jobStore?.enqueue(job);
    if (!saved) throw new Error('The desktop print queue is not ready.');
    broadcastQueueJob(saved);
  });
  ipcMain.handle('desktop:print:job', async (_event, jobId: unknown) => {
    if (typeof jobId !== 'string' || !jobId) throw new Error('A valid print job ID is required.');
    if (!jobStore || !desktopPrintService) throw new Error('The desktop print service is not ready.');
    if (activePrints.has(jobId)) throw new Error(`Print job ${jobId} is already being processed.`);

    const queueJob = jobStore.get(jobId);
    if (!queueJob) throw new Error(`Print job ${jobId} was not found in the local queue.`);
    if (queueJob.status === 'completed') throw new Error(`Print job ${jobId} has already completed.`);
    activePrints.add(jobId);
    try {
      const availablePrinters = await pdfToPrinter.getPrinters();
      if (!availablePrinters.some(printer => printer.name === queueJob.job.targetPrinterName)) {
        throw new Error(`Windows printer "${queueJob.job.targetPrinterName}" is not installed or available.`);
      }
      broadcastQueueJob(jobStore.markPrinting(jobId));
      await desktopPrintService.print(queueJob.job);
      const completed = jobStore.markCompleted(jobId);
      broadcastQueueJob(completed);
      notify(`Print complete: #${queueJob.job.tokenCode}`, `${queueJob.job.targetPrinterName} finished the print job.`);
      logger?.info('Print job completed.', { jobId });
    } catch (error) {
      const failed = jobStore.markFailed(jobId, error instanceof Error ? error.message : String(error));
      broadcastQueueJob(failed);
      notify(`Print failed: #${queueJob.job.tokenCode}`, failed.error || 'The Windows spooler could not print this job.');
      logger?.error('Print job failed.', error, { jobId });
      throw error;
    } finally {
      activePrints.delete(jobId);
    }
  });
  
  // Sound Service IPC Handlers
  ipcMain.handle('desktop:sound:play', (_event, soundId: string) => {
    const validSounds = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
    if (!validSounds.includes(soundId)) throw new Error('Invalid sound ID');
    return soundService?.play(soundId as any) ?? false;
  });
  ipcMain.handle('desktop:sound:set-volume', (_event, volume: number) => {
    soundService?.setVolume(volume);    return true;
  });
  ipcMain.handle('desktop:sound:set-alert-enabled', (_event, enabled: boolean) => {
    soundService?.setSoundAlertEnabled(enabled);    return true;
  });
  ipcMain.handle('desktop:sound:set-toast-enabled', (_event, enabled: boolean) => {
    soundService?.setToastSoundEnabled(enabled);    return true;
  });
  ipcMain.handle('desktop:sound:set-dnd', (_event, enabled: boolean) => {
    soundService?.setDndMode(enabled);    return true;
  });
  ipcMain.handle('desktop:sound:get-config', () => ({
    volume: 70,
    soundAlertEnabled: true,
    toastSoundEnabled: true,
    isDndMode: false,
  }));
  
  // File dialog for Studio - open local image file
  ipcMain.handle('desktop:dialog:open-file', async (_event, options: { filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] } = {}) => {
    if (!mainWindow) throw new Error('Main window not available.');
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: options.filters || [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: options.properties || ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    // Read file and return as base64 data URL for renderer
    const { readFileSync } = require('node:fs');
    const fileBuffer = readFileSync(filePath);
    const mimeType = filePath.toLowerCase().endsWith('.png') ? 'image/png' :
                     filePath.toLowerCase().endsWith('.webp') ? 'image/webp' :
                     filePath.toLowerCase().endsWith('.bmp') ? 'image/bmp' :
                     filePath.toLowerCase().endsWith('.tiff') ? 'image/tiff' : 'image/jpeg';
    const base64 = fileBuffer.toString('base64');
    return { filePath, dataUrl: `data:${mimeType};base64,${base64}`, fileName: filePath.split(/[\\/]/).pop() };
  });
};

const startDesktopServices = (): void => {
  if (!isValidPort) throw new Error('ALIF_SHOHOJ_PRINT_WS_PORT must be an integer from 1 to 65535.');
  if (!Number.isInteger(gatewayPort) || gatewayPort < 1 || gatewayPort > 65535) {
    throw new Error('ALIF_SHOHOJ_PRINT_GATEWAY_PORT must be an integer from 1 to 65535.');
  }
  if (Boolean(websocketTlsCert) !== Boolean(websocketTlsKey)) {
    throw new Error('Set both ALIF_SHOHOJ_PRINT_WS_TLS_CERT and ALIF_SHOHOJ_PRINT_WS_TLS_KEY to enable WSS.');
  }
  const userDataPath = app.getPath('userData');
  logger = new AppLogger(userDataPath);
  jobStore = new JobStore(join(userDataPath, 'print-queue.sqlite'));
  settingsStore = new SettingsStore(join(userDataPath, 'settings.sqlite'));
  const initialSettings = settingsStore.get();
  desktopPrintService = createPrintService(userDataPath);

  // The master PC hands each counter PC its own feed key; the counter PC keeps
  // only its own key, encrypted with the OS keychain when that is available.
  try {
    counterFeedStore = new CounterFeedStore(userDataPath);
  } catch (error) {
    counterFeedStore = null;
    logger.error('Counter feed keys could not be loaded; counters must be re-paired.', error);
  }
  if (safeStorage.isEncryptionAvailable()) {
    counterFeedSecret = new CounterFeedSecretStore(userDataPath, {
      encrypt: value => safeStorage.encryptString(value).toString('base64'),
      decrypt: value => safeStorage.decryptString(Buffer.from(value, 'base64')),
    });
  } else {
    counterFeedSecret = new CounterFeedSecretStore(userDataPath);
    logger.info('OS encryption is unavailable; the counter feed key is stored in a protected plain file.');
  }

  localGateway = new LocalGateway({
    port: gatewayPort,
    webRoot: join(app.getAppPath(), 'dist'),
    ...(hasWebSocketTls && websocketTlsCert && websocketTlsKey
      ? { tls: { certPath: websocketTlsCert, keyPath: websocketTlsKey } }
      : {}),
    onCustomerOrder: incomingJob => {
      const currentJobs = jobStore?.list() ?? [];
      const nextToken = nextTokenNumber(currentJobs.map(queueJob => queueJob.job.tokenCode), 0);
      const now = Date.now();
      const targetCounter = localGateway?.getCounterStatuses([incomingJob.counterId || ''])[0];
      const isCounterOffline = !targetCounter?.online;
      const settings = settingsStore?.get();
      if (!settings) throw new Error('The application settings store is not ready.');
      const serviceAutoApproves = publishedCustomerServices.some(service =>
        service.id === incomingJob.serviceType && service.autoApprove
      );
      const isAutoApproved = serviceAutoApproves &&
        !settings.approvals.manualApprovalRequired &&
        !isCounterOffline;
      const acceptedJob: PrintJob = {
        ...incomingJob,
        id: createJobId(),
        tokenCode: String(nextToken),
        createdAt: now,
        status: isAutoApproved ? 'approved' : 'queued',
        auditLogs: [
          ...(Array.isArray(incomingJob.auditLogs)
            ? incomingJob.auditLogs.filter(entry => entry.action !== 'service_auto_approved')
            : []),
          {
            id: `log_${now}_master_receive`,
            timestamp: now,
            actor: 'system',
            action: 'master_received_customer_order',
            details: `Master PC received the customer order for ${incomingJob.counterName || incomingJob.counterId}.`,
          },
          ...(isAutoApproved ? [{
            id: `log_${now}_service_auto_approved`,
            timestamp: now,
            actor: 'system' as const,
            action: 'service_auto_approved',
            details: 'Per-service automatic approval was allowed by the master settings.',
          }] : []),
          ...(isCounterOffline ? [{
            id: `log_${now}_counter_offline`,
            timestamp: now,
            actor: 'system' as const,
            action: 'counter_offline_master_review',
            details: `${incomingJob.counterName || incomingJob.counterId} did not send a recent heartbeat; the order is waiting for master review.`,
          }] : []),
        ],
      };
      const queueJob = jobStore?.enqueue(acceptedJob);
      if (!queueJob) throw new Error('The master print queue is not ready.');
      broadcastQueueJob(queueJob);
      // Every window shows the new-order toast; only the main window plays
      // the chime so a three-window setup sounds it once.
      sendToDesktopWindows('desktop:job:incoming', acceptedJob);
      markNewOrder();
      const paymentLabel = acceptedJob.paymentStatus === 'unpaid' ? 'Counter cash' : 'Paid';
      notify(
        app.getName(),
        `নতুন অর্ডার #${acceptedJob.tokenCode}: ${acceptedJob.serviceLabelBn}, ${acceptedJob.paperSize} × ${acceptedJob.copies} · ${acceptedJob.targetPrinterName} · ৳${acceptedJob.priceBDT} · ${paymentLabel}`
      );
      if (
        settings.notifications.soundEnabled &&
        !isWithinWeeklyDndSchedule(Date.now(), settings.notifications.weeklyDndSchedule)
      ) void soundService?.playNewOrder();
      if (acceptedJob.counterId) localGateway?.pushCounterFeedUpdate(acceptedJob.counterId);
      logger?.info('Customer PWA order persisted on the master PC.', { jobId: acceptedJob.id, counterId: acceptedJob.counterId });
      return acceptedJob;
    },
    onCounterHeartbeat: (counterId, online) => {
      mainWindow?.webContents.send('desktop:counter:heartbeat', { counterId, online, lastSeenAt: online ? Date.now() : null });
    },
    onError: error => logger?.error('Customer PWA gateway error.', error),
    getPendingOrderCount: () => (jobStore?.list() ?? []).filter(queueJob =>
      queueJob.status === 'queued' || queueJob.status === 'printing' || queueJob.status === 'failed'
    ).length,
    verifyCounterFeedKey: (counterId, key) => counterFeedStore?.verify(counterId, key) ?? false,
    getCounterFeedOrders: counterId => (jobStore?.list() ?? [])
      .filter(queueJob => queueJob.job.counterId === counterId)
      .map(queueJob => queueJob.job),
    onCounterFeedWsAuth: (counterId) => {
      logger?.info('Counter PC authenticated for real-time feed.', { counterId });
    },
  });
  localGateway.listen();
  localGateway.onListening(() => logger?.info('Customer PWA gateway is listening.', { port: gatewayPort, tls: hasWebSocketTls }));

  // The counter feed WebSocket is now integrated into LocalGateway on the same port.
  // Log when a counter PC authenticates via WebSocket for real-time updates.
  // (The LocalGateway internally handles the WebSocket upgrade and auth.)
  
  // Initialize SoundService
  soundService = createSoundService(logger, {
    volume: initialSettings.notifications.soundVolume,
    soundAlertEnabled: initialSettings.notifications.soundEnabled,
    toastSoundEnabled: initialSettings.notifications.windowsToastsEnabled,
    isDndMode: false,
    resourcesPath: join(process.resourcesPath || app.getAppPath(), 'resources'),
  });
  void soundService.initialize();
  
  const token = getToken(userDataPath);
  jobWebSocket = startJobWebSocket({
    host: websocketHost,
    port: websocketPort,
    token,
    ...(hasWebSocketTls && websocketTlsCert && websocketTlsKey
      ? { tls: { certPath: websocketTlsCert, keyPath: websocketTlsKey } }
      : {}),
    store: jobStore,
    onIncomingJob: queueJob => {
      broadcastQueueJob(queueJob);
      sendToDesktopWindows('desktop:job:incoming', queueJob.job);
      markNewOrder();
      const paymentLabel = queueJob.job.paymentStatus === 'unpaid' ? 'Counter cash' : 'Paid';
      notify(
        app.getName(),
        `নতুন অর্ডার #${queueJob.job.tokenCode}: ${queueJob.job.serviceLabelBn}, ${queueJob.job.paperSize} × ${queueJob.job.copies} · ${queueJob.job.targetPrinterName} · ৳${queueJob.job.priceBDT} · ${paymentLabel}`
      );
      logger?.info('WebSocket job persisted.', { jobId: queueJob.job.id });
      const settings = settingsStore?.get();
      if (settings?.notifications.soundEnabled &&
        !isWithinWeeklyDndSchedule(Date.now(), settings.notifications.weeklyDndSchedule)) {
        void soundService?.playNewOrder();
      }
    },
  });
  jobWebSocket.on('listening', () => {
    logger?.info('Authenticated local WebSocket is listening.', { host: websocketHost, port: websocketPort });
  });
  jobWebSocket.on('error', error => logger?.error('WebSocket service error.', error));
  registerIpcHandlers(token);
  logger.info('Desktop services initialized.', { platform: process.platform, version: app.getVersion() });
  
  // Periodic checks for printer status and pending jobs
  remindersTimer = setInterval(() => {
    if (!jobStore || !soundService || !settingsStore) return;
    const settings = settingsStore.get();
    const now = Date.now();
    const jobs = jobStore.list();
    for (const queueJob of jobs) {
      if (queueJob.status === 'completed' || queueJob.job.status === 'rejected') {
        lastOrderReminderAt.delete(queueJob.job.id);
        continue;
      }
      if (!settings.notifications.orderRemindersEnabled) continue;
      const threshold = settings.approvals.reminderAfterMinutes * 60_000;
      const interval = settings.notifications.orderReminderIntervalMinutes * 60_000;
      const lastReminder = lastOrderReminderAt.get(queueJob.job.id);
      const due = now - queueJob.job.createdAt >= threshold &&
        (lastReminder === undefined || now - lastReminder >= interval);
      if (!due) continue;
      lastOrderReminderAt.set(queueJob.job.id, now);
      const inDnd = isWithinWeeklyDndSchedule(now, settings.notifications.weeklyDndSchedule);
      if (!inDnd && settings.notifications.windowsToastsEnabled) {
        notify(`Pending order #${queueJob.job.tokenCode}`, 'An order is still waiting for shop attention.');
      }
      if (!inDnd && settings.notifications.soundEnabled) void soundService.playPendingReminder();
    }
    jobStore.purgeExpiredCompleted(now, settings.retention.completedMinutes);
  }, 15_000);
};

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => {
    isQuitting = true;
    jobWebSocket?.close();
    counterFeedWsClient?.disconnect();
    localGateway?.close();
    jobStore?.close();
    settingsStore?.close();
    soundService?.destroy();
    if (remindersTimer) clearInterval(remindersTimer);
    tray?.destroy();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.alifshohoj.print');
    crashReporter.start({
      uploadToServer: false,
      submitURL: '',
      compress: true,
    });
    startDesktopServices();
    createTray();
    await createWindow();
    for (const queueJob of jobStore?.list() ?? []) broadcastQueueJob(queueJob);
  }).catch(error => {
    logger?.error('Could not initialize ALIF SHOHOJ PRINT desktop services.', error);
    app.quit();
  });

  process.on('uncaughtException', error => {
    logger?.error('Uncaught main-process exception.', error);
    app.exit(1);
  });
  process.on('unhandledRejection', reason => {
    logger?.error('Unhandled main-process rejection.', reason);
  });
}
