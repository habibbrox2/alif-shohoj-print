export type ServiceType = string;

export type PaperSize = '4R (4x6 in)' | 'A4 (8.27x11.69 in)' | 'Passport Grid (4-in-1)' | 'Passport Grid (8-in-1)' | 'Stamp Size' | 'Legal' | 'Custom';

export type PaperType = 'plain' | 'glossy' | 'matte' | 'laminated' | 'heavy_cardstock';

export type PrintQuality = 'draft' | 'normal' | 'high' | 'ultra_fine';

export type ColorMode = 'color' | 'bw';

export type JobStatus = 'queued' | 'approved' | 'routing' | 'printing' | 'completed' | 'rejected' | 'failed';

export type PaymentMethod = 'counter_cash' | 'bkash' | 'nagad';

export type PaymentStatus = 'unpaid' | 'paid_counter' | 'paid_mfs';

export type RejectReason =
  | 'blurry_photo' // ছবি অস্পষ্ট
  | 'corrupted_file' // ফাইল নষ্ট
  | 'invalid_size' // সাইজ মিলছে না
  | 'printer_unavailable' // প্রিন্টার অনুপলব্ধ
  | 'other'; // অন্যান্য

/** Tabs of the order dialog, so callers can open it directly on a given step. */
export type OrderCardTab = 'card' | 'preview' | 'edit' | 'reject' | 'audit' | 'canvas';

/**
 * A pending "open the order dialog" instruction. `seq` makes every request
 * distinct so re-opening the same order still applies the requested tab.
 */
export interface OrderCardOpenRequest {
  tab: OrderCardTab;
  seq: number;
}

export interface OrderAuditLog {
  id: string;
  timestamp: number;
  actor: 'shopkeeper' | 'counter_operator' | 'customer' | 'system';
  action: string;
  details: string;
}

export interface PrinterDevice {
  id: string;
  name: string;
  brand: 'HP' | 'Epson' | 'Canon' | 'Brother' | 'Pantum' | 'Samsung' | 'Ricoh' | 'Konica Minolta' | 'Lexmark' | 'Xerox' | 'Kyocera' | 'Other';
  model: string;
  type: 'laser_bw' | 'photo_inkjet' | 'color_inkjet';
  status: 'online' | 'offline' | 'busy' | 'low_paper';
  supportedPaperSizes: string[];
  colorCapability: 'bw_only' | 'color';
  queueCount: number;
  inkLevels: {
    black: number;
    cyan?: number;
    magenta?: number;
    yellow?: number;
  };
  paperCount: number;
  description: string;
}

// Service Printing Preferences
export interface ServicePrintingPreferences {
  paperType: PaperType; // 'plain' | 'glossy' | 'matte' | 'laminated' | 'heavy_cardstock'
  quality: PrintQuality; // 'draft' | 'normal' | 'high' | 'ultra_fine'
  color: ColorMode; // 'color' | 'bw'
  paperSize: PaperSize;
  dpi: number; // e.g. 300, 600, 1200, 2880
  defaultCopies: number;
  borderless: boolean;
}

// Full Studio Service Definition (দোকানের সার্ভিস ম্যানেজমেন্ট)
export interface StudioService {
  id: string; // e.g. 'passport_photo', 'nid_card', 'custom_birth_cert'
  code: string; // short code, e.g. 'PASSPORT', 'DOC'
  title: string; // English label
  titleBn: string; // Bengali label e.g. 'পাসপোর্ট ছবি (৪ কপি শিট)'
  descriptionBn: string; // Bengali description
  icon: string; // emoji or icon name
  category: 'photo' | 'document' | 'card' | 'custom';
  basePriceBDT: number;
  enabled: boolean; // চালু / বন্ধ
  autoApprove: boolean; // অটো-অ্যাপ্রুভ চালু / বন্ধ
  preferredPrinterId?: string; // নির্দিষ্ট প্রিন্টার অ্যাসাইন
  preferences: ServicePrintingPreferences; // Paper Type, Quality, Color, DPI etc.
  isCustom?: boolean; // স্বত্বাধিকারী তৈরি করা কাস্টম সার্ভিস
}

