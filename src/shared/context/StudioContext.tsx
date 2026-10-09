import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  PrinterDevice,
  PrintJob,
  ShopProfile,
  ServicePricing,
  JobStatus,
  RejectReason,
  OrderAuditLog,
  ServiceType,
  ShopCounter,
  SharedScannerDevice,
  StudioService,
  InstallationConfig,
} from '../types';
import { INITIAL_PRINTERS, matchPrinterForJob } from '../../features/printers/printerRouting';
import { globalVoice, playIncomingOrderChime, playPrintCompleteChime } from '../services/voiceGuide';
import { INITIAL_STUDIO_SERVICES } from '../services/studioServices';
import { createJobId, nextTokenNumber } from '../services/jobIdentity';
import {
  approveJobTransition,
  collectNewlyCompleted,
  rejectJobTransition,
  tickJobRetention,
} from '../services/jobLifecycle';
import { PRICING_KEY_BY_SERVICE } from '../services/pricing';
import {
  COUNTERS_STORAGE_KEY,
  PRICING_STORAGE_KEY,
  PRINTERS_STORAGE_KEY,
  SHOP_PROFILE_STORAGE_KEY,
  loadPersisted,
  readMigratedStorageValue,
  savePersisted,
  validators,
} from '../services/persistedState';
import type { CustomerAppConfig, DesktopQueueJob } from '../desktop-api';

interface StudioContextType {
  // Current view
  activeView: StudioView;
  setActiveView: (view: StudioView) => void;
  installationConfig: InstallationConfig | null;
  isMaster: boolean;
  configureInstallation: (config: InstallationConfig) => boolean;

  // Shop & Hardware State
  shopProfile: ShopProfile;
  updateShopProfile: (updates: Partial<ShopProfile>) => void;
  printers: PrinterDevice[];
  togglePrinterStatus: (id: string) => void;
  refillPrinterPaper: (id: string) => void;
  refillPrinterInk: (id: string) => void;

  // Jobs
  jobs: PrintJob[];
  todayPrintedCount: number;
  todayEarningsBDT: number;
  pendingJobsCount: number;
  activeOrderCardJob: PrintJob | null;
  setActiveOrderCardJob: (job: PrintJob | null) => void;
  desktopQueueError: string | null;

  // Actions
  createCustomerJob: (newJob: Omit<PrintJob, 'id' | 'createdAt' | 'status' | 'auditLogs' | 'autoDeleteCountdownSeconds' | 'targetPrinterId' | 'targetPrinterName' | 'routingReason'>) => PrintJob;
  approveJob: (jobId: string) => void;
  rejectJob: (jobId: string, reason: RejectReason, note?: string) => void;
  editJob: (jobId: string, updates: Partial<PrintJob>, auditNote: string) => void;
  rerouteJob: (jobId: string, printerId: string) => void;
  triggerTestPrint: (printerId: string) => void;

  // Studio Service Management
  services: StudioService[];
  servicePersistenceError: string | null;
  createStudioService: (service: Omit<StudioService, 'id' | 'isCustom'>) => boolean;
  deleteStudioService: (serviceId: string) => boolean;
  toggleStudioService: (serviceId: string) => boolean;
  updateStudioService: (serviceId: string, updates: Partial<StudioService>) => boolean;

  // Local Printer Fleet Controls (কম্পিউটারে থাকা সকল প্রিন্টার)
  addNewPrinter: (newPrinter: Omit<PrinterDevice, 'id' | 'queueCount'>) => void;
  removePrinter: (printerId: string) => void;
  scanLocalPrinters: () => Promise<number>;

  // Multi-Counter LAN Architecture (একই ওয়াইফাই/ল্যানে একাধিক কম্পিউটার)
  counters: ShopCounter[];
  activeCounterId: string;
  setActiveCounterId: (id: string) => void;
  addCounter: (newCounter: Omit<ShopCounter, 'todayOrdersCount' | 'todayEarningsBDT'>) => void;
  updateCounter: (id: string, updates: Partial<ShopCounter>) => void;
  deleteCounter: (id: string) => void;
  selectedPosterCounter: ShopCounter | null;
  setSelectedPosterCounter: (counter: ShopCounter | null) => void;

  // Shared Network Scanners across LAN
  sharedScanners: SharedScannerDevice[];
  triggerNetworkScan: (scannerId: string, counterId: string) => Promise<{ sampleUrl: string; dpi: number }>;

  // Local Server Controls
  restartLocalServer: () => void;

  // Pricing
  pricing: ServicePricing;
  updatePricing: (updates: Partial<ServicePricing>) => void;

  // Windows Toast Notification
  activeToast: {
    job: PrintJob;
    title: string;
    message: string;
  } | null;
  dismissToast: () => void;

  // Modals
  isPosterModalOpen: boolean;
  setIsPosterModalOpen: (open: boolean) => void;
  isExePackageModalOpen: boolean;
  setIsExePackageModalOpen: (open: boolean) => void;

