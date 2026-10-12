import type { PrintJob } from './types.js';
import type { PrinterDevice, ServicePricing, ShopCounter, ShopProfile, StudioService } from './types.js';
import type { AppSettings } from './settings.js';
import type { BusinessHoursSettings, OrderLimitsSettings } from './settings.js';
import type { CounterFeedOrder } from './services/counterFeed.js';

export interface CustomerAppConfig {
  shopProfile: Pick<ShopProfile, 'id' | 'name' | 'nameBn' | 'code' | 'phone' | 'address' | 'bkashNumber' | 'nagadNumber' | 'voiceGuide' | 'isDndMode'>;
  counters: ShopCounter[];
  printers: PrinterDevice[];
  pricing: ServicePricing;
  services: StudioService[];
  operationalPolicy: Pick<AppSettings, 'businessHours' | 'orderLimits' | 'previewWatermarkEnabled'>;
}

export interface CounterHeartbeatStatus {
  counterId: string;
  online: boolean;
  lastSeenAt: number | null;
}

/** Whether this counter PC already holds its master pairing key. */
export interface CounterFeedStatus {
  hasKey: boolean;
  protected: boolean;
}

/** One page of this counter's own orders, as published by the master PC. */
export interface CounterFeedResponse {
  orders: CounterFeedOrder[];
  serverTime: number;
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

export type DesktopTrayAction = 'open-dashboard' | 'show-status' | 'printer-settings' | 'shop-settings';

export interface DesktopBridge {
  readonly isDesktop: true;
  getAppSettings(): Promise<AppSettings>;
  saveAppSettings(settings: AppSettings): Promise<AppSettings>;
  getAutoLaunch(): Promise<boolean>;
  setAutoLaunch(enabled: boolean): Promise<boolean>;
  getCloseToTray(): Promise<boolean>;
  setCloseToTray(enabled: boolean): Promise<boolean>;
  getConnectionInfo(): Promise<DesktopConnectionInfo>;
  getCustomerPwaUrl(): Promise<string | null>;
  publishCustomerConfig(config: CustomerAppConfig): Promise<void>;
  notifyPrinterStatus(printerName: string, isOnline: boolean): Promise<void>;
  getCounterStatuses(counterIds: string[]): Promise<CounterHeartbeatStatus[]>;
  sendCounterHeartbeat(masterUrl: string, counterId: string): Promise<boolean>;
  getCounterFeedKey(counterId: string): Promise<string | null>;
  rotateCounterFeedKey(counterId: string): Promise<string>;
  revokeCounterFeedKey(counterId: string): Promise<void>;
  getCounterFeedStatus(): Promise<CounterFeedStatus>;
  setCounterFeedKey(key: string): Promise<CounterFeedStatus>;
  clearCounterFeedKey(): Promise<CounterFeedStatus>;
  pullCounterOrders(masterUrl: string, counterId: string, since: number): Promise<CounterFeedResponse>;
  startCounterFeedWs?(masterUrl: string, counterId: string): Promise<{ ok: boolean }>;
  stopCounterFeedWs?(): Promise<{ ok: boolean }>;
  onCounterFeedUpdate?(callback: (update: CounterFeedResponse) => void): () => void;
  listPrinters(): Promise<string[]>;
  listQueue(): Promise<DesktopQueueJob[]>;
  saveJob(job: PrintJob): Promise<void>;
  removeJob(jobId: string): Promise<void>;
  printJob(jobId: string): Promise<void>;
  setTrayShopName(name: string): Promise<void>;
  /** Opens the Settings or Windows-agent page in its own auxiliary window. */
  openAuxiliaryWindow(target: 'settings' | 'agent', page?: string): Promise<void>;
  /** Asks an already-open auxiliary window to switch pages instead of spawning a duplicate. */
  onAuxNavigate?(callback: (payload: { target: 'settings' | 'agent'; page?: string }) => void): () => void;
  /** Broadcast after any desktop window saved new application settings. */
  onAppSettingsChanged?(callback: (settings: AppSettings) => void): () => void;
  onIncomingJob(callback: (job: PrintJob) => void): () => void;
  onQueueChanged(callback: (queueJob: DesktopQueueJob) => void): () => void;
  onTrayAction(callback: (action: DesktopTrayAction) => void): () => void;
  openFileDialog(options?: { filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] }): Promise<{ filePath: string; dataUrl: string; fileName: string } | null>;
}

declare global {
  interface Window {
    alifShohojPrintDesktop?: DesktopBridge;
  }
}
