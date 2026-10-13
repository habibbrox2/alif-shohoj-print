import { STANDARD_PAPER_SPECS } from '../printers/drivers/PrinterCapabilitiesRegistry.js';
import type { PaperSize } from '../../shared/types.js';

/**
 * Print Settings dialog model and pure layout math (no DOM, no React).
 *
 * The repository prints and crops at 300 DPI, so canvas pixels are converted with
 * the same constant the crop presets use.
 */
export const COMPUTE_DPI = 300;

/** millimetres per inch, used to derive exact paper dimensions. */
const MM_PER_INCH = 25.4;

/** Paper dimensions are surfaced with milli-inch precision, matching the spec sheets. */
const INCH_PRECISION = 1000;

/** A4 is the shop default paper, so unknown sizes fall back to its dimensions. */
const FALLBACK_PAPER_SIZE: PaperSize = 'A4 (8.27x11.69 in)';

/** UI scale bounds; 640 % is the studio zoom ceiling the editor already exposes. */
export const MIN_PRINT_SCALE_PERCENT = 1;
export const MAX_PRINT_SCALE_PERCENT = 640;

/** Margins beyond four inches are unrealistic for photo and document printing. */
export const MIN_PRINT_MARGIN_IN = 0;
export const MAX_PRINT_MARGIN_IN = 4;

export interface PrintSettings {
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape';
  marginIn: number;
  centerImage: boolean;
  topIn: number;
  leftIn: number;
  scalePercent: number;
  scaleToFit: boolean;
  showBoundingBox: boolean;
}

export interface PaperDimensions {
  widthIn: number;
  heightIn: number;
}

export interface PrintLayout {
  paper: PaperDimensions;
  printable: PaperDimensions;
  docWidthIn: number;
  docHeightIn: number;
  scalePercent: number;
  topIn: number;
  leftIn: number;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'A4 (8.27x11.69 in)',
  orientation: 'portrait',
  marginIn: 0.25,
  centerImage: true,
  topIn: 0,
  leftIn: 0,
  scalePercent: 100,
  scaleToFit: false,
  showBoundingBox: true,
};

/** Storage key for the persisted print settings; safe to share across sessions. */
export const PRINT_SETTINGS_STORAGE_KEY = 'alif-shohoj-print-studio-print-settings';

/** Paper sizes the dialog may offer. 'Custom' is excluded: the print service throws on it. */
export const PAPER_SIZE_CHOICES: ReadonlyArray<PaperSize> = (
  Object.keys(STANDARD_PAPER_SPECS) as PaperSize[]
).filter((size) => size !== 'Custom');

/** Top/left offsets are clamped to two feet, beyond which a printed page is unreadable. */
const MAX_PRINT_POSITION_IN = 24;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampPrintScale(percent: number): number {
  if (!isFiniteNumber(percent)) return MIN_PRINT_SCALE_PERCENT;
  return clampNumber(percent, MIN_PRINT_SCALE_PERCENT, MAX_PRINT_SCALE_PERCENT);
}

export function clampPrintMargin(marginIn: number): number {
  if (!isFiniteNumber(marginIn)) return DEFAULT_PRINT_SETTINGS.marginIn;
  return clampNumber(marginIn, MIN_PRINT_MARGIN_IN, MAX_PRINT_MARGIN_IN);
}

/**
 * Top/left offsets are stored in inches and clamped two feet either way, so a
 * value committed by the dialog is exactly what a later load returns.
 */
export function clampPrintPosition(inches: number): number {
  // Both offsets default to 0 in DEFAULT_PRINT_SETTINGS.
  if (!isFiniteNumber(inches)) return DEFAULT_PRINT_SETTINGS.topIn;
  return clampNumber(inches, -MAX_PRINT_POSITION_IN, MAX_PRINT_POSITION_IN);
}

function roundInches(value: number): number {
  return Math.round(value * INCH_PRECISION) / INCH_PRECISION;
}

/**
 * Physical paper size in inches for a paper size and orientation.
 * Derived from millimetres, because the registry's inch fields are rounded
 * (A4 is listed as 8.27 in while 210 mm is exactly 8.268 in).
 */
export function getPaperDimensions(
  paperSize: PaperSize,
  orientation: 'portrait' | 'landscape' = 'portrait'
): PaperDimensions {
  const spec = STANDARD_PAPER_SPECS[paperSize] ?? STANDARD_PAPER_SPECS[FALLBACK_PAPER_SIZE];
  const widthIn = spec.widthMm / MM_PER_INCH;
  const heightIn = spec.heightMm / MM_PER_INCH;

  return orientation === 'landscape'
    ? { widthIn: roundInches(heightIn), heightIn: roundInches(widthIn) }
    : { widthIn: roundInches(widthIn), heightIn: roundInches(heightIn) };
}

/**
 * Effective print scale. `scaleToFit` derives the scale from the printable area and
 * overrides the stored percentage; the fit result may fall below 1 %, so it is
 * deliberately not clamped to the UI scale bounds.
 */
