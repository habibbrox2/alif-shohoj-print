import { IPrinterDriver, DriverProtocol, DriverStatus, DriverSpoolOptions, SpoolResult } from './IPrinterDriver';
import { PrinterDevice, PrintJob } from '../../../shared/types';

export class WindowsGdiGenericDriver implements IPrinterDriver {
  public readonly id = 'driver_win32_gdi_generic';
  public readonly name = 'Windows Win32 GDI / Print Spooler Universal Driver';
  public readonly vendor = 'Generic' as const;
  public readonly protocol: DriverProtocol = 'windows_gdi';
  public readonly supportedModels = [/.*/]; // Universal catch-all

  public canHandle(_modelName: string): boolean {
    return true;
  }

  public async queryDeviceStatus(printer: PrinterDevice): Promise<DriverStatus> {
    return {
      online: printer.status === 'online',
      state: printer.status === 'online' ? 'ready' : 'offline',
      rawStatusCode: 'WIN32_PRINTER_STATUS_READY',
      nativeStatusMessage: 'Standard Windows Spooler Service Active',
      paperTrayCount: printer.paperCount,
      inkSupplies: {
        black: printer.inkLevels.black,
      },
      supportedDPI: [600, 1200],
      borderlessCapable: false,
    };
  }

  public generateRawDriverCommands(job: PrintJob, options: DriverSpoolOptions): string[] {
    return [
      `Win32 Spooler API: OpenPrinter("${job.targetPrinterName}")`,
      `Win32 Spooler API: StartDocPrinter(DocName="${job.fileName}", DataType="RAW")`,
      `Win32 Spooler API: StartPagePrinter()`,
      `Win32 Spooler API: WritePrinter(ByteCount=${job.fileSize})`,
      `Win32 Spooler API: EndPagePrinter()`,
      `Win32 Spooler API: EndDocPrinter()`,
      `Win32 Spooler API: ClosePrinter()`,
    ];
  }

  public async executeSpool(job: PrintJob, options: DriverSpoolOptions): Promise<SpoolResult> {
    return {
      success: true,
      spoolJobId: `WIN32-SPOOL-${Date.now().toString().slice(-6)}`,
      driverUsed: this.name,
      protocol: this.protocol,
      bytesTransmitted: 1024 * 512,
      rawCommandSummary: `Standard Windows GDI Print Spool via StartDocPrinter`,
      spoolTimestamp: Date.now(),
    };
  }
}