  // Voice guide in customer view
  voiceGuideEnabled: boolean;
  setVoiceGuideEnabled: (enabled: boolean) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const INITIAL_SHOP_PROFILE: ShopProfile = {
  id: 'shop_demo_001',
  name: 'Demo Print Shop',
  nameBn: 'ডেমো প্রিন্ট শপ',
  code: 'DEMO-0001',
  owner: 'Demo Shop Owner',
  phone: '01XXXXXXXXX',
  address: 'Demo address, Bangladesh',
  token: 'demo-token-change-before-use',
  bkashNumber: '01XXXXXXXXX',
  nagadNumber: '01XXXXXXXXX',
  soundAlertEnabled: true,
  isDndMode: false,
  dndMessage: 'দোকান সাময়িকভাবে বিরতিতে আছে। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।',
  voiceGuide: {
    enabled: true,
    defaultLang: 'bn',
    defaultSpeed: 1.0,
  },
  localServer: {
    status: 'running',
    port: 3000,
    localIp: '192.168.1.105',
    connectedClients: 4,
    uptimeSeconds: 14820,
  },
};

const INITIAL_PRICING: ServicePricing = {
  passport4in1: 50,
  passport8in1: 80,
  stampPhoto: 30,
  nidSmartCard: 40,
  nidNormalA4: 15,
  photo4R: 35,
  photo6R: 60,
  docA4BW: 5,
  docA4Color: 15,
};

// Preset initial LAN Shop Counters
export const INITIAL_COUNTERS: ShopCounter[] = [
  {
    id: 'CTR-01',
    code: 'CTR-1',
    name: 'কাউন্টার ১ - মূল সার্ভার ও ক্যাশ ডেস্ক (Master Host)',
    operator: 'মো: আতিকুর রহমান (স্বত্বাধিকারী)',
    ipAddress: '192.168.1.105',
    status: 'active',
    isMasterHost: true,
    assignedServices: ['passport_photo', 'stamp_photo', 'nid_card', 'photo_4r', 'doc_a4'],
    defaultPrinterId: 'printer_epson_l805',
    todayOrdersCount: 0,
    todayEarningsBDT: 0,
  },
  {
    id: 'CTR-02',
    code: 'CTR-2',
    name: 'কাউন্টার ২ - ফটোকপি ও অনলাইন আবেদন (LAN Terminal)',
    operator: 'মো: শাকিল আহমেদ (অপারেটর)',
    ipAddress: '192.168.1.112',
    status: 'active',
    isMasterHost: false,
    assignedServices: ['doc_a4', 'nid_card'],
    defaultPrinterId: 'printer_hp_laserjet',
    todayOrdersCount: 0,
    todayEarningsBDT: 0,
  },
  {
    id: 'CTR-03',
    code: 'CTR-3',
    name: 'কাউন্টার ৩ - ডিজিটাল ফটো ও পাসপোর্ট স্টুডিও (LAN Studio)',
    operator: 'রাকিবুল হাসান (ফটোগ্রাফার)',
    ipAddress: '192.168.1.118',
    status: 'active',
    isMasterHost: false,
    assignedServices: ['passport_photo', 'stamp_photo', 'photo_4r'],
    defaultPrinterId: 'printer_epson_l805',
    todayOrdersCount: 0,
    todayEarningsBDT: 0,
  },
];

// Preset initial Shared Hardware Scanners connected to Master Host
export const INITIAL_SHARED_SCANNERS: SharedScannerDevice[] = [
  {
    id: 'scanner_epson_v39',
    name: 'Epson Perfection V39 II Flatbed Scanner',
    brand: 'Epson',
    model: 'Perfection V39 II (USB 2.0 High-Speed)',
    status: 'ready',
    connectedToHost: 'কাউন্টার ১ - মূল সার্ভার (192.168.1.105)',
    maxDpi: 1200,
    scanModes: ['color', 'grayscale', 'bw'],
    lastScannedAt: Date.now() - 8 * 60 * 1000,
  },
  {
    id: 'scanner_canon_lide300',
    name: 'Canon CanoScan LiDE 300 Studio Scanner',
    brand: 'Canon',
    model: 'LiDE 300 Flatbed CIS Sensor',
    status: 'ready',
    connectedToHost: 'কাউন্টার ১ - মূল সার্ভার (192.168.1.105)',
    maxDpi: 2400,
    scanModes: ['color', 'grayscale'],
    lastScannedAt: Date.now() - 32 * 60 * 1000,
  },
];

// Preset demo jobs matching user's spec
const INITIAL_JOBS: PrintJob[] = [
  {
    id: 'JOB-20261008-00127',
    tokenCode: '127',
    customerPhone: '01799-887766',
    customerName: 'Shakil Ahmed',
    serviceType: 'nid_card',
    serviceLabel: 'NID Photo Copy (Smart Card)',
    serviceLabelBn: 'এনআইডি ফটো কপি',
    paperSize: '4R (4x6 in)',
    paperFinish: 'glossy',
    copies: 4,
    colorMode: 'color',
    status: 'queued',
    targetPrinterId: 'printer_epson_l805',
    targetPrinterName: 'Epson EcoTank L805',
    routingReason: 'Capability Match: 6-Color Photo Inkjet for photo paper (4R)',
    priceBDT: 80,
    paymentMethod: 'bkash',
    paymentStatus: 'paid_mfs',
    fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
    fileName: 'nid_shakil_photo.jpg',
    fileSize: '1.4 MB',
    createdAt: Date.now() - 2 * 60 * 1000, // 2 minutes ago
    autoDeleteCountdownSeconds: 840,
    counterId: 'CTR-02',
    counterName: 'কাউন্টার ২ - ফটোকপি ও অনলাইন আবেদন',
    cropSettings: {
      zoom: 1,
      rotation: 0,
      brightness: 100,
      contrast: 100,
      aspectRatio: '4R',
    },
    gridCount: 4,
    auditLogs: [
      {
        id: 'log_1',
        timestamp: Date.now() - 2 * 60 * 1000,
        actor: 'customer',
        action: 'order_created',
        details: 'Order placed via Counter 2 QR PWA with bKash payment',
      },
      {
        id: 'log_2',
        timestamp: Date.now() - 2 * 60 * 1000,
        actor: 'system',
        action: 'auto_routed',
        details: 'Auto-routed to Epson EcoTank L805 on Master Server Host',
      },
    ],
  },
  {
    id: 'JOB-20261008-00126',
    tokenCode: '126',
    customerPhone: '01811-223344',
    customerName: 'Kazi Farhana',
    serviceType: 'doc_a4',
    serviceLabel: 'University Registration Form',
    serviceLabelBn: 'বিশ্ববিদ্যালয় ফরম ও চালান',
    paperSize: 'A4 (8.27x11.69 in)',
    paperFinish: 'normal',
    copies: 2,
    colorMode: 'bw',
    status: 'queued',
    targetPrinterId: 'printer_hp_laserjet',
    targetPrinterName: 'HP LaserJet Pro M404dn',
    routingReason: 'Capability Match: High-speed monochrome laser for A4 document',
    priceBDT: 10,
    paymentMethod: 'counter_cash',
    paymentStatus: 'unpaid',
    fileUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600&auto=format&fit=crop&q=80',
    fileName: 'admission_form.pdf',
    fileSize: '420 KB',
    createdAt: Date.now() - 6 * 60 * 1000,
    autoDeleteCountdownSeconds: 540,
    counterId: 'CTR-01',
    counterName: 'কাউন্টার ১ - মূল সার্ভার ও ক্যাশ ডেস্ক',
    auditLogs: [
      {
        id: 'log_3',
        timestamp: Date.now() - 6 * 60 * 1000,
        actor: 'customer',
        action: 'order_created',
        details: 'Order placed at Counter 1 with Pay at Counter option',
      },
    ],
  },
  {
    id: 'JOB-20261008-00125',
    tokenCode: '125',
    customerPhone: '01555-667788',
    customerName: 'Tanvir Hossain',
    serviceType: 'passport_photo',
    serviceLabel: 'Passport Photo (4-in-1)',
    serviceLabelBn: 'পাসপোর্ট ছবি (৪ কপি)',
    paperSize: 'Passport Grid (4-in-1)',
    paperFinish: 'glossy',
    copies: 1,
    colorMode: 'color',
    status: 'completed',
    targetPrinterId: 'printer_epson_l805',
    targetPrinterName: 'Epson EcoTank L805',
    routingReason: 'Capability Match: 6-Color Photo Inkjet',
    priceBDT: 50,
    paymentMethod: 'bkash',
    paymentStatus: 'paid_mfs',
    fileUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    fileName: 'passport_tanvir.png',
    fileSize: '2.1 MB',
    createdAt: Date.now() - 25 * 60 * 1000,
    completedAt: Date.now() - 22 * 60 * 1000,
    autoDeleteCountdownSeconds: 200,
    counterId: 'CTR-03',
    counterName: 'কাউন্টার ৩ - ডিজিটাল ফটো ও পাসপোর্ট স্টুডিও',
    auditLogs: [
      {
        id: 'log_4',
        timestamp: Date.now() - 25 * 60 * 1000,
        actor: 'customer',
        action: 'order_created',
        details: 'Order placed via Counter 3 QR PWA',
      },
      {
        id: 'log_5',
        timestamp: Date.now() - 24 * 60 * 1000,
        actor: 'shopkeeper',
        action: 'order_approved',
        details: 'Manual approval by shopkeeper',
      },
      {
        id: 'log_6',
        timestamp: Date.now() - 22 * 60 * 1000,
        actor: 'system',
        action: 'print_spooled',
        details: 'Physical print completed on shared Epson EcoTank L805',
      },
    ],
  },
];

const INSTALLATION_STORAGE_KEY = 'alif-shohoj-print-installation';
const SERVICES_STORAGE_KEY = 'alif-shohoj-print-studio-services';

const loadInstallationConfig = (): InstallationConfig | null => {
  try {
    const saved = readMigratedStorageValue(INSTALLATION_STORAGE_KEY, 'broxprint-installation');
    if (!saved) return null;

    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed !== 'object' || parsed === null || !('mode' in parsed) || !('counterId' in parsed)) {
      return null;
    }
    const config = parsed as InstallationConfig;
    if (config.mode !== 'master' && config.mode !== 'counter') return null;
    if (!INITIAL_COUNTERS.some(counter => counter.id === config.counterId)) return null;
    return config;
  } catch (error) {
    console.error('Could not read the saved installation setup.', error);
    return null;
  }
};

