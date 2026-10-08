import { PaperSize, ColorMode, PrinterDevice } from '../../../shared/types';
import { DriverProtocol } from './IPrinterDriver';

export interface PaperSizeSpecification {
  id: PaperSize | string;
  name: string;
  nameBn: string;
  widthMm: number;
  heightMm: number;
  widthInches: number;
  heightInches: number;
  isBorderlessSupported: boolean;
  minWeightGsm: number;
  maxWeightGsm: number;
}

export interface ColorModeSpecification {
  mode: ColorMode;
  name: string;
  colorModel: 'Monochrome' | 'CMYK_4Color' | 'Photo_6Color';
  bitsPerPixel: number;
  iccProfileName: string;
}

export interface PaperFeedTray {
  id: string;
  name: string;
  capacitySheets: number;
  supportedSizes: (PaperSize | string)[];
  mediaTypes: string[];
}

export interface PrinterCapabilities {
  driverId: string;
  protocol: DriverProtocol;
  vendor: 'Epson' | 'HP' | 'Canon' | 'Generic';
  supportedPaperSizes: PaperSizeSpecification[];
  colorModes: ColorModeSpecification[];
  dpiOptions: number[];
  defaultDpi: number;
  photoDpi: number;
  duplexSupported: boolean;
  borderlessSupported: boolean;
  borderlessPaperSizes: (PaperSize | string)[];
  maxCopiesPerJob: number;
  supportedMediaTypes: {
    id: string;
    label: string;
    labelBn: string;
    recommendedDpi: number;
  }[];
  feedTrays: PaperFeedTray[];
  hardwareSpeedPPM: {
    monoDraft: number;
    colorNormal: number;
    photoHighResSecondsPerPrint: number;
  };
}

/**
 * Standard paper specifications dictionary for Bangladeshi Studio operations
 */
export const STANDARD_PAPER_SPECS: Record<string, PaperSizeSpecification> = {
  '4R (4x6 in)': {
    id: '4R (4x6 in)',
    name: '4R Studio Photo Paper',
    nameBn: '৪-আর স্টুডিও ফটো পেপার (৪×৬ ইঞ্চি)',
    widthMm: 101.6,
    heightMm: 152.4,
    widthInches: 4.0,
    heightInches: 6.0,
    isBorderlessSupported: true,
    minWeightGsm: 180,
    maxWeightGsm: 300,
  },
  'Passport Grid (4-in-1)': {
    id: 'Passport Grid (4-in-1)',
    name: 'Passport Photo 4-in-1 Tile (35x45mm Grid)',
    nameBn: 'পাসপোর্ট সাইজ ৪ কপি শিট',
    widthMm: 101.6,
    heightMm: 152.4,
    widthInches: 4.0,
    heightInches: 6.0,
    isBorderlessSupported: true,
    minWeightGsm: 200,
    maxWeightGsm: 260,
  },
  'Passport Grid (8-in-1)': {
    id: 'Passport Grid (8-in-1)',
    name: 'Passport Photo 8-in-1 Tile (35x45mm Grid)',
    nameBn: 'পাসপোর্ট সাইজ ৮ কপি শিট',
    widthMm: 127.0,
    heightMm: 177.8,
    widthInches: 5.0,
    heightInches: 7.0,
    isBorderlessSupported: true,
    minWeightGsm: 200,
    maxWeightGsm: 260,
  },
  'A4 (8.27x11.69 in)': {
    id: 'A4 (8.27x11.69 in)',
    name: 'A4 Standard International',
    nameBn: 'A4 সাধারণ কাগজ',
    widthMm: 210.0,
    heightMm: 297.0,
    widthInches: 8.27,
    heightInches: 11.69,
    isBorderlessSupported: true,
    minWeightGsm: 65,
    maxWeightGsm: 220,
  },
  'Stamp Size': {
    id: 'Stamp Size',
    name: 'Stamp Photo Grid (20x25mm)',
    nameBn: 'স্ট্যাম্প সাইজ ছবি শিট',
    widthMm: 101.6,
    heightMm: 152.4,
    widthInches: 4.0,
    heightInches: 6.0,
    isBorderlessSupported: true,
    minWeightGsm: 180,
    maxWeightGsm: 260,
  },
  Legal: {
    id: 'Legal',
    name: 'US Legal (Deed / Stamp Paper)',
    nameBn: 'লিগ্যাল দলিল বা স্ট্যাম্প পেপার',
    widthMm: 215.9,
    heightMm: 355.6,
    widthInches: 8.5,
    heightInches: 14.0,
    isBorderlessSupported: false,
    minWeightGsm: 75,
    maxWeightGsm: 120,
  },
};

