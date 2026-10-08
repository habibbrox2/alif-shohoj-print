import { IPrinterDriver, DriverStatus, DriverSpoolOptions, SpoolResult } from './IPrinterDriver';
import { EpsonEscPRDriver } from './EpsonEscPRDriver';
import { HpPcl6Driver } from './HpPcl6Driver';
import { CanonBjnpDriver } from './CanonBjnpDriver';
import { WindowsGdiGenericDriver } from './WindowsGdiGenericDriver';
import { capabilitiesRegistry, PrinterCapabilities } from './PrinterCapabilitiesRegistry';
import { PrinterDevice, PrintJob } from '../../../shared/types';

export class PrinterDriverRegistry {
  private static instance: PrinterDriverRegistry;
  private drivers: IPrinterDriver[] = [];
  private fallbackDriver: IPrinterDriver;

  private constructor() {
    // Register driver adapters in priority order
    this.drivers = [
      new EpsonEscPRDriver(),
      new HpPcl6Driver(),
      new CanonBjnpDriver(),
    ];
    this.fallbackDriver = new WindowsGdiGenericDriver();
  }

  public static getInstance(): PrinterDriverRegistry {
    if (!PrinterDriverRegistry.instance) {
      PrinterDriverRegistry.instance = new PrinterDriverRegistry();
    }
    return PrinterDriverRegistry.instance;
  }

  public getAvailableDrivers(): IPrinterDriver[] {
    return [...this.drivers, this.fallbackDriver];
  }

  /**
   * Resolves the appropriate hardware driver for any printer device
   * through standardized interface discovery
   */
  public resolveDriver(printer: PrinterDevice): IPrinterDriver {
    const matched = this.drivers.find(d => d.canHandle(printer.name) || d.canHandle(printer.model));
    return matched || this.fallbackDriver;
  }

  /**
   * Dynamically query hardware and driver capabilities via PrinterCapabilitiesRegistry
   */
  public getCapabilities(printer: PrinterDevice): PrinterCapabilities {
    const driver = this.resolveDriver(printer);
    return capabilitiesRegistry.getCapabilitiesForDriver(driver.id);
  }

  public async getNormalizedStatus(printer: PrinterDevice): Promise<DriverStatus> {
    const driver = this.resolveDriver(printer);
    return driver.queryDeviceStatus(printer);
  }

  public async spoolJob(job: PrintJob, printer: PrinterDevice): Promise<SpoolResult> {
    const driver = this.resolveDriver(printer);
    const caps = this.getCapabilities(printer);

    const isHighResPhoto = job.serviceType === 'passport_photo' || job.serviceType === 'photo_4r';
    const chosenDpi = isHighResPhoto ? caps.photoDpi : caps.defaultDpi;

    const options: DriverSpoolOptions = {
      dpi: chosenDpi,
      duplex: caps.duplexSupported && job.copies > 1 && job.serviceType === 'doc_a4',
      colorMode: job.colorMode,
      paperSize: job.paperSize,
      copies: job.copies,
      borderless: caps.borderlessSupported && (job.serviceType === 'photo_4r' || job.serviceType === 'passport_photo'),
      mediaType: job.paperFinish === 'glossy' ? 'glossy_photo' : 'plain_paper',
    };

    return driver.executeSpool(job, options);
  }

  public getRawCommands(job: PrintJob, printer: PrinterDevice): string[] {
    const driver = this.resolveDriver(printer);
    const caps = this.getCapabilities(printer);

    const options: DriverSpoolOptions = {
      dpi: caps.defaultDpi,
      duplex: caps.duplexSupported,
      colorMode: job.colorMode,
      paperSize: job.paperSize,
      copies: job.copies,
      mediaType: job.paperFinish === 'glossy' ? 'glossy_photo' : 'plain_paper',
    };
    return driver.generateRawDriverCommands(job, options);
  }
}

export const driverRegistry = PrinterDriverRegistry.getInstance();
