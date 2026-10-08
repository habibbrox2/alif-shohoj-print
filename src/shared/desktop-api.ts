import type { PrintJob } from './types.js';

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
  listPrinters(): Promise<string[]>;
  listQueue(): Promise<DesktopQueueJob[]>;
  saveJob(job: PrintJob): Promise<void>;
  printJob(jobId: string): Promise<void>;
  onIncomingJob(callback: (job: PrintJob) => void): () => void;
  onQueueChanged(callback: (queueJob: DesktopQueueJob) => void): () => void;
}

declare global {
  interface Window {
    broxprintDesktop?: DesktopBridge;
  }
}