export interface PrintJob {
  id: string;
  tokenCode: string; // e.g. "127"
  customerPhone: string;
  customerName?: string;
  serviceType: ServiceType;
  serviceLabel: string;
  serviceLabelBn: string;
  paperSize: PaperSize;
  paperFinish: 'normal' | 'glossy' | 'matte' | 'laminated';
  copies: number;
  colorMode: ColorMode;
  status: JobStatus;
  targetPrinterId: string;
  targetPrinterName: string;
  routingReason: string;
  priceBDT: number;
  originalPriceBDT?: number;
  priceChangedConsentRequired?: boolean;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fileUrl: string;
  fileName: string;
  fileSize: string;
  createdAt: number;
  completedAt?: number;
  autoDeleteCountdownSeconds: number; // 15 min ephemeral retention
  cropSettings?: {
    zoom: number;
    rotation: number;
    brightness: number;
    contrast: number;
    aspectRatio: string;
  };
  printingPreferences?: ServicePrintingPreferences;
  gridCount?: number; // e.g. 4-in-1, 8-in-1
  rejectReason?: RejectReason;
  rejectNote?: string;
  printError?: string;
  auditLogs: OrderAuditLog[];
  // Multi-counter LAN terminal tag
  counterId?: string;
  counterName?: string;
}

export interface ShopCounter {
  id: string; // e.g. "CTR-01"
  code: string; // e.g. "CTR-1"
  name: string; // e.g. "কাউন্টার ১ - মূল সার্ভার ও ক্যাশ ডেস্ক"
  operator: string; // e.g. "মো: শাকিল"
  ipAddress: string; // e.g. "192.168.1.110"
  status: 'active' | 'busy' | 'offline';
  isOnline?: boolean;
  lastSeenAt?: number | null;
  isMasterHost: boolean; // True if this PC is the Main Server hosting the hardware
  assignedServices: ServiceType[];
  defaultPrinterId: string;
  todayOrdersCount: number;
  todayEarningsBDT: number;
}

export type InstallationMode = 'master' | 'counter';

export interface InstallationConfig {
  mode: InstallationMode;
  counterId: string;
  masterUrl?: string;
}

export interface SharedScannerDevice {
  id: string;
  name: string;
  brand: 'Epson' | 'Canon' | 'HP';
  model: string;
  status: 'ready' | 'scanning' | 'offline';
  connectedToHost: string; // "Master PC (Server)"
  maxDpi: number;
  scanModes: ('color' | 'grayscale' | 'bw')[];
  lastScannedAt?: number;
}

export interface VoiceGuidePreferences {
  enabled: boolean;
  defaultLang: 'bn' | 'en';
  defaultSpeed: 0.8 | 1.0 | 1.25;
}

export interface ShopProfile {
  id: string;
  name: string;
  nameBn: string;
  code: string; // e.g. "RCD-8K29"
  owner: string;
  phone: string;
  address: string;
  token: string;
  bkashNumber: string;
  nagadNumber: string;
  soundAlertEnabled: boolean;
  isDndMode: boolean; // Do Not Disturb / Shop closed pause
  dndMessage?: string;
  // Voice Guide Settings (Group 6)
  voiceGuide: VoiceGuidePreferences;
  // Local Server Configuration
  localServer: {
    status: 'running' | 'stopped' | 'restarting';
    port: number;
    localIp: string;
    connectedClients: number;
    uptimeSeconds: number;
  };
}

export interface ServicePricing {
  passport4in1: number;
  passport8in1: number;
  stampPhoto: number;
  nidSmartCard: number;
  nidNormalA4: number;
  photo4R: number;
  photo6R: number;
  docA4BW: number;
  docA4Color: number;
  [key: string]: number;
}

export type VoiceStep = 'welcome' | 'service' | 'upload' | 'crop' | 'copies' | 'preview' | 'token';
