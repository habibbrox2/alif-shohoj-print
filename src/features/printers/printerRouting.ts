import { PrinterDevice, PrintJob, ServiceType, PaperSize, ColorMode } from '../../shared/types';
import { capabilitiesRegistry } from './drivers/PrinterCapabilitiesRegistry';

export const INITIAL_PRINTERS: PrinterDevice[] = [
  {
    id: 'printer_epson_l805',
    name: 'Epson EcoTank L805',
    brand: 'Epson',
    model: 'L805 High-Res 6-Color',
    type: 'photo_inkjet',
    status: 'online',
    supportedPaperSizes: ['4R (4x6 in)', 'Passport Grid (4-in-1)', 'Passport Grid (8-in-1)', 'Stamp Size', 'A4 (8.27x11.69 in)'],
    colorCapability: 'color',
    queueCount: 1,
    inkLevels: {
      black: 92,
      cyan: 88,
      magenta: 76,
      yellow: 84,
    },
    paperCount: 45,
    description: 'High-gloss 6-color photo printer for passport, stamp & studio 4R prints',
  },
  {
    id: 'printer_hp_laserjet',
    name: 'HP LaserJet Pro M404dn',
    brand: 'HP',
    model: 'Pro M404dn High Speed',
    type: 'laser_bw',
    status: 'online',
    supportedPaperSizes: ['A4 (8.27x11.69 in)', 'Legal'],
    colorCapability: 'bw_only',
    queueCount: 2,
    inkLevels: {
      black: 81,
    },
    paperCount: 240,
    description: 'High-speed 40ppm monochrome laser for NID copies & official documents',
  },
  {
    id: 'printer_canon_g3010',
    name: 'Canon PIXMA G3010',
    brand: 'Canon',
    model: 'G3010 All-in-One InkTank',
    type: 'color_inkjet',
    status: 'offline', // Demonstrating offline handling & dynamic fallback routing
    supportedPaperSizes: ['A4 (8.27x11.69 in)', '4R (4x6 in)', 'Legal'],
    colorCapability: 'color',
    queueCount: 0,
    inkLevels: {
      black: 65,
      cyan: 70,
      magenta: 58,
      yellow: 62,
    },
    paperCount: 120,
    description: 'All-in-one color ink tank for A4 color documents & flyers',
  },
];

export interface RoutingResult {
  printerId: string;
  printerName: string;
  reason: string;
  isPreferred: boolean;
  requiresFallback: boolean;
  optimalDpi: number;
}

/**
 * Dynamic Capability-Driven Printer Routing Engine
 * Queries PrinterCapabilitiesRegistry dynamically for each connected physical device
 */
export const matchPrinterForJob = (
  serviceType: ServiceType,
  paperSize: PaperSize,
  colorMode: ColorMode,
  printers: PrinterDevice[]
): RoutingResult => {
  const onlinePrinters = printers.filter(p => p.status === 'online');

  // Find all online printers that dynamically support this job's paper size and color mode
  const candidates = onlinePrinters
    .map(printer => {
      const validation = capabilitiesRegistry.validateJobSupport(printer, paperSize, colorMode);
      const caps = capabilitiesRegistry.getCapabilitiesForDevice(printer);
      return {
        printer,
        validation,
        caps,
      };
    })
    .filter(c => c.validation.supported);

  // Preference Rule 1: High quality photo services (Passport, Stamp, 4R) prefer Photo 6-Color engine
  if (serviceType === 'passport_photo' || serviceType === 'stamp_photo' || serviceType === 'photo_4r') {
    const photoCandidate = candidates.find(c => c.caps.photoDpi >= 2880 && c.caps.borderlessSupported);
    if (photoCandidate) {
      return {
        printerId: photoCandidate.printer.id,
        printerName: photoCandidate.printer.name,
        reason: `Capability Match: ${photoCandidate.caps.vendor} 6-color photo engine (${photoCandidate.validation.optimalDpi} DPI, Borderless Photo Bleed)`,
        isPreferred: true,
        requiresFallback: false,
        optimalDpi: photoCandidate.validation.optimalDpi,
      };
    }
  }

  // Preference Rule 2: NID Copy / Smart card copy in B&W or standard document prefers high-speed Laser engine
  if (serviceType === 'nid_card' || (serviceType === 'doc_a4' && colorMode === 'bw')) {
    const laserCandidate = candidates.find(c => c.caps.vendor === 'HP' || c.caps.protocol === 'pcl6');
    if (laserCandidate) {
      return {
        printerId: laserCandidate.printer.id,
        printerName: laserCandidate.printer.name,
        reason: `Capability Match: High-speed monochrome laser engine (${laserCandidate.caps.hardwareSpeedPPM.monoDraft} PPM, ${laserCandidate.validation.optimalDpi} DPI sharp contrast)`,
        isPreferred: true,
        requiresFallback: false,
        optimalDpi: laserCandidate.validation.optimalDpi,
      };
    }
  }

  // Preference Rule 3: Color documents / Certificates prefer Color InkTank engine
  if (serviceType === 'doc_a4' && colorMode === 'color') {
    const colorDocCandidate = candidates.find(c => c.caps.vendor === 'Canon' || c.caps.protocol === 'bjnp_canon');
    if (colorDocCandidate) {
      return {
        printerId: colorDocCandidate.printer.id,
        printerName: colorDocCandidate.printer.name,
        reason: `Capability Match: Color ink tank (${colorDocCandidate.validation.optimalDpi} DPI, Hybrid FINE Tank)`,
        isPreferred: true,
        requiresFallback: false,
        optimalDpi: colorDocCandidate.validation.optimalDpi,
      };
    }
  }

  // If a valid capable candidate exists among online printers
  if (candidates.length > 0) {
    const selected = candidates[0];
    const isPreferred = onlinePrinters.length > 0 && selected.printer.id === onlinePrinters[0].id;
    return {
      printerId: selected.printer.id,
      printerName: selected.printer.name,
      reason: `Dynamic Match: ${selected.printer.name} supports ${paperSize} in ${colorMode.toUpperCase()} at ${selected.validation.optimalDpi} DPI`,
      isPreferred: isPreferred,
      requiresFallback: !isPreferred,
      optimalDpi: selected.validation.optimalDpi,
    };
  }

  // Fallback: If no online printer currently supports the job
  const offlineMatches = printers.filter(p => {
    const v = capabilitiesRegistry.validateJobSupport(p, paperSize, colorMode);
    return v.supported;
  });

  if (offlineMatches.length > 0) {
    const target = offlineMatches[0];
    return {
      printerId: target.id,
      printerName: target.name,
      reason: `Alert: Primary capable printer (${target.name}) is currently OFFLINE. Job spooled to local agent cache pending device power-on.`,
      isPreferred: false,
      requiresFallback: true,
      optimalDpi: 1200,
    };
  }

  // Universal fallback to first registered device
  const fallback = printers[0] || { id: 'printer_epson_l805', name: 'Epson EcoTank L805' };
  return {
    printerId: fallback.id,
    printerName: fallback.name,
    reason: 'Dynamic Discovery: No hardware device natively matched media criteria; assigned to generic spooler.',
    isPreferred: false,
    requiresFallback: true,
    optimalDpi: 600,
  };
};
