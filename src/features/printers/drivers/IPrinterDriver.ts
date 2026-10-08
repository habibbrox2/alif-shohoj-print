import { PrinterDevice, PrintJob } from '../../../shared/types';

export type DriverProtocol = 'windows_gdi' | 'esc_p_r' | 'pcl6' | 'bjnp_canon' | 'ipp_raw';

export type NormalizedPrinterStatus =
  | 'ready'
  | 'printing'
  | 'busy'
  | 'offline'
  | 'paper_jam'
  | 'out_of_paper'
  | 'low_ink'
  | 'cover_open';

export interface DriverStatus {
  online: boolean;
  state: NormalizedPrinterStatus;
  rawStatusCode: string;
  nativeStatusMessage: string;
  paperTrayCount: number;
  inkSupplies: {
    black: number;
    cyan?: number;
    magenta?: number;
    yellow?: number;
    lightCyan?: number;
    lightMagenta?: number;
  };
  supportedDPI: number[];
  borderlessCapable: boolean;
}

export interface DriverSpoolOptions {
  dpi: number;
  duplex: boolean;
  colorMode: 'color' | 'bw';
  paperSize: string;
  copies: number;
  borderless?: boolean;
  mediaType: 'plain_paper' | 'glossy_photo' | 'matte_photo' | 'envelope';
}

export interface SpoolResult {
  success: boolean;
  spoolJobId: string;
  driverUsed: string;
  protocol: DriverProtocol;
  bytesTransmitted: number;
  rawCommandSummary: string;
  spoolTimestamp: number;
  error?: string;
}

/**
 * Standardized Printer Driver Abstraction Interface (Adapter Pattern)
 * Allows the ALIF SHOHOJ PRINT Agent to talk seamlessly to HP, Epson, Canon, and generic spoolers
 */
export interface IPrinterDriver {
  readonly id: string;
  readonly name: string;
  readonly vendor: 'Epson' | 'HP' | 'Canon' | 'Generic';
  readonly protocol: DriverProtocol;
  readonly supportedModels: RegExp[];

  canHandle(modelName: string): boolean;
  queryDeviceStatus(printer: PrinterDevice): Promise<DriverStatus>;
  executeSpool(job: PrintJob, options: DriverSpoolOptions): Promise<SpoolResult>;
  generateRawDriverCommands(job: PrintJob, options: DriverSpoolOptions): string[];
}
