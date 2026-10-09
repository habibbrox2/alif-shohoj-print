import type { PrintJob } from './types.js';
import type { PrinterDevice, ServicePricing, ShopCounter, ShopProfile, StudioService } from './types.js';

export interface CustomerAppConfig {
  shopProfile: Pick<ShopProfile, 'id' | 'name' | 'nameBn' | 'code' | 'phone' | 'address' | 'bkashNumber' | 'nagadNumber' | 'voiceGuide'>;
  counters: ShopCounter[];
  printers: PrinterDevice[];
  pricing: ServicePricing;
  services: StudioService[];
}

export interface CounterHeartbeatStatus {
  counterId: string;
  online: boolean;
  lastSeenAt: number | null;
}

export type DesktopQueueStatus = 'queued' | 'printing' | 'completed' | 'failed';

export interface DesktopQueueJob {
  job: PrintJob;
  status: DesktopQueueStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface DesktopConnectionInfo {
  url: string;
  host: string;
  port: number;
  token: string;
  secure: boolean;
}

export interface DesktopBridge {
  readonly isDesktop: true;
  getAutoLaunch(): Promise<boolean>;
  setAutoLaunch(enabled: boolean): Promise<boolean>;
  getConnectionInfo(): Promise<DesktopConnectionInfo>;
  getCustomerPwaUrl(): Promise<string | null>;
  publishCustomerConfig(config: CustomerAppConfig): Promise<void>;
  getCounterStatuses(counterIds: string[]): Promise<CounterHeartbeatStatus[]>;
  sendCounterHeartbeat(masterUrl: string, counterId: string): Promise<boolean>;
  listPrinters(): Promise<string[]>;
  listQueue(): Promise<DesktopQueueJob[]>;
  saveJob(job: PrintJob): Promise<void>;
  removeJob(jobId: string): Promise<void>;
  printJob(jobId: string): Promise<void>;
  onIncomingJob(callback: (job: PrintJob) => void): () => void;
  onQueueChanged(callback: (queueJob: DesktopQueueJob) => void): () => void;
}

declare global {
  interface Window {
    alifShohojPrintDesktop?: DesktopBridge;
  }
}