/**
 * Driver-specific capability matrices
 */
const DRIVER_CAPABILITIES_MAP: Record<string, PrinterCapabilities> = {
  driver_epson_esc_pr: {
    driverId: 'driver_epson_esc_pr',
    protocol: 'esc_p_r',
    vendor: 'Epson',
    supportedPaperSizes: [
      STANDARD_PAPER_SPECS['4R (4x6 in)'],
      STANDARD_PAPER_SPECS['Passport Grid (4-in-1)'],
      STANDARD_PAPER_SPECS['Passport Grid (8-in-1)'],
      STANDARD_PAPER_SPECS['Stamp Size'],
      STANDARD_PAPER_SPECS['A4 (8.27x11.69 in)'],
    ],
    colorModes: [
      {
        mode: 'color',
        name: 'Micro-Piezo 6-Color High Gloss Photo',
        colorModel: 'Photo_6Color', // CMYK + Light Cyan + Light Magenta
        bitsPerPixel: 48,
        iccProfileName: 'Epson_UltraGlossy_L805_v2.icc',
      },
      {
        mode: 'bw',
        name: 'Monochrome Neutral Photo Tone',
        colorModel: 'Monochrome',
        bitsPerPixel: 16,
        iccProfileName: 'Epson_NeutralBW.icc',
      },
    ],
    dpiOptions: [720, 1440, 2880, 5760],
    defaultDpi: 1440,
    photoDpi: 5760,
    duplexSupported: false,
    borderlessSupported: true,
    borderlessPaperSizes: ['4R (4x6 in)', 'Passport Grid (4-in-1)', 'Passport Grid (8-in-1)', 'Stamp Size', 'A4 (8.27x11.69 in)'],
    maxCopiesPerJob: 99,
    supportedMediaTypes: [
      { id: 'ultra_glossy', label: 'Epson Ultra Glossy Photo Film', labelBn: 'আল্ট্রা গ্লসি ফটো পেপার', recommendedDpi: 5760 },
      { id: 'premium_semigloss', label: 'Premium Semigloss Photo', labelBn: 'সেমি-গ্লসি ফটো পেপার', recommendedDpi: 2880 },
      { id: 'matte_card', label: 'Heavyweight Matte Card (250gsm)', labelBn: 'ম্যাট আর্ট কার্ড', recommendedDpi: 1440 },
      { id: 'plain_paper', label: 'Plain Inkjet Bond Paper', labelBn: 'সাধারণ পেপার', recommendedDpi: 720 },
    ],
    feedTrays: [
      {
        id: 'tray_rear_feed',
        name: 'Top Rear Friction Feeder',
        capacitySheets: 100,
        supportedSizes: ['4R (4x6 in)', 'Passport Grid (4-in-1)', 'Passport Grid (8-in-1)', 'Stamp Size', 'A4 (8.27x11.69 in)'],
        mediaTypes: ['ultra_glossy', 'premium_semigloss', 'matte_card', 'plain_paper'],
      },
    ],
    hardwareSpeedPPM: {
      monoDraft: 37,
      colorNormal: 38,
      photoHighResSecondsPerPrint: 12, // 12 seconds per 4R photo on L805
    },
  },

  driver_hp_pcl6: {
    driverId: 'driver_hp_pcl6',
    protocol: 'pcl6',
    vendor: 'HP',
    supportedPaperSizes: [
      STANDARD_PAPER_SPECS['A4 (8.27x11.69 in)'],
      STANDARD_PAPER_SPECS['Legal'],
    ],
    colorModes: [
      {
        mode: 'bw',
        name: 'HP FastRes 1200 Monochrome',
        colorModel: 'Monochrome',
        bitsPerPixel: 8,
        iccProfileName: 'HP_LaserJet_DefaultMono.icc',
      },
    ],
    dpiOptions: [600, 1200],
    defaultDpi: 1200,
    photoDpi: 1200,
    duplexSupported: true, // Automatic double-sided printing
    borderlessSupported: false,
    borderlessPaperSizes: [],
    maxCopiesPerJob: 999,
    supportedMediaTypes: [
      { id: 'plain_paper', label: 'HP Laser 80gsm Bond Paper', labelBn: 'লেজার ৮০ জিএসএম পেপার', recommendedDpi: 1200 },
      { id: 'recycled_paper', label: 'Standard Recycled 75gsm', labelBn: 'রিসাইকেলড পেপার', recommendedDpi: 600 },
      { id: 'stamp_paper', label: 'Legal Deed / Stamp Paper (100gsm)', labelBn: 'স্ট্যাম্প পেপার', recommendedDpi: 1200 },
    ],
    feedTrays: [
      {
        id: 'tray_2_internal',
        name: 'Internal Paper Cassette Tray 2',
        capacitySheets: 250,
        supportedSizes: ['A4 (8.27x11.69 in)', 'Legal'],
        mediaTypes: ['plain_paper', 'recycled_paper'],
      },
      {
        id: 'tray_1_multipurpose',
        name: 'Multipurpose Fold-out Tray 1',
        capacitySheets: 100,
        supportedSizes: ['A4 (8.27x11.69 in)', 'Legal'],
        mediaTypes: ['plain_paper', 'stamp_paper'],
      },
    ],
    hardwareSpeedPPM: {
      monoDraft: 40,
      colorNormal: 0,
      photoHighResSecondsPerPrint: 0, // Not a photo printer
    },
  },

  driver_canon_bjnp: {
    driverId: 'driver_canon_bjnp',
    protocol: 'bjnp_canon',
    vendor: 'Canon',
    supportedPaperSizes: [
      STANDARD_PAPER_SPECS['A4 (8.27x11.69 in)'],
      STANDARD_PAPER_SPECS['4R (4x6 in)'],
      STANDARD_PAPER_SPECS['Legal'],
    ],
    colorModes: [
      {
        mode: 'color',
        name: 'Canon Hybrid 4-Color FINE Tank',
        colorModel: 'CMYK_4Color',
        bitsPerPixel: 32,
        iccProfileName: 'Canon_G3010_ColorV4.icc',
      },
      {
        mode: 'bw',
        name: 'Pigment Black Monochrome',
        colorModel: 'Monochrome',
        bitsPerPixel: 8,
        iccProfileName: 'Canon_PigmentBlack.icc',
      },
    ],
    dpiOptions: [600, 1200, 4800],
    defaultDpi: 1200,
    photoDpi: 4800,
    duplexSupported: false,
    borderlessSupported: true,
    borderlessPaperSizes: ['4R (4x6 in)', 'A4 (8.27x11.69 in)'],
    maxCopiesPerJob: 99,
    supportedMediaTypes: [
      { id: 'plain_paper', label: 'Plain Paper (64-105 g/m2)', labelBn: 'সাধারণ পেপার', recommendedDpi: 1200 },
      { id: 'photo_plus_glossy', label: 'Photo Paper Plus Glossy II', labelBn: 'গ্লসি ফটো পেপার', recommendedDpi: 4800 },
      { id: 'matte_photo', label: 'Matte Photo Paper (MP-101)', labelBn: 'ম্যাট ফটো পেপার', recommendedDpi: 1200 },
    ],
    feedTrays: [
      {
        id: 'tray_rear',
        name: 'Rear Tray',
        capacitySheets: 100,
        supportedSizes: ['A4 (8.27x11.69 in)', '4R (4x6 in)', 'Legal'],
        mediaTypes: ['plain_paper', 'photo_plus_glossy', 'matte_photo'],
      },
    ],
    hardwareSpeedPPM: {
      monoDraft: 8.8,
      colorNormal: 5.0,
      photoHighResSecondsPerPrint: 60,
    },
  },

  driver_win32_gdi_generic: {
    driverId: 'driver_win32_gdi_generic',
    protocol: 'windows_gdi',
    vendor: 'Generic',
    supportedPaperSizes: [
      STANDARD_PAPER_SPECS['A4 (8.27x11.69 in)'],
      STANDARD_PAPER_SPECS['Legal'],
    ],
    colorModes: [
      {
        mode: 'bw',
        name: 'Standard GDI Monochrome',
        colorModel: 'Monochrome',
        bitsPerPixel: 8,
        iccProfileName: 'sRGB_IEC61966-2.1.icc',
      },
      {
        mode: 'color',
        name: 'Standard GDI Color',
        colorModel: 'CMYK_4Color',
        bitsPerPixel: 24,
        iccProfileName: 'sRGB_IEC61966-2.1.icc',
      },
    ],
    dpiOptions: [300, 600, 1200],
    defaultDpi: 600,
    photoDpi: 1200,
    duplexSupported: false,
    borderlessSupported: false,
    borderlessPaperSizes: [],
    maxCopiesPerJob: 99,
    supportedMediaTypes: [
      { id: 'plain_paper', label: 'Generic Windows Spooler Media', labelBn: 'সাধারণ পেপার', recommendedDpi: 600 },
    ],
    feedTrays: [
      {
        id: 'default_spool_tray',
        name: 'Default Windows Spooler Tray',
        capacitySheets: 100,
        supportedSizes: ['A4 (8.27x11.69 in)', 'Legal'],
        mediaTypes: ['plain_paper'],
      },
    ],
    hardwareSpeedPPM: {
      monoDraft: 20,
      colorNormal: 10,
      photoHighResSecondsPerPrint: 30,
    },
  },
};

