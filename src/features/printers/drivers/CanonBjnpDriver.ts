import { IPrinterDriver, DriverProtocol, DriverStatus, DriverSpoolOptions, SpoolResult } from './IPrinterDriver';
import { PrinterDevice, PrintJob } from '../../../shared/types';

export class CanonBjnpDriver implements IPrinterDriver {
  public readonly id = 'driver_canon_bjnp';
  public readonly name = 'Canon BJNP / CAPT Color InkTank Driver';
  public readonly vendor = 'Canon' as const;
  public readonly protocol: DriverProtocol = 'bjnp_canon';
  public readonly supportedModels = [/canon/i, /pixma/i, /g3010/i, /g2010/i, /g6070/i];

  public canHandle(modelName: string): boolean {
    return this.supportedModels.some(regex => regex.test(modelName));
  }

  public async queryDeviceStatus(printer: PrinterDevice): Promise<DriverStatus> {
    return {
      online: printer.status === 'online',
      state: printer.status === 'online' ? 'ready' : 'offline',
      rawStatusCode: 'CANON_BJNP_STATUS_0x00_IDLE',
      nativeStatusMessage: 'FINE Cartridge Cartridge Tank Reservoir Normal',
      paperTrayCount: printer.paperCount,
      inkSupplies: {
        black: printer.inkLevels.black,
        cyan: printer.inkLevels.cyan ?? 70,
        magenta: printer.inkLevels.magenta ?? 58,
        yellow: printer.inkLevels.yellow ?? 62,
      },
      supportedDPI: [600, 1200, 4800],
      borderlessCapable: true,
    };
  }

  public generateRawDriverCommands(job: PrintJob, options: DriverSpoolOptions): string[] {
    return [
      `[BJNP HEADER] Magic: "BJNP" Version: 1.0 Command: 0x01 (Initiate Spool Session)`,
      `[CAPT BLOCK] Set Print Quality: High (FINE Hybrid Ink System)`,
      `[CAPT BLOCK] Color Plane: CMYK 4-Channel Interleaved`,
      `[CAPT BLOCK] Media Feed: Rear Paper Tray (Plain 80gsm / Photo Paper)`,
      `[CAPT BLOCK] Send Raster Lines (RunLength Compressed)`,
      `[BJNP TRAILER] Command: 0x02 (Close Session & Spool Eject)`,
    ];
  }

  public async executeSpool(job: PrintJob, options: DriverSpoolOptions): Promise<SpoolResult> {
    const simulatedBytes = 1024 * 1024 * 1.5;
    return {
      success: true,
      spoolJobId: `CANON-BJNP-${Date.now().toString().slice(-6)}`,
      driverUsed: this.name,
      protocol: this.protocol,
      bytesTransmitted: Math.round(simulatedBytes),
      rawCommandSummary: `Canon BJNP Color Spool (FINE 4800 DPI Hybrid Engine)`,
      spoolTimestamp: Date.now(),
    };
  }
}
