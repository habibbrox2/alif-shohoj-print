import { IPrinterDriver, DriverProtocol, DriverStatus, DriverSpoolOptions, SpoolResult } from './IPrinterDriver';
import { PrinterDevice, PrintJob } from '../../../shared/types';

export class HpPcl6Driver implements IPrinterDriver {
  public readonly id = 'driver_hp_pcl6';
  public readonly name = 'HP PCL 6 / PCL XL High-Speed Laser Driver';
  public readonly vendor = 'HP' as const;
  public readonly protocol: DriverProtocol = 'pcl6';
  public readonly supportedModels = [/hp/i, /laserjet/i, /m404/i, /p2035/i, /pro m/i];

  public canHandle(modelName: string): boolean {
    return this.supportedModels.some(regex => regex.test(modelName));
  }

  public async queryDeviceStatus(printer: PrinterDevice): Promise<DriverStatus> {
    return {
      online: printer.status === 'online',
      state: printer.status === 'online' ? 'ready' : 'offline',
      rawStatusCode: 'HP_PJL_CODE_10001_READY',
      nativeStatusMessage: 'Fuser Ready · 40 PPM High-Speed Spooler Online',
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
      `\\x1B%-12345X@PJL JOB NAME = "${job.id}"`,
      `@PJL SET DUPLEX = ${options.duplex ? 'ON' : 'OFF'}`,
      `@PJL SET RESOLUTION = 1200`,
      `@PJL SET ECONOMODE = OFF`,
      `@PJL SET COPIES = ${job.copies}`,
      `@PJL ENTER LANGUAGE = PCLXL`,
      `) HP-PCL XL;2;0;Comment Copyright Hewlett-Packard Company 2026`,
      `BeginSession(1200, 1200, Inch)`,
      `OpenDataSource(Stream, DirectBinary)`,
      `SetPageScale(1.0, 1.0)`,
      `BeginPage(Orientation: Portrait, MediaSize: A4)`,
      `RasterCompress(Monochrome DeltaRow Compression)`,
      `EndPage()`,
      `EndSession()`,
      `\\x1B%-12345X@PJL EOJ`,
    ];
  }

  public async executeSpool(job: PrintJob, options: DriverSpoolOptions): Promise<SpoolResult> {
    const simulatedBytes = 1024 * 320 * job.copies; // ~320KB per page
    return {
      success: true,
      spoolJobId: `HP-PCL6-${Date.now().toString().slice(-6)}`,
      driverUsed: this.name,
      protocol: this.protocol,
      bytesTransmitted: Math.round(simulatedBytes),
      rawCommandSummary: `HP PCL 6 Stream (1200 DPI, Mono Compression, Copies: ${job.copies})`,
      spoolTimestamp: Date.now(),
    };
  }
}