/**
 * PrinterCapabilitiesRegistry
 * Central registry mapping drivers and physical devices to dynamic capabilities.
 */
export class PrinterCapabilitiesRegistry {
  private static instance: PrinterCapabilitiesRegistry;
  private customCapabilities = new Map<string, PrinterCapabilities>();

  private constructor() {}

  public static getInstance(): PrinterCapabilitiesRegistry {
    if (!PrinterCapabilitiesRegistry.instance) {
      PrinterCapabilitiesRegistry.instance = new PrinterCapabilitiesRegistry();
    }
    return PrinterCapabilitiesRegistry.instance;
  }

  /**
   * Retrieves capabilities based on a specific driver ID
   */
  public getCapabilitiesForDriver(driverId: string): PrinterCapabilities {
    if (this.customCapabilities.has(driverId)) {
      return this.customCapabilities.get(driverId)!;
    }
    return DRIVER_CAPABILITIES_MAP[driverId] || DRIVER_CAPABILITIES_MAP['driver_win32_gdi_generic'];
  }

  /**
   * Dynamically inspects a physical PrinterDevice and infers its capability profile
   */
  public getCapabilitiesForDevice(device: PrinterDevice): PrinterCapabilities {
    if (device.brand === 'Epson' || /epson|l805|l850/i.test(device.model)) {
      return this.getCapabilitiesForDriver('driver_epson_esc_pr');
    }
    if (device.brand === 'HP' || /laserjet|m404|p2035/i.test(device.model)) {
      return this.getCapabilitiesForDriver('driver_hp_pcl6');
    }
    if (device.brand === 'Canon' || /canon|g3010|pixma/i.test(device.model)) {
      return this.getCapabilitiesForDriver('driver_canon_bjnp');
    }
    return this.getCapabilitiesForDriver('driver_win32_gdi_generic');
  }

