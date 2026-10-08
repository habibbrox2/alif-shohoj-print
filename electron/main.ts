import { app, BrowserWindow, crashReporter, Menu, nativeImage, Notification, Tray, ipcMain } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppLogger } from './services/app-logger.js';
import { createPrintService } from './services/print-service.js';
import { JobStore } from './services/job-store.js';
import { startJobWebSocket } from './services/job-websocket.js';
import type { PrintJob } from '../src/shared/types.js';
import type { DesktopQueueJob } from '../src/shared/desktop-api.js';

const appDirectory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pdfToPrinter = require('pdf-to-printer') as typeof import('pdf-to-printer');
const developmentUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
app.setName('ALIF SHOHOJ PRINT');
app.setPath('userData', join(app.getPath('appData'), 'BroxPrint Studio'));
const websocketHost = process.env.BROXPRINT_WS_HOST || '127.0.0.1';
const websocketPort = Number(process.env.BROXPRINT_WS_PORT || 43821);
const websocketTlsCert = process.env.BROXPRINT_WS_TLS_CERT;
const websocketTlsKey = process.env.BROXPRINT_WS_TLS_KEY;
const hasWebSocketTls = Boolean(websocketTlsCert && websocketTlsKey);
const isValidPort = Number.isInteger(websocketPort) && websocketPort > 0 && websocketPort <= 65535;
const crashDirectory = join(app.getPath('userData'), 'crashes');
app.setPath('crashDumps', crashDirectory);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let logger: AppLogger | null = null;
let jobStore: JobStore | null = null;
let jobWebSocket: ReturnType<typeof startJobWebSocket> | null = null;
let desktopPrintService: ReturnType<typeof createPrintService> | null = null;
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
  if (process.env.BROXPRINT_WS_TOKEN) return process.env.BROXPRINT_WS_TOKEN;
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

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: join(appDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) showWindow();
  });
  mainWindow.on('close', event => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger?.error('Renderer process exited unexpectedly.', undefined, { reason: details.reason, exitCode: details.exitCode });
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(join(app.getAppPath(), 'dist', 'index.html'));
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
  ipcMain.handle('desktop:printers:list', async () => {
    return (await pdfToPrinter.getPrinters()).map(printer => printer.name);
  });
  ipcMain.handle('desktop:queue:list', () => jobStore?.list() ?? []);
  ipcMain.handle('desktop:queue:save-job', (_event, job: unknown) => {
    if (!job || typeof job !== 'object' || !('id' in job) || typeof job.id !== 'string') {
      throw new Error('Invalid print job.');
    }
    const saved = jobStore?.enqueue(job as PrintJob);
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
};

const startDesktopServices = (): void => {
  if (!isValidPort) throw new Error('BROXPRINT_WS_PORT must be an integer from 1 to 65535.');
  if (Boolean(websocketTlsCert) !== Boolean(websocketTlsKey)) {
    throw new Error('Set both BROXPRINT_WS_TLS_CERT and BROXPRINT_WS_TLS_KEY to enable WSS.');
  }
  const userDataPath = app.getPath('userData');
  logger = new AppLogger(userDataPath);
  jobStore = new JobStore(join(userDataPath, 'print-queue.sqlite'));
  desktopPrintService = createPrintService(userDataPath);
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
      mainWindow?.webContents.send('desktop:job:incoming', queueJob.job);
      notify(`New print job: #${queueJob.job.tokenCode}`, `${queueJob.job.serviceLabelBn} · ${queueJob.job.copies} copies`);
      logger?.info('WebSocket job persisted.', { jobId: queueJob.job.id });
    },
  });
  jobWebSocket.on('listening', () => {
    logger?.info('Authenticated local WebSocket is listening.', { host: websocketHost, port: websocketPort });
  });
  jobWebSocket.on('error', error => logger?.error('WebSocket service error.', error));
  registerIpcHandlers(token);
  logger.info('Desktop services initialized.', { platform: process.platform, version: app.getVersion() });
};

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => {
    isQuitting = true;
    jobWebSocket?.close();
    jobStore?.close();
    tray?.destroy();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.broxprint.studio');
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