const isStudioService = (value: unknown): value is StudioService => {
  if (typeof value !== 'object' || value === null) return false;
  const service = value as Partial<StudioService>;
  const preferences = service.preferences;
  return (
    typeof service.id === 'string' &&
    typeof service.code === 'string' &&
    typeof service.title === 'string' &&
    typeof service.titleBn === 'string' &&
    typeof service.descriptionBn === 'string' &&
    typeof service.basePriceBDT === 'number' &&
    typeof service.enabled === 'boolean' &&
    typeof service.autoApprove === 'boolean' &&
    !!preferences &&
    ['plain', 'glossy', 'matte', 'laminated', 'heavy_cardstock'].includes(preferences.paperType) &&
    ['draft', 'normal', 'high', 'ultra_fine'].includes(preferences.quality) &&
    ['color', 'bw'].includes(preferences.color) &&
    typeof preferences.paperSize === 'string' &&
    typeof preferences.dpi === 'number' &&
    typeof preferences.defaultCopies === 'number' &&
    typeof preferences.borderless === 'boolean'
  );
};

const loadStudioServices = (): StudioService[] => {
  try {
    const saved = readMigratedStorageValue(SERVICES_STORAGE_KEY, 'broxprint-studio-services');
    if (!saved) return INITIAL_STUDIO_SERVICES;
    const parsed: unknown = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.every(isStudioService)) return parsed;
    console.warn('Saved studio services are invalid; restoring the defaults.');
    return INITIAL_STUDIO_SERVICES;
  } catch (error) {
    console.error('Could not read saved studio services.', error);
    return INITIAL_STUDIO_SERVICES;
  }
};

export type StudioView = 'windows_agent' | 'customer_pwa' | 'shop_pos';

interface StudioProviderProps {
  children: React.ReactNode;
  /**
   * Set by the dedicated renderer entries (desktop shell / customer PWA) so each
   * one opens on its own view instead of relying on a `?view=` query parameter.
   * The dev harness leaves this undefined and keeps reading the URL.
   */
  initialView?: StudioView;
}