  /**
   * Queries whether a connected printer hardware device can fulfill a job
   */
  public validateJobSupport(
    device: PrinterDevice,
    paperSize: string,
    colorMode: ColorMode,
    requestedDpi?: number
  ): { supported: boolean; reason?: string; optimalDpi: number } {
    const caps = this.getCapabilitiesForDevice(device);

    // 1. Validate paper size
    const sizeSupported = caps.supportedPaperSizes.some(
      s => s.id === paperSize || s.name.toLowerCase().includes(paperSize.toLowerCase())
    );
    if (!sizeSupported) {
      return {
        supported: false,
        reason: `Paper size "${paperSize}" is not supported by ${device.name}. Supported sizes: ${caps.supportedPaperSizes.map(s => s.id).join(', ')}`,
        optimalDpi: caps.defaultDpi,
      };
    }

    // 2. Validate color mode
    const colorSupported = caps.colorModes.some(c => c.mode === colorMode);
    if (!colorSupported) {
      return {
        supported: false,
        reason: `Color mode "${colorMode}" is not supported by ${device.name} (Monochrome Laser engine)`,
        optimalDpi: caps.defaultDpi,
      };
    }

    // 3. Resolve optimal DPI
    const targetDpi = requestedDpi && caps.dpiOptions.includes(requestedDpi)
      ? requestedDpi
      : colorMode === 'color' && caps.borderlessSupported
      ? caps.photoDpi
      : caps.defaultDpi;

    return {
      supported: true,
      optimalDpi: targetDpi,
    };
  }

  /**
   * Allows shopkeepers or drivers to register custom capability profiles
   */
  public registerCustomCapabilities(driverId: string, caps: PrinterCapabilities) {
    this.customCapabilities.set(driverId, caps);
  }
}

export const capabilitiesRegistry = PrinterCapabilitiesRegistry.getInstance();
