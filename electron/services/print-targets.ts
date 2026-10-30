/**
 * Pure helpers for choosing a Windows print target and page size.
 *
 * Kept free of Electron imports so they can be unit-tested under the Node test
 * runner without an Electron runtime.
 */

const MICRONS_PER_INCH = 25400;

export const toMicrons = (inches: number): number => Math.round(inches * MICRONS_PER_INCH);

/**
 * Map the spooler's paper-size token to the value Electron's `webContents.print`
 * expects: a named size for the standard sheets, or a custom `{ width, height }`
 * in microns for the 4x6 photo sheet.
 */
export const toPrinterPageSize = (
  paperSize: string
): string | { width: number; height: number } => {
  if (paperSize === '4x6') return { width: toMicrons(4), height: toMicrons(6) };
  return paperSize;
};

const VIRTUAL_PRINTER_PATTERNS = [
  /\bpdf\b/i,
  /\bxps\b/i,
  /\bonenote\b/i,
  /\bfax\b/i,
  /document writer/i,
  /print to/i,
  /adobe pdf/i,
  /cutepdf/i,
  /do pdf/i,
  /bullzip/i,
  /primo pdf/i,
  /pdfcreator/i,
];

/**
 * Heuristic for printers that cannot be used for silent, unattended printing
 * because they prompt for an output file or are virtual document sinks.
 */
export const isVirtualPrinter = (name: string): boolean =>
  VIRTUAL_PRINTER_PATTERNS.some(pattern => pattern.test(name));

export interface PrinterDetail {
  name: string;
  portName?: string;
  driverName?: string;
}

const VIRTUAL_PORT_PATTERNS = [
  /^file:/i,
  /^portprompt:/i,
  /^nul[:]?$/i,
  /\.pdf$/i,
  /pdf port/i,
  /^shrfax:/i,
];

const PHYSICAL_PORT_PATTERNS = [
  /^usb/i,
  /^tcpip/i,
  /^wsd/i,
  /^lpt/i,
  /^com\d/i,
  /^dot4/i,
  /^ts\d/i,
];

const VIRTUAL_DRIVER_PATTERNS = [
  /\bpdf\b/i,
  /\bxps\b/i,
  /\bfax\b/i,
  /onenote/i,
  /document writer/i,
];

/**
 * A printer is treated as virtual/document when its port, driver or name
 * indicates that it writes to a file or a document sink rather than a physical
 * device. Name-based detection remains as a fallback for systems where the
 * spooler metadata is unavailable.
 */
export const isVirtualPrinterDetail = (detail: PrinterDetail): boolean => {
  if (detail.portName) {
    // A clearly physical port means the printer is real, regardless of its name.
    if (PHYSICAL_PORT_PATTERNS.some(pattern => pattern.test(detail.portName!))) return false;
    // A clearly virtual port means it is a document sink.
    if (VIRTUAL_PORT_PATTERNS.some(pattern => pattern.test(detail.portName!))) return true;
    // Unknown port (e.g. an app package path): fall through to name/driver heuristics.
  }
  if (isVirtualPrinter(detail.name)) return true;
  if (detail.driverName && VIRTUAL_DRIVER_PATTERNS.some(pattern => pattern.test(detail.driverName!))) return true;
  return false;
};

export const filterPhysicalPrinterDetails = (details: PrinterDetail[]): PrinterDetail[] =>
  details.filter(detail => !isVirtualPrinterDetail(detail));

/**
 * Printers that are suitable for silent, unattended printing.
 */
export const filterPhysicalPrinters = (names: string[]): string[] =>
  names.filter(name => !isVirtualPrinter(name));