export const StudioProvider: React.FC<StudioProviderProps> = ({ children, initialView }) => {
  const [activeView, setActiveView] = useState<StudioView>(() => {
    if (initialView) return initialView;
    const requestedView = new URLSearchParams(window.location.search).get('view');
    return requestedView === 'customer_pwa' ? 'customer_pwa' : 'shop_pos';
  });
  const [installationConfig, setInstallationConfig] = useState<InstallationConfig | null>(loadInstallationConfig);
  const isMaster = installationConfig?.mode !== 'counter';
  const [services, setServices] = useState<StudioService[]>(loadStudioServices);
  const [servicePersistenceError, setServicePersistenceError] = useState<string | null>(null);
  const [desktopQueueError, setDesktopQueueError] = useState<string | null>(null);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(() =>
    loadPersisted(SHOP_PROFILE_STORAGE_KEY, validators.shopProfile, INITIAL_SHOP_PROFILE)
  );
  const [printers, setPrinters] = useState<PrinterDevice[]>(() =>
    loadPersisted(PRINTERS_STORAGE_KEY, validators.printers, INITIAL_PRINTERS)
  );
  const [jobs, setJobs] = useState<PrintJob[]>(() => (import.meta.env.DEV ? INITIAL_JOBS : []));
  // Monotonic pickup-code sequence: seeded from loaded jobs so codes are never reused.
  const tokenSequenceRef = useRef<number>(0);
  // Always-fresh snapshot of jobs for callbacks that fire on timers (BUG-005).
  const jobsRef = useRef<PrintJob[]>(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  const [pricing, setPricing] = useState<ServicePricing>(() =>
    loadPersisted(PRICING_STORAGE_KEY, validators.pricing, INITIAL_PRICING)
  );
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState<boolean>(false);
  const [counters, setCounters] = useState<ShopCounter[]>(() =>
    loadPersisted(COUNTERS_STORAGE_KEY, validators.counters, INITIAL_COUNTERS)
  );
  const [activeCounterId, setActiveCounterId] = useState<string>(() =>
    installationConfig?.mode === 'counter'
      ? installationConfig.counterId
      : counters.find(counter => counter.code === new URLSearchParams(window.location.search).get('counter'))?.id || 'CTR-01'
  );

  // Active Toast Notification for Windows
  const [activeToast, setActiveToast] = useState<{
    job: PrintJob;
    title: string;
    message: string;
  } | null>(null);

  // Multi-Counter LAN Architecture states
  const [selectedPosterCounter, setSelectedPosterCounter] = useState<ShopCounter | null>(null);

  // Shared Network Hardware Scanners
  const [sharedScanners, setSharedScanners] = useState<SharedScannerDevice[]>(INITIAL_SHARED_SCANNERS);

  // Currently focused order card in modal/drawer
  const [activeOrderCardJob, setActiveOrderCardJob] = useState<PrintJob | null>(null);

  // Modals
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
  const [isExePackageModalOpen, setIsExePackageModalOpen] = useState(false);

  // Metrics (computed only from real job data — no hard-coded offsets)
  const todayPrintedCount = jobs.filter(j => j.status === 'completed').length;
  const todayEarningsBDT = jobs.filter(j => j.status === 'completed').reduce((acc, curr) => acc + curr.priceBDT, 0);
  const pendingJobsCount = jobs.filter(j => j.status === 'queued' || j.status === 'approved' || j.status === 'routing' || j.status === 'printing' || j.status === 'failed').length;

  // Ephemeral retention countdown ticker — only ticks jobs that are actually
  // eligible for deletion (completed/rejected). Pending jobs keep their value so
  // the UI never shows a "00:00 auto-delete" countdown on an order that waits for
  // approval (BUG-006), and a no-op guard avoids a full re-render per second when
  // nothing eligible is on screen.
  useEffect(() => {
    const timer = setInterval(() => {
      setJobs(tickJobRetention);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // BUG-007: count a counter's daily orders/earnings exactly once, when a job
  // finishes — not when it is created. Jobs restored from the desktop queue that
  // completed before this session started are skipped so persisted stats are never
  // double-counted across restarts.
  const countedCompletionIdsRef = useRef<Set<string>>(new Set());
  const sessionStartedAtRef = useRef<number>(Date.now());
  useEffect(() => {
    const newlyCompleted = collectNewlyCompleted(jobs, countedCompletionIdsRef.current, sessionStartedAtRef.current);
    if (newlyCompleted.length === 0) return;
    newlyCompleted.forEach(job => countedCompletionIdsRef.current.add(job.id));
    setCounters(prev =>
      prev.map(c => {
        const forThisCounter = newlyCompleted.filter(job => job.counterId === c.id);
        if (forThisCounter.length === 0) return c;
        return {
          ...c,
          todayOrdersCount: c.todayOrdersCount + forThisCounter.length,
          todayEarningsBDT: c.todayEarningsBDT + forThisCounter.reduce((sum, job) => sum + job.priceBDT, 0),
        };
      })
    );
  }, [jobs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(services));
      setServicePersistenceError(null);
    } catch (error) {
      console.error('Could not save studio services.', error);
      setServicePersistenceError('সার্ভিস সেটিংস সংরক্ষণ করা যায়নি। ব্রাউজারের স্টোরেজ পরীক্ষা করুন।');
    }
  }, [services]);

  // Persist renderer state across reloads (audit improvement #5). The desktop
  // queue itself is rehydrated from SQLite; these are the settings/stats that
  // used to snap back to demo values on every launch.
  useEffect(() => {
    savePersisted(COUNTERS_STORAGE_KEY, counters);
    savePersisted(PRINTERS_STORAGE_KEY, printers);
    savePersisted(PRICING_STORAGE_KEY, pricing);
    savePersisted(SHOP_PROFILE_STORAGE_KEY, shopProfile);
  }, [counters, printers, pricing, shopProfile]);

  useEffect(() => {
    const desktop = window.alifShohojPrintDesktop;
    if (desktop && isMaster) {
      void desktop.publishCustomerConfig({
        shopProfile: {
          id: shopProfile.id,
          name: shopProfile.name,
          nameBn: shopProfile.nameBn,
          code: shopProfile.code,
          phone: shopProfile.phone,
          address: shopProfile.address,
          bkashNumber: shopProfile.bkashNumber,
          nagadNumber: shopProfile.nagadNumber,
          voiceGuide: shopProfile.voiceGuide,
        },
        counters,
        printers,
        pricing,
        services,
      }).catch(error => console.error('Could not publish the customer PWA settings to the LAN gateway.', error));
    }
  }, [isMaster, shopProfile, counters, pricing, services]);

  useEffect(() => {
    if (window.alifShohojPrintDesktop || window.location.protocol === 'file:') return;
    void fetch('/api/customer-config')
      .then(async response => {
        if (!response.ok) return null;
        return await response.json() as CustomerAppConfig;
      })
      .then(config => {
        if (!config) return;
        setShopProfile(current => ({ ...current, ...config.shopProfile }));
        setCounters(config.counters);
        setPrinters(config.printers);
        setPricing(config.pricing);
        setServices(config.services);
      })
      .catch(error => console.warn('Customer app configuration is not available from the master PC.', error));
  }, []);

  useEffect(() => {
    const desktop = window.alifShohojPrintDesktop;
    if (!desktop || !isMaster) return;
    const counterIds = counters.filter(counter => !counter.isMasterHost).map(counter => counter.id);
    let cancelled = false;
    const refreshStatuses = () => {
      void desktop.getCounterStatuses(counterIds).then(statuses => {
        if (cancelled) return;
        const statusById = new Map(statuses.map(status => [status.counterId, status]));
        setCounters(current => {
          let changed = false;
          const updated = current.map(counter => {
            const heartbeat = statusById.get(counter.id);
            if (!heartbeat || (counter.isOnline === heartbeat.online && counter.lastSeenAt === heartbeat.lastSeenAt)) return counter;
            changed = true;
            return { ...counter, isOnline: heartbeat.online, lastSeenAt: heartbeat.lastSeenAt };
          });
          return changed ? updated : current;
        });
      }).catch(error => console.warn('Could not refresh counter heartbeat status.', error));
    };
    refreshStatuses();
    const timer = setInterval(refreshStatuses, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isMaster, counters.map(counter => counter.id).join(',')]);

  useEffect(() => {
    if (installationConfig?.mode !== 'counter' || !installationConfig.masterUrl || activeView === 'customer_pwa') return;
    const desktop = window.alifShohojPrintDesktop;
    const sendHeartbeat = () => {
      if (desktop) {
        void desktop.sendCounterHeartbeat(installationConfig.masterUrl!, installationConfig.counterId)
          .catch(error => console.warn('Could not send a counter heartbeat to the master PC.', error));
        return;
      }
      void fetch('/api/counter-heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: installationConfig.counterId }),
      }).catch(error => console.warn('Could not send a counter heartbeat to the master PC.', error));
    };
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 10_000);
    return () => clearInterval(timer);
  }, [installationConfig?.mode, installationConfig?.counterId, installationConfig?.masterUrl, activeView]);

  useEffect(() => {
    const desktop = window.alifShohojPrintDesktop;
    if (!desktop) return;

    const applyQueueJob = (queueJob: DesktopQueueJob) => {
      setDesktopQueueError(null);
      const queueJobView = {
        ...queueJob.job,
        status: queueJob.status === 'printing' || queueJob.status === 'completed'
          ? queueJob.status
          : queueJob.status === 'failed'
            ? 'failed' as const
            : queueJob.job.status === 'rejected'
              ? 'rejected' as const
              : queueJob.job.status === 'approved'
                ? 'approved' as const
                : 'queued' as const,
        ...(queueJob.error ? { printError: queueJob.error } : { printError: undefined }),
        ...(queueJob.status === 'completed' ? { completedAt: queueJob.updatedAt } : {}),
      };
      setJobs(prev => {
        const existingIndex = prev.findIndex(job => job.id === queueJob.job.id);
        if (existingIndex === -1) return [queueJobView, ...prev];
        return prev.map(job => job.id === queueJob.job.id
          ? { ...job, ...queueJobView, fileUrl: queueJob.job.fileUrl || job.fileUrl }
          : job);
      });
      setActiveOrderCardJob(prev => prev?.id === queueJob.job.id
        ? { ...prev, ...queueJobView, fileUrl: queueJob.job.fileUrl || prev.fileUrl }
        : prev);
    };

    const unsubscribeIncoming = desktop.onIncomingJob(job => {
      setJobs(prev => prev.some(existing => existing.id === job.id) ? prev : [job, ...prev]);
      const counterNumber = job.counterId?.match(/\d+/)?.[0];
      if (shopProfile.soundAlertEnabled) globalVoice.speakShopAlert(job.tokenCode, job.serviceLabelBn, counterNumber);
      else playIncomingOrderChime();
      setActiveToast({
        job,
        title: `নতুন অর্ডার #${job.tokenCode}`,
        message: `${job.serviceLabelBn}, ${job.paperSize} × ${job.copies} কপি`,
      });
    });
    const unsubscribeQueue = desktop.onQueueChanged(applyQueueJob);
    void desktop.listQueue().then(queue => queue.forEach(applyQueueJob)).catch(error => {
      console.error('Could not load the persisted desktop print queue.', error);
      setDesktopQueueError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeQueue();
    };
  }, [shopProfile.soundAlertEnabled]);

  const configureInstallation = (config: InstallationConfig): boolean => {
    if (
      (config.mode !== 'master' && config.mode !== 'counter') ||
      !counters.some(counter => counter.id === config.counterId)
    ) {
      return false;
    }

    try {
      window.localStorage.setItem(INSTALLATION_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Could not save the installation setup.', error);
      return false;
    }

    setInstallationConfig(config);
    setActiveCounterId(config.mode === 'master' ? 'CTR-01' : config.counterId);
    setActiveView('shop_pos');
    return true;
  };

  const updateShopProfile = (updates: Partial<ShopProfile>) => {
    setShopProfile(prev => ({ ...prev, ...updates }));
  };

  const updatePricing = (updates: Partial<ServicePricing>) => {
    setPricing(prev => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
      }
      return next;
    });
    setServices(prev =>
      prev.map(service => {
        const pricingKey = PRICING_KEY_BY_SERVICE[service.id];
        if (!pricingKey) return service;
        const value = updates[pricingKey];
        if (typeof value !== 'number' || !Number.isFinite(value)) return service;
        return value === service.basePriceBDT ? service : { ...service, basePriceBDT: value };
      })
    );
  };

  const createStudioService = (service: Omit<StudioService, 'id' | 'isCustom'>): boolean => {
    if (!isMaster) return false;
    const code = service.code.trim().toUpperCase();
    if (
      !service.title.trim() ||
      !service.titleBn.trim() ||
      !code ||
      !Number.isFinite(service.basePriceBDT) ||
      service.basePriceBDT < 0 ||
      !Number.isFinite(service.preferences.dpi) ||
      service.preferences.dpi < 1 ||
      !Number.isInteger(service.preferences.defaultCopies) ||
      service.preferences.defaultCopies < 1 ||
      services.some(existing => existing.code.toUpperCase() === code)
    ) {
      return false;
    }
    const id = `custom_${Date.now().toString(36)}`;
    setServices(prev => [...prev, { ...service, id, code, isCustom: true }]);
    return true;
  };

  const deleteStudioService = (serviceId: string): boolean => {
    if (!isMaster || !services.some(service => service.id === serviceId)) return false;
    setServices(prev => prev.filter(service => service.id !== serviceId));
    return true;
  };

  const toggleStudioService = (serviceId: string): boolean => {
    const service = services.find(item => item.id === serviceId);
    if (!isMaster || !service) return false;
    setServices(prev => prev.map(item => item.id === serviceId ? { ...item, enabled: !item.enabled } : item));
    return true;
  };

  const updateStudioService = (serviceId: string, updates: Partial<StudioService>): boolean => {
    const current = services.find(service => service.id === serviceId);
    if (!isMaster || !current) return false;
    const nextCode = updates.code?.trim().toUpperCase() ?? current.code;
    if (
      (updates.basePriceBDT !== undefined && (!Number.isFinite(updates.basePriceBDT) || updates.basePriceBDT < 0)) ||
      (updates.preferences?.dpi !== undefined && (!Number.isFinite(updates.preferences.dpi) || updates.preferences.dpi < 1)) ||
      (updates.preferences?.defaultCopies !== undefined &&
        (!Number.isInteger(updates.preferences.defaultCopies) || updates.preferences.defaultCopies < 1)) ||
      services.some(service => service.id !== serviceId && service.code.toUpperCase() === nextCode)
    ) {
      return false;
    }
    setServices(prev =>
      prev.map(service => service.id === serviceId
        ? {
            ...service,
            ...updates,
            id: service.id,
            code: nextCode,
            preferences: updates.preferences
              ? { ...service.preferences, ...updates.preferences }
              : service.preferences,
          }
        : service)
    );
    return true;
  };

  const togglePrinterStatus = (id: string) => {
    setPrinters(prev =>
      prev.map(p => {
        if (p.id === id) {
          const nextStatus = p.status === 'online' ? 'offline' : 'online';
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );
  };

  const refillPrinterPaper = (id: string) => {
    setPrinters(prev =>
      prev.map(p => (p.id === id ? { ...p, paperCount: p.type === 'laser_bw' ? 250 : 100 } : p))
    );
  };

  const refillPrinterInk = (id: string) => {
    setPrinters(prev =>
      prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            inkLevels: {
              black: 100,
              cyan: p.inkLevels.cyan !== undefined ? 100 : undefined,
              magenta: p.inkLevels.magenta !== undefined ? 100 : undefined,
              yellow: p.inkLevels.yellow !== undefined ? 100 : undefined,
            },
          };
        }
        return p;
      })
    );
  };

  const dismissToast = () => {
    setActiveToast(null);
  };

  // Create new Customer Job from PWA
  const createCustomerJob = (
    newJobData: Omit<PrintJob, 'id' | 'createdAt' | 'status' | 'auditLogs' | 'autoDeleteCountdownSeconds' | 'targetPrinterId' | 'targetPrinterName' | 'routingReason'>
  ): PrintJob => {
    const isRemoteCustomerPwa = !window.alifShohojPrintDesktop && activeView === 'customer_pwa';
    const studioService = services.find(service => service.id === newJobData.serviceType);
    if (!studioService || !studioService.enabled) {
      throw new Error('This studio service is unavailable.');
    }
    const nextToken = nextTokenNumber(jobs.map(job => job.tokenCode), tokenSequenceRef.current);
    tokenSequenceRef.current = nextToken;
    const tokenCode = String(nextToken);
    const id = createJobId();

    // Auto Route using Printer Capability Matcher
    const routing = matchPrinterForJob(newJobData.serviceType, newJobData.paperSize, newJobData.colorMode, printers);

    // Check shop owner's custom default printer assignment
    const customPrinterId = studioService.preferredPrinterId;
    const customPrinter = printers.find(p => p.id === customPrinterId && p.status === 'online');

    const routingTargetId = customPrinter ? customPrinter.id : routing.printerId;
    const routingTargetName = customPrinter ? customPrinter.name : routing.printerName;
    const routingReasonText = customPrinter
      ? `মালিকের অ্যাসাইনকৃত ডিফল্ট প্রিন্টার (${customPrinter.name})`
      : routing.reason;

    // Counter determination
    const targetCounterId = newJobData.counterId || activeCounterId;
    const targetCounter = counters.find(c => c.id === targetCounterId) || counters[0];
    const isTargetCounterOffline = !targetCounter.isMasterHost && targetCounter.isOnline !== true;

    // Offline counters always require the master operator to review the order.
    const isAutoApprovable = studioService.autoApprove && !isTargetCounterOffline;
    const initialStatus: JobStatus = isAutoApprovable ? 'approved' : 'queued';

    const newJob: PrintJob = {
      ...newJobData,
      id,
      tokenCode,
      createdAt: Date.now(),
      status: initialStatus,
      targetPrinterId: routingTargetId,
      targetPrinterName: routingTargetName,
      routingReason: routingReasonText,
      printingPreferences: {
        ...studioService.preferences,
        color: newJobData.colorMode,
        paperSize: newJobData.paperSize,
        defaultCopies: newJobData.copies,
      },
      autoDeleteCountdownSeconds: 900, // 15 mins
      counterId: targetCounter.id,
      counterName: targetCounter.name,
      auditLogs: [
        {
          id: `log_${Date.now()}_create`,
          timestamp: Date.now(),
          actor: 'customer',
          action: 'order_created',
          details: `Order submitted at ${targetCounter.name} for ${newJobData.serviceLabelBn} (${newJobData.copies} copies)`,
        },
        {
          id: `log_${Date.now()}_route`,
          timestamp: Date.now(),
          actor: 'system',
          action: 'capability_match',
          details: routingReasonText,
        },
        ...(isAutoApprovable
          ? [
              {
                id: `log_${Date.now()}_autoapp`,
                timestamp: Date.now(),
                actor: 'system' as const,
                action: 'service_auto_approved',
                details: `সার্ভিস-লেভেল অটো-অ্যাপ্রুভ: ম্যানুয়াল অনুমোদন বাইপাস করে সরাসরি ${routingTargetName}-এ স্পুল কিউতে পাঠানো হয়েছে`,
              },
            ]
          : []),
        ...(isTargetCounterOffline
          ? [{
              id: `log_${Date.now()}_counter_offline`,
              timestamp: Date.now(),
              actor: 'system' as const,
              action: 'counter_offline_master_review',
              details: `${targetCounter.name} is offline; the order was held for master review.`,
            }]
          : []),
      ],
    };

    if (!isRemoteCustomerPwa) setJobs(prev => [newJob, ...prev]);

    // Counter stats are no longer incremented here — they are counted once when a
    // job actually completes (see the completion-counting effect above), so a
    // rejected or failed order never inflates the counter's daily numbers (BUG-007).

    // Update printer queue counter
    if (!isRemoteCustomerPwa) {
      setPrinters(prev =>
        prev.map(p => (p.id === routingTargetId ? { ...p, queueCount: p.queueCount + 1 } : p))
      );
    }

    // Audio Chime & Bengali Voice Alert
    if (!isRemoteCustomerPwa) {
      if (shopProfile.soundAlertEnabled) {
        globalVoice.speakShopAlert(tokenCode, newJobData.serviceLabelBn, targetCounter.id.match(/\d+/)?.[0]);
      } else {
        playIncomingOrderChime();
      }
    }

    // Show Windows Toast Banner
    if (!isRemoteCustomerPwa) {
      setActiveToast({
        job: newJob,
        title: `নতুন অর্ডার #${tokenCode}`,
        message: `${newJob.serviceLabelBn}, ${newJob.paperSize} × ${newJob.copies} কপি`,
      });
    }

    // If auto-approved, trigger print simulation
    if (window.alifShohojPrintDesktop) {
      const desktop = window.alifShohojPrintDesktop;
      void desktop.listPrinters().then(async windowsPrinters => {
        const printerName = windowsPrinters.includes(newJob.targetPrinterName)
          ? newJob.targetPrinterName
          : windowsPrinters[0];
        if (!printerName) throw new Error('এই Windows PC-তে কোনো প্রিন্টার পাওয়া যায়নি।');
        const desktopJob = {
          ...newJob,
          targetPrinterId: `windows:${printerName}`,
          targetPrinterName: printerName,
        };
        setJobs(prev => prev.map(job => job.id === newJob.id ? desktopJob : job));
        await desktop.saveJob(desktopJob);
        if (isAutoApprovable) await desktop.printJob(newJob.id);
      }).catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Could not persist or print the new desktop job.', error);
        setJobs(prev => prev.map(job => job.id === newJob.id ? { ...job, printError: message } : job));
      });
    } else if (isAutoApprovable && !isRemoteCustomerPwa) {
      setTimeout(() => executePrint(newJob.id), 1500);
    }

    return newJob;
  };

  const executePrint = (jobId: string) => {
    // Transition to printing
    setJobs(prev =>
      prev.map(j => {
        if (j.id === jobId) {
          return {
            ...j,
            status: 'printing',
            auditLogs: [
              ...j.auditLogs,
              {
                id: `log_${Date.now()}_spool`,
                timestamp: Date.now(),
                actor: 'system',
                action: 'spooling_to_printer',
                details: `Spooling to ${j.targetPrinterName}`,
              },
            ],
          };
        }
        return j;
      })
    );

    // Complete after 3.5 seconds
    setTimeout(() => {
      setJobs(prev =>
        prev.map(j => {
          if (j.id === jobId) {
            playPrintCompleteChime();
            return {
              ...j,
              status: 'completed',
              completedAt: Date.now(),
              paymentStatus: j.paymentStatus === 'unpaid' ? 'paid_counter' : j.paymentStatus,
              auditLogs: [
                ...j.auditLogs,
                {
                  id: `log_${Date.now()}_complete`,
                  timestamp: Date.now(),
                  actor: 'system',
                  action: 'print_completed',
                  details: 'Physical print finished successfully',
                },
              ],
            };
          }
          return j;
        })
      );

      // Decrement printer queue count & paper count (read the job from jobsRef so
      // edits made during the 3.5 s window are not lost to a stale closure)
      setPrinters(prev =>
        prev.map(p => {
          const matchingJob = jobsRef.current.find(j => j.id === jobId);
          if (matchingJob && p.id === matchingJob.targetPrinterId) {
            return {
              ...p,
              queueCount: Math.max(0, p.queueCount - 1),
              paperCount: Math.max(0, p.paperCount - matchingJob.copies),
            };
          }
          return p;
        })
      );
    }, 3500);
  };

  const approveJob = (jobId: string) => {
    const jobToPrint = jobs.find(job => job.id === jobId);
    const approvedAt = Date.now();
    setJobs(prev => prev.map(j => (j.id === jobId ? approveJobTransition(j, approvedAt) : j)));

    // Dismiss toast if this job was active
    if (activeToast?.job.id === jobId) {
      dismissToast();
    }

    if (window.alifShohojPrintDesktop && jobToPrint) {
      const approvedJob = { ...jobToPrint, status: 'approved' as const };
      void window.alifShohojPrintDesktop.listPrinters()
        .then(windowsPrinters => {
          if (!windowsPrinters.includes(approvedJob.targetPrinterName)) {
            throw new Error('অর্ডারের প্রিন্টারটি Windows-এ পাওয়া যায়নি। অর্ডার এডিট করে একটি Windows প্রিন্টার নির্বাচন করুন।');
          }
          return window.alifShohojPrintDesktop?.saveJob(approvedJob);
        })
        .then(() => window.alifShohojPrintDesktop?.printJob(jobId))
        .catch(error => {
          const message = error instanceof Error ? error.message : String(error);
          console.error('Could not print the approved desktop job.', error);
          setJobs(prev => prev.map(job => job.id === jobId ? { ...job, status: 'queued', printError: message } : job));
          setActiveOrderCardJob(prev => prev?.id === jobId ? { ...prev, status: 'queued', printError: message } : prev);
        });
    } else {
      setTimeout(() => executePrint(jobId), 800);
    }
  };

  const rejectJob = (jobId: string, reason: RejectReason, note?: string) => {
    const jobToReject = jobs.find(job => job.id === jobId);
    const rejectedAt = Date.now();
    setJobs(prev => prev.map(j => (j.id === jobId ? rejectJobTransition(j, reason, note, rejectedAt) : j)));

    if (activeToast?.job.id === jobId) {
      dismissToast();
    }

    // Persist the rejection by removing the row from the desktop SQLite queue so a
    // reload cannot resurrect the job as "queued" (BUG-004). Jobs that are already
    // printing or completed are left for the desktop print pipeline to finish.
    if (
      window.alifShohojPrintDesktop &&
      jobToReject &&
      (jobToReject.status === 'queued' || jobToReject.status === 'approved' || jobToReject.status === 'routing')
    ) {
      void window.alifShohojPrintDesktop.removeJob(jobId).catch(error => {
        console.error('Could not remove the rejected job from the desktop print queue.', error);
      });
    }
  };

  const editJob = (jobId: string, updates: Partial<PrintJob>, auditNote: string) => {
    const auditLog = {
      id: `log_${Date.now()}_edit`,
      timestamp: Date.now(),
      actor: 'shopkeeper' as const,
      action: 'order_modified',
      details: auditNote,
    };

    setJobs(prev =>
      prev.map(j => {
        if (j.id === jobId) {
          return {
            ...j,
            ...updates,
            auditLogs: [...j.auditLogs, auditLog],
          };
        }
        return j;
      })
    );
    setActiveOrderCardJob(prev =>
      prev?.id === jobId
        ? { ...prev, ...updates, auditLogs: [...prev.auditLogs, auditLog] }
        : prev
    );
    const currentJob = jobs.find(job => job.id === jobId);
    if (window.alifShohojPrintDesktop && currentJob && currentJob.status !== 'rejected') {
      void window.alifShohojPrintDesktop.saveJob({ ...currentJob, ...updates, auditLogs: [...currentJob.auditLogs, auditLog] })
        .catch(error => console.error('Could not update the persisted desktop print job.', error));
    }
  };

  const rerouteJob = (jobId: string, printerId: string) => {
    const targetPrinter = printers.find(p => p.id === printerId);
    if (!targetPrinter) return;

    setJobs(prev =>
      prev.map(j => {
        if (j.id === jobId) {
          return {
            ...j,
            targetPrinterId: targetPrinter.id,
            targetPrinterName: targetPrinter.name,
            routingReason: `Manual operator override to ${targetPrinter.name}`,
            auditLogs: [
              ...j.auditLogs,
              {
                id: `log_${Date.now()}_reroute`,
                timestamp: Date.now(),
                actor: 'shopkeeper',
                action: 'manual_reroute',
                details: `Rerouted to ${targetPrinter.name}`,
              },
            ],
          };
        }
        return j;
      })
    );
  };

  const triggerTestPrint = (printerId: string) => {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) return;

    const testJob: PrintJob = {
      id: `JOB-TEST-${Date.now().toString(36)}`,
      tokenCode: 'TST',
      customerPhone: '01700-000000',
      customerName: 'Diagnostic Test Pattern',
      serviceType: 'doc_a4',
      serviceLabel: 'Windows Diagnostic Alignment Page',
      serviceLabelBn: 'ডায়াগনস্টিক টেস্ট পেজ',
      paperSize: 'A4 (8.27x11.69 in)',
      paperFinish: 'normal',
      copies: 1,
      colorMode: printer.colorCapability === 'color' ? 'color' : 'bw',
      status: 'printing',
      targetPrinterId: printer.id,
      targetPrinterName: printer.name,
      routingReason: 'Windows Diagnostic Self-Test',
      priceBDT: 0,
      paymentMethod: 'counter_cash',
      paymentStatus: 'paid_counter',
      fileUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600&auto=format&fit=crop&q=80',
      fileName: 'test_pattern.pdf',
      fileSize: '85 KB',
      createdAt: Date.now(),
      autoDeleteCountdownSeconds: 120,
      auditLogs: [
        {
          id: `log_${Date.now()}_test`,
          timestamp: Date.now(),
          actor: 'system',
          action: 'test_print_initiated',
          details: 'Printer hardware diagnostic pattern spooled',
        },
      ],
    };

    setJobs(prev => [testJob, ...prev]);

    setTimeout(() => {
      playPrintCompleteChime();
      setJobs(prev =>
        prev.map(j => (j.id === testJob.id ? { ...j, status: 'completed', completedAt: Date.now() } : j))
      );
    }, 2500);
  };

  const addNewPrinter = (newPrinter: Omit<PrinterDevice, 'id' | 'queueCount'>) => {
    const id = `printer_${newPrinter.brand.toLowerCase()}_${Date.now().toString().slice(-4)}`;
    const fullPrinter: PrinterDevice = {
      ...newPrinter,
      id,
      queueCount: 0,
    };
    setPrinters(prev => [...prev, fullPrinter]);
  };

  const removePrinter = (printerId: string) => {
    setPrinters(prev => prev.filter(p => p.id !== printerId));
  };

  // Real Windows spooler scan (audit improvement #4): diff the names returned by
  // Electron's desktop.listPrinters() against the printer registry instead of
  // inventing a fake device after a timeout.
  const scanLocalPrinters = async (): Promise<number> => {
    const desktop = window.alifShohojPrintDesktop;
    if (!desktop) {
      throw new Error('উইন্ডোজ ডেস্কটপ এজেন্ট সংযুক্ত নয় — স্পুলার স্ক্যান শুধু ডেস্কটপ অ্যাপে উপলব্ধ।');
    }

    const windowsPrinters = await desktop.listPrinters();
    const knownNames = printers.map(p => p.name);
    const isAlreadyRegistered = (name: string) =>
      knownNames.some(known => known === name || known.includes(name) || name.includes(known));
    // Virtual destinations (PDF writers, fax, OneNote…) would clutter a print
    // shop's physical printer list, so they are not auto-registered.
    const isVirtualDestination = (name: string) =>
      /print to pdf|save as pdf|xps|onenote|fax|google (cloud )?print|adobe pdf|microsoft writer/i.test(name);

    const detectedBrand = (name: string): PrinterDevice['brand'] => {
      const match = (['Epson', 'HP', 'Canon', 'Brother', 'Pantum', 'Samsung', 'Ricoh', 'Konica Minolta', 'Lexmark', 'Xerox', 'Kyocera'] as const)
        .find(brand => name.toLowerCase().startsWith(brand.toLowerCase()));
      return match ?? 'Other';
    };

    const additions = windowsPrinters
      .filter(name => !isAlreadyRegistered(name) && !isVirtualDestination(name))
      .map((name, index): PrinterDevice => {
        const brand = detectedBrand(name);
        const isLaser = /laser|mono|deskjet.*mfp/i.test(name);
        const model = (brand !== 'Other' && name.toLowerCase().startsWith(brand.toLowerCase())
          ? name.slice(brand.length)
          : name).trim() || name;
        return {
          id: `printer_spooler_${Date.now().toString(36)}_${index}`,
          name,
          brand,
          model,
          type: isLaser ? 'laser_bw' : 'color_inkjet',
          status: 'online',
          supportedPaperSizes: isLaser
            ? ['A4 (8.27x11.69 in)', 'Legal']
            : ['A4 (8.27x11.69 in)', '4R (4x6 in)', 'Legal'],
          colorCapability: isLaser ? 'bw_only' : 'color',
          queueCount: 0,
          inkLevels: isLaser
            ? { black: 100 }
            : { black: 100, cyan: 100, magenta: 100, yellow: 100 },
          paperCount: 200,
          description: 'স্ক্যানে শনাক্তকৃত Windows spooler ডিভাইস',
        };
      });

    if (additions.length > 0) {
      setPrinters(prev => {
        const prevNames = new Set(prev.map(p => p.name));
        const fresh = additions.filter(device => !prevNames.has(device.name));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    }
    return additions.length;
  };

  const restartLocalServer = () => {
    setShopProfile(prev => ({
      ...prev,
      localServer: {
        ...prev.localServer,
        status: 'restarting',
      },
    }));

    setTimeout(() => {
      setShopProfile(prev => ({
        ...prev,
        localServer: {
          ...prev.localServer,
          status: 'running',
          uptimeSeconds: 0,
        },
      }));
    }, 1500);
  };

  const addCounter = (newCounterData: Omit<ShopCounter, 'todayOrdersCount' | 'todayEarningsBDT'>) => {
    const newCounter: ShopCounter = {
      ...newCounterData,
      todayOrdersCount: 0,
      todayEarningsBDT: 0,
    };
    setCounters(prev => [...prev, newCounter]);
  };

  const updateCounter = (id: string, updates: Partial<ShopCounter>) => {
    setCounters(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteCounter = (id: string) => {
    // Master Host cannot be deleted
    setCounters(prev => prev.filter(c => c.id !== id || c.isMasterHost));
  };

  // Renders a local mock "scanned document" as a JPEG data URL. The desktop
  // queue/print pipeline only accepts data: URLs (and works offline), so the LAN
  // scan flow must not hand it a remote https:// image (SEC: IPC validation parity).
  const renderMockScanSample = (): string => {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 1240; // A4 @ 150 dpi
    canvas.height = 1754;
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.fillStyle = '#e7e2d6';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(80, 80, canvas.width - 160, canvas.height - 160);
    context.fillStyle = '#111827';
    context.font = 'bold 56px sans-serif';
    context.fillText('SCANNED DOCUMENT', 150, 230);
    context.fillStyle = '#94a3b8';
    context.fillRect(150, 270, 760, 8);
    context.fillStyle = '#cbd5e1';
    for (let line = 0; line < 24; line += 1) {
      const width = line % 5 === 4 ? 430 : 920 + (line % 3) * 40;
      context.fillRect(150, 340 + line * 54, width, 14);
    }
    context.strokeStyle = '#dc2626';
    context.lineWidth = 6;
    context.strokeRect(870, 1400, 240, 240);
    context.fillStyle = '#dc2626';
    context.font = 'bold 42px sans-serif';
    context.fillText('SCAN', 915, 1545);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const triggerNetworkScan = async (scannerId: string, counterId: string): Promise<{ sampleUrl: string; dpi: number }> => {
    setSharedScanners(prev =>
      prev.map(s => (s.id === scannerId ? { ...s, status: 'scanning' } : s))
    );

    return new Promise(resolve => {
      setTimeout(() => {
        setSharedScanners(prev =>
          prev.map(s => (s.id === scannerId ? { ...s, status: 'ready', lastScannedAt: Date.now() } : s))
        );

        resolve({ sampleUrl: renderMockScanSample(), dpi: 600 });
      }, 2200);
    });
  };

  return (
    <StudioContext.Provider
      value={{
        activeView,
        setActiveView,
        installationConfig,
        isMaster,
        configureInstallation,
        shopProfile,
        updateShopProfile,
        printers,
        togglePrinterStatus,
        refillPrinterPaper,
        refillPrinterInk,
        jobs,
        todayPrintedCount,
        todayEarningsBDT,
        pendingJobsCount,
        activeOrderCardJob,
        setActiveOrderCardJob,
        desktopQueueError,
        createCustomerJob,
        approveJob,
        rejectJob,
        editJob,
        rerouteJob,
        triggerTestPrint,
        services,
        servicePersistenceError,
        createStudioService,
        deleteStudioService,
        toggleStudioService,
        updateStudioService,
        addNewPrinter,
        removePrinter,
        scanLocalPrinters,
        counters,
        activeCounterId,
        setActiveCounterId,
        addCounter,
        updateCounter,
        deleteCounter,
        selectedPosterCounter,
        setSelectedPosterCounter,
        sharedScanners,
        triggerNetworkScan,
        restartLocalServer,
        pricing,
        updatePricing,
        activeToast,
        dismissToast,
        isPosterModalOpen,
        setIsPosterModalOpen,
        isExePackageModalOpen,
        setIsExePackageModalOpen,
        voiceGuideEnabled,
        setVoiceGuideEnabled,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within StudioProvider');
  }
  return context;
};
