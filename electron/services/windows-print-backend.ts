import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BrowserWindow } from 'electron';
import type { PrintSpoolerOptions } from './print-service.js';
import {
  filterPhysicalPrinterDetails,
  filterPhysicalPrinters,
  isVirtualPrinter,
  isVirtualPrinterDetail,
  type PrinterDetail,
  toPrinterPageSize,
} from './print-targets.js';

const execFileAsync = promisify(execFile);

export class WindowsPrintBackend {
  private window: BrowserWindow | null = null;

  private ensureWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window;
    this.window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    return this.window;
  }

  async getPrinterDetails(): Promise<PrinterDetail[]> {
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-Printer | Select-Object Name, PortName, DriverName | ConvertTo-Json -Compress',
      ]);
      const trimmed = stdout.trim();
      if (!trimmed) return [];
      const parsed = JSON.parse(trimmed) as
        | { Name: string; PortName?: string; DriverName?: string }
        | Array<{ Name: string; PortName?: string; DriverName?: string }>;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list
        .filter(item => typeof item?.Name === 'string' && item.Name.length > 0)
        .map(item => ({
          name: item.Name,
          portName: item.PortName,
          driverName: item.DriverName,
        }));
    } catch {
      // Fall back to Electron's printer list when the spooler query is unavailable.
      const win = this.ensureWindow();
      const printers = await win.webContents.getPrintersAsync();
      return printers.map(printer => ({ name: printer.name }));
    }
  }

  async getPrinters(): Promise<string[]> {
    const details = await this.getPrinterDetails();
    if (details.length > 0) return details.map(detail => detail.name);
    const win = this.ensureWindow();
    const printers = await win.webContents.getPrintersAsync();
    return printers.map(printer => printer.name);
  }

  async getPhysicalPrinters(): Promise<string[]> {
    const details = await this.getPrinterDetails();
    if (details.length > 0) {
      return filterPhysicalPrinterDetails(details).map(detail => detail.name);
    }
    return filterPhysicalPrinters(await this.getPrinters());
  }

  async print(pdfPath: string, options: PrintSpoolerOptions): Promise<void> {
    const win = this.ensureWindow();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out loading the print document.'));
      }, 30000);

      const cleanup = (): void => {
        clearTimeout(timeout);
        win.webContents.removeListener('did-finish-load', onLoad);
        win.webContents.removeListener('did-fail-load', onFail);
      };

      const onLoad = (): void => {
        cleanup();
        resolve();
      };
      const onFail = (_event: unknown, _code: number, description: string): void => {
        cleanup();
        reject(new Error(description || 'Failed to load the print document.'));
      };

      win.webContents.on('did-finish-load', onLoad);
      win.webContents.on('did-fail-load', onFail);
      win.loadFile(pdfPath).catch(error => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });

    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        {
          silent: true,
          deviceName: options.printer,
          copies: options.copies,
          color: !options.monochrome,
          landscape: options.orientation === 'landscape',
          pageSize: toPrinterPageSize(options.paperSize) as any,
        },
        (success, failureReason) => {
          if (success) {
            resolve();
            return;
          }
          if (isVirtualPrinter(options.printer)) {
            reject(
              new Error(
                `Printer "${options.printer}" is a virtual/document printer and cannot be used for silent printing. Choose a physical printer.`
              )
            );
            return;
          }
          reject(new Error(failureReason || 'The Windows print job failed.'));
        }
      );
    });
  }

  dispose(): void {
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = null;
  }
}

let backend: WindowsPrintBackend | null = null;

export const getWindowsPrintBackend = (): WindowsPrintBackend => {
  if (!backend) backend = new WindowsPrintBackend();
  return backend;
};

export const disposeWindowsPrintBackend = (): void => {
  backend?.dispose();
  backend = null;
};