function effectiveScale(settings: PrintSettings, naturalWidthIn: number, naturalHeightIn: number, printable: PaperDimensions): number {
  if (!settings.scaleToFit || naturalWidthIn <= 0 || naturalHeightIn <= 0) {
    return settings.scalePercent;
  }

  const widthScale = printable.widthIn / naturalWidthIn;
  const heightScale = printable.heightIn / naturalHeightIn;
  return Math.min(widthScale, heightScale) * 100;
}

/**
 * Lay out an image of `docPx` pixels on the selected paper.
 * Pure math only — no side effects, no DOM access.
 */
export function computePrintLayout(settings: PrintSettings, docPx: { w: number; h: number }): PrintLayout {
  const paper = getPaperDimensions(settings.paperSize, settings.orientation);
  const marginIn = clampPrintMargin(settings.marginIn);
  // Rounded to the same milli-inch precision as the paper, so margins stay exact.
  const printable: PaperDimensions = {
    widthIn: roundInches(Math.max(paper.widthIn - 2 * marginIn, 0)),
    heightIn: roundInches(Math.max(paper.heightIn - 2 * marginIn, 0)),
  };

  const naturalWidthIn = Math.max(docPx.w, 0) / COMPUTE_DPI;
  const naturalHeightIn = Math.max(docPx.h, 0) / COMPUTE_DPI;
  const scalePercent = effectiveScale(settings, naturalWidthIn, naturalHeightIn, printable);

  const docWidthIn = (naturalWidthIn * scalePercent) / 100;
  const docHeightIn = (naturalHeightIn * scalePercent) / 100;

  const topIn = settings.centerImage ? (paper.heightIn - docHeightIn) / 2 : settings.topIn;
  const leftIn = settings.centerImage ? (paper.widthIn - docWidthIn) / 2 : settings.leftIn;

  return { paper, printable, docWidthIn, docHeightIn, scalePercent, topIn, leftIn };
}

/**
 * Scale helper used by the settings dialog. Height and width are computed from
 * the current scale (never stored), which keeps the aspect ratio intact.
 */
export function settingsFromScale(settings: PrintSettings, percent: number): PrintSettings {
  return { ...settings, scalePercent: clampPrintScale(percent) };
}

export function settingsFromHeight(settings: PrintSettings, docPx: { w: number; h: number }, inches: number): PrintSettings {
  if (!isFiniteNumber(inches) || docPx.h <= 0) return settings;
  return { ...settings, scalePercent: clampPrintScale((inches / (docPx.h / COMPUTE_DPI)) * 100) };
}

export function settingsFromWidth(settings: PrintSettings, docPx: { w: number; h: number }, inches: number): PrintSettings {
  if (!isFiniteNumber(inches) || docPx.w <= 0) return settings;
  return { ...settings, scalePercent: clampPrintScale((inches / (docPx.w / COMPUTE_DPI)) * 100) };
}

function isPaperSize(value: unknown): value is PaperSize {
  return typeof value === 'string' && PAPER_SIZE_CHOICES.some((size) => size === value);
}

function isOrientation(value: unknown): value is PrintSettings['orientation'] {
  return value === 'portrait' || value === 'landscape';
}

function coerceStoredBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Merge stored JSON over the defaults, clamping every field.
 * Returns a fresh copy of the defaults when storage is unavailable, unreadable,
 * or corrupt, so a caller can never mutate the shared default.
 */
export function loadPrintSettings(): PrintSettings {
  const defaults: PrintSettings = { ...DEFAULT_PRINT_SETTINGS };

  let raw: string | null = null;
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage || typeof storage.getItem !== 'function') return defaults;
    raw = storage.getItem(PRINT_SETTINGS_STORAGE_KEY);
  } catch {
    return defaults;
  }

  if (!raw) return defaults;

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return defaults;
  }

  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return defaults;

  const record = stored as Record<string, unknown>;
  const paperSize = isPaperSize(record.paperSize) ? record.paperSize : defaults.paperSize;
  const orientation = isOrientation(record.orientation) ? record.orientation : defaults.orientation;
  const marginIn = isFiniteNumber(record.marginIn)
    ? clampPrintMargin(record.marginIn)
    : defaults.marginIn;
  const centerImage = coerceStoredBoolean(record.centerImage, defaults.centerImage);
  const scaleToFit = coerceStoredBoolean(record.scaleToFit, defaults.scaleToFit);
  const showBoundingBox = coerceStoredBoolean(record.showBoundingBox, defaults.showBoundingBox);
  const scalePercent = isFiniteNumber(record.scalePercent)
    ? clampPrintScale(record.scalePercent)
    : defaults.scalePercent;
  const topIn = isFiniteNumber(record.topIn) ? clampPrintPosition(record.topIn) : defaults.topIn;
  const leftIn = isFiniteNumber(record.leftIn) ? clampPrintPosition(record.leftIn) : defaults.leftIn;

  return {
    paperSize,
    orientation,
    marginIn,
    centerImage,
    topIn,
    leftIn,
    scalePercent,
    scaleToFit,
    showBoundingBox,
  };
}

/** Best-effort persistence; never throws, mirroring the rest of the renderer stores. */
export function savePrintSettings(settings: PrintSettings): void {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage || typeof storage.setItem !== 'function') return;
    storage.setItem(PRINT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be full or blocked (private mode); losing the preference is acceptable.
  }
}
