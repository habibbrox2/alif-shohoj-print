import { app, BrowserWindow, crashReporter, Menu, nativeImage, Notification, Tray, ipcMain, screen } from 'electron';
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
import { createJobId, nextTokenNumber } from '../src/shared/services/jobIdentity.js';
import type { CustomerAppConfig, DesktopQueueJob } from '../src/shared/desktop-api.js';
import type { PrintJob } from '../src/shared/types.js';

const appDirectory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pdfToPrinter = require('pdf-to-printer') as typeof import('pdf-to-printer');
const developmentUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
app.setName('ALIF SHOHOJ PRINT');
const appDataDirectory = app.getPath('appData');
const userDataDirectory = join(appDataDirectory, 'ALIF SHOHOJ PRINT');
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
const isValidPort = Number.isInteger(websocketPort) && websocketPort > 0 && websocketPort <= 65535;
const crashDirectory = join(app.getPath('userData'), 'crashes');
app.setPath('crashDumps', crashDirectory);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let logger: AppLogger | null = null;
let jobStore: JobStore | null = null;
let jobWebSocket: ReturnType<typeof startJobWebSocket> | null = null;
let localGateway: LocalGateway | null = null;
let desktopPrintService: ReturnType<typeof createPrintService> | null = null;
let soundService: ReturnType<typeof createSoundService> | null = null;
let isQuitting = false;
const activePrints = new Set<string>();

const showWindow = (): void => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const broadcastQueueJob = (queueJob: DesktopQueueJob): void => {
  mainWindow?.webContents.send('desktop:queue:changed', queueJob);
};

const notify = (title: string, body: string): void => {
  if (!Notification.isSupported()) return;
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

const createTray = (): void => {
  const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#059669"/><path d="M8 9h16v3H8zm2 5h12v10H10zm3 2v6h6v-6z" fill="#fff"/></svg>';
  const trayImage = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`);
  tray = new Tray(trayImage);
  tray.setToolTip('ALIF SHOHOJ PRINT');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Shop POS', click: showWindow },
    { type: 'separator' },
    {
      label: 'Exit ALIF SHOHOJ PRINT',
      click: () => app.quit(),
    },
  ]));
  tray.on('double-click', showWindow);
};

interface PersistedWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

const DEFAULT_WINDOW_STATE: PersistedWindowState = { width: 1180, height: 780 };

const windowStateFile = (): string => join(app.getPath('userData'), 'window-state.json');

/** Restore the last window size/position, dropping a position that no longer lands on a display. */
const readWindowState = (): PersistedWindowState => {
  try {
    const parsed = JSON.parse(readFileSync(windowStateFile(), 'utf8')) as Partial<PersistedWindowState>;
    const width = Number(parsed.width);
    const height = Number(parsed.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 900 || height < 600) {
      return DEFAULT_WINDOW_STATE;
    }
    const state: PersistedWindowState = {
      width: Math.round(width),
      height: Math.round(height),
      maximized: parsed.maximized === true,
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

const writeWindowState = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const isMaximized = mainWindow.isMaximized();
    const bounds = isMaximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    const state: PersistedWindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: isMaximized,
    };
    writeFileSync(windowStateFile(), JSON.stringify(state), 'utf8');
  } catch (error) {
    logger?.error('Could not save the window position.', error);
  }
};

const createWindow = async (): Promise<void> => {
  const windowState = readWindowState();
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
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger?.error('Renderer process exited unexpectedly.', undefined, { reason: details.reason, exitCode: details.exitCode });
  });

  // Security hardening: the sandboxed renderer must never be steered to a remote
  // URL, and it cannot open new windows (popups are denied outright).
  const distRoot = join(app.getAppPath(), 'dist');
  const isAllowedNavigation = (url: string): boolean => {
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
    await mainWindow.loadFile(join(app.getAppPath(), 'dist', 'desktop.html'));
  } else {
    await mainWindow.loadURL(developmentUrl);
  }
};

const registerIpcHandlers = (token: string): void => {
  ipcMain.handle('desktop:auto-launch:get', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('desktop:auto-launch:set', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('Auto-start setting must be a boolean.');
    if (process.platform !== 'win32') throw new Error('Windows login startup is only available in the Windows desktop app.');
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: ['--hidden'] });
    return app.getLoginItemSettings().openAtLogin;
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
    return `${protocol}://${getLanIpv4Address()}:${port}/pwa.html`;
  });
  ipcMain.handle('desktop:customer-pwa:publish-config', (_event, config: CustomerAppConfig) => {
    if (!config || !Array.isArray(config.counters) || !Array.isArray(config.services)) {
      throw new Error('Invalid customer app configuration.');
    }
    localGateway?.publishCustomerConfig(config);
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
  desktopPrintService = createPrintService(userDataPath);

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
      const acceptedJob: PrintJob = {
        ...incomingJob,
        id: createJobId(),
        tokenCode: String(nextToken),
        createdAt: now,
        status: 'queued',
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
      mainWindow?.webContents.send('desktop:job:incoming', acceptedJob);
      notify(`New order for ${acceptedJob.counterName || acceptedJob.counterId}${isCounterOffline ? ' (offline)' : ''}`, `${acceptedJob.serviceLabelBn} · ${acceptedJob.copies} copies`);
      logger?.info('Customer PWA order persisted on the master PC.', { jobId: acceptedJob.id, counterId: acceptedJob.counterId });
      return acceptedJob;
    },
    onCounterHeartbeat: (counterId, online) => {
      mainWindow?.webContents.send('desktop:counter:heartbeat', { counterId, online, lastSeenAt: online ? Date.now() : null });
    },
    onError: error => logger?.error('Customer PWA gateway error.', error),
  });
  localGateway.listen();
  localGateway.onListening(() => logger?.info('Customer PWA gateway is listening.', { port: gatewayPort, tls: hasWebSocketTls }));
  
  // Initialize SoundService
  soundService = createSoundService(logger, {
    volume: 70,    soundAlertEnabled: true,    toastSoundEnabled: true,    isDndMode: false,    resourcesPath: join(process.resourcesPath || app.getAppPath(), 'resources'),  });  soundService.initialize();
  
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
      mainWindow?.webContents.send('desktop:job:incoming', queueJob.job);      notify(`New print job: #${queueJob.job.tokenCode}`, `${queueJob.job.serviceLabelBn} · ${queueJob.job.copies} copies`);
      logger?.info('WebSocket job persisted.', { jobId: queueJob.job.id });
      
      // Play new order sound (S01)      soundService?.playNewOrder();
    },
  });
  jobWebSocket.on('listening', () => {
    logger?.info('Authenticated local WebSocket is listening.', { host: websocketHost, port: websocketPort });
  });
  jobWebSocket.on('error', error => logger?.error('WebSocket service error.', error));
  registerIpcHandlers(token);
  logger.info('Desktop services initialized.', { platform: process.platform, version: app.getVersion() });
  
  // Periodic checks for printer status and pending jobs
  setInterval(() => {
    if (!jobStore || !soundService) return;
    const jobs = jobStore.list();
    const pendingJobs = jobs.filter(job => job.job.status === 'queued' || job.job.status === 'approved');
    const hasOldPending = pendingJobs.some(job => Date.now() - job.job.createdAt > 2 * 60 * 1000);
    if (hasOldPending) soundService.playPendingReminder();
  }, 60_000);
};

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => {
    isQuitting = true;
    jobWebSocket?.close();
    localGateway?.close();
    jobStore?.close();
    soundService?.destroy();
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
