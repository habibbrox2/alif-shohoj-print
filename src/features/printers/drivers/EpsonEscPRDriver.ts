import { IPrinterDriver, DriverProtocol, DriverStatus, DriverSpoolOptions, SpoolResult } from './IPrinterDriver';
import { PrinterDevice, PrintJob } from '../../../shared/types';

export class EpsonEscPRDriver implements IPrinterDriver {
  public readonly id = 'driver_epson_esc_pr';
  public readonly name = 'Epson ESC/P-R High-Definition Photo Driver';
  public readonly vendor = 'Epson' as const;
  public readonly protocol: DriverProtocol = 'esc_p_r';
  public readonly supportedModels = [/epson/i, /l805/i, /l850/i, /l1800/i, /ecotank/i, /stylus/i];

  public canHandle(modelName: string): boolean {
    return this.supportedModels.some(regex => regex.test(modelName));
  }

  public async queryDeviceStatus(printer: PrinterDevice): Promise<DriverStatus> {
    return {
      online: printer.status === 'online',
      state: printer.status === 'online' ? 'ready' : 'offline',
      rawStatusCode: 'EPSON_ESCP_0x00_READY',
      nativeStatusMessage: 'Micro-Piezo 6-Color Printhead Clean & Ready',
      paperTrayCount: printer.paperCount,
      inkSupplies: {
        black: printer.inkLevels.black,
        cyan: printer.inkLevels.cyan ?? 88,
        magenta: printer.inkLevels.magenta ?? 76,
        yellow: printer.inkLevels.yellow ?? 84,
        lightCyan: 90,
        lightMagenta: 85,
      },
      supportedDPI: [720, 1440, 5760],
      borderlessCapable: true,
    };
  }

  public generateRawDriverCommands(job: PrintJob, options: DriverSpoolOptions): string[] {
    const isPhoto = job.serviceType === 'passport_photo' || job.serviceType === 'photo_4r';
    const dpi = isPhoto ? 5760 : 1440;

    return [
      `[ESC @] Reset Printer to Default State`,
      `[ESC ( G \\x01\\x00\\x01] Enter Advanced Raster ESC/P-R Mode`,
      `[ESC ( U \\x05\\x00 0x${dpi.toString(16)}] Set Micro-Step Resolution to ${dpi} DPI (6-Color Mode)`,
      `[ESC ( c \\x04\\x00] Media Type: ${options.mediaType === 'glossy_photo' ? 'Ultra Glossy Photo Film' : 'Premium Semigloss'}`,
      `[ESC ( C \\x02\\x00] Set Page Length: ${job.paperSize}`,
      `[ESC ( V \\x02\\x00] Top Margin 0.00mm (Borderless Photo Bleed Enabled)`,
      `[ESC ( S \\x08\\x00] Spool 6-Color Droplet Interleaving (CMYK+Lc+Lm)`,
      `[ESC ( . \\x00] End Raster Stream & Auto-Eject Sheet`,
    ];
  }

  public async executeSpool(job: PrintJob, options: DriverSpoolOptions): Promise<SpoolResult> {
    const simulatedBytes = 1024 * 1024 * 3.8; // ~3.8MB photo raster
    return {
      success: true,
      spoolJobId: `EPSON-SPOOL-${Date.now().toString().slice(-6)}`,
      driverUsed: this.name,
      protocol: this.protocol,
      bytesTransmitted: Math.round(simulatedBytes),
      rawCommandSummary: `ESC/P-R 5760x1440 DPI Photo Spool (${job.paperSize}, ${options.mediaType})`,
      spoolTimestamp: Date.now(),
    };
  }
}
