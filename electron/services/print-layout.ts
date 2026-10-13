import type { PrintJobLayout } from '../../src/shared/types.js';

/**
 * Sanitisation and page geometry for a Studio print-dialog layout.
 *
 * `PrintJob.printLayout` is persisted on a job that reaches the print agent
 * from the renderer, so every field is treated as untrusted: values are clamped
 * here and the resulting geometry is guaranteed to stay on the sheet, because a
 * degenerate box prints a blank page that looks like a successful print.
 */

const POINTS_PER_INCH = 72;

// Bounds mirror the dialog (src/features/studio-editor/printSettings.ts) so a
// legal dialog choice is never rewritten, while anything beyond it is contained.
const MIN_SCALE_PERCENT = 1;
const MAX_SCALE_PERCENT = 640;
const MAX_MARGIN_IN = 4;
const MAX_POSITION_IN = 24;

/** Smallest printable area and smallest document, in points. */
const MIN_PRINTABLE_POINTS = POINTS_PER_INCH;
const MIN_DOCUMENT_POINTS = 1;

export interface SanitizedPrintLayout {
  orientation: 'portrait' | 'landscape';
  marginIn: number;
  topIn: number;
  leftIn: number;
  scalePercent: number;
  scaleToFit: boolean;
  centerImage: boolean;
}

export interface PrintableArea {
  width: number;
  height: number;
}

export interface DocumentBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  if (!isFiniteNumber(value)) return fallback;
  return Math.min(Math.max(value, min), max);
};

const coerceBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * Normalise a persisted layout into values the print agent is willing to draw.
 *
 * Returns `null` when the record is not an object, which keeps the legacy
 * centred layout for every job saved before the dialog existed. Defaults match
 * that legacy behaviour: portrait, unscaled, no margin, centred.
 */
export const sanitizePrintLayout = (value: unknown): SanitizedPrintLayout | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const layout = value as PrintJobLayout;

  return {
    orientation: layout.orientation === 'landscape' ? 'landscape' : 'portrait',
    marginIn: clampNumber(layout.marginIn, 0, MAX_MARGIN_IN, 0),
    topIn: clampNumber(layout.topIn, -MAX_POSITION_IN, MAX_POSITION_IN, 0),
    leftIn: clampNumber(layout.leftIn, -MAX_POSITION_IN, MAX_POSITION_IN, 0),
    scalePercent: clampNumber(layout.scalePercent, MIN_SCALE_PERCENT, MAX_SCALE_PERCENT, 100),
    scaleToFit: coerceBoolean(layout.scaleToFit, false),
    centerImage: coerceBoolean(layout.centerImage, true),
  };
};

/**
 * Printable area of a portrait sheet: the page inset by `marginIn` on every
 * side. The inset is capped so a margin as wide as the sheet cannot collapse
 * the area to nothing, which would fit the document to zero points.
 */
export const getPrintableArea = (pageWidth: number, pageHeight: number, marginIn: number): PrintableArea => {
  const requested = clampNumber(marginIn, 0, MAX_MARGIN_IN, 0) * POINTS_PER_INCH;
  const margin = Math.min(
    requested,
    Math.max((pageWidth - MIN_PRINTABLE_POINTS) / 2, 0),
    Math.max((pageHeight - MIN_PRINTABLE_POINTS) / 2, 0)
  );

  return {
    width: Math.min(Math.max(pageWidth - 2 * margin, MIN_PRINTABLE_POINTS), pageWidth),
    height: Math.min(Math.max(pageHeight - 2 * margin, MIN_PRINTABLE_POINTS), pageHeight),
  };
};

/**
 * Uniform factor that fits a document of the given point size inside an area.
 * A document with an unknown size is left at its own size rather than scaled
 * to nothing.
 */
export const fitScaleFactor = (width: number, height: number, area: PrintableArea): number => {
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) return 1;
  if (area.width <= 0 || area.height <= 0) return 1;
  return Math.min(area.width / width, area.height / height);
};

/**
 * Resolve where a document is drawn on the composed page.
 *
 * The dialog measures `topIn` downwards from the top-left corner of the sheet,
 * while PDF user space has its origin at the bottom-left corner with `y` growing
 * upwards, so a top offset becomes `pageHeight - topIn - docHeight`.
 *
 * The result is then anchored inside the sheet: a document wider or taller than
 * the page is placed at the top-left corner, and any other box is kept fully on
 * the page, so a hostile offset cannot push the whole document off the paper and
 * print a blank sheet.
 */
export const resolveDocumentBox = (args: {
  pageWidth: number;
  pageHeight: number;
  docWidth: number;
  docHeight: number;
  layout: SanitizedPrintLayout;
}): DocumentBox => {
  const { pageWidth, pageHeight, layout } = args;
  const width = isFiniteNumber(args.docWidth) ? Math.max(args.docWidth, MIN_DOCUMENT_POINTS) : MIN_DOCUMENT_POINTS;
  const height = isFiniteNumber(args.docHeight) ? Math.max(args.docHeight, MIN_DOCUMENT_POINTS) : MIN_DOCUMENT_POINTS;

  const maxX = Math.max(pageWidth - width, 0);
  const maxY = Math.max(pageHeight - height, 0);
  const desiredX = layout.centerImage ? (pageWidth - width) / 2 : layout.leftIn * POINTS_PER_INCH;
  const topFromPageTop = layout.centerImage
    ? (pageHeight - height) / 2
    : layout.topIn * POINTS_PER_INCH;

  return {
    x: Math.min(Math.max(desiredX, 0), maxX),
    y: Math.min(Math.max(pageHeight - topFromPageTop - height, 0), maxY),
    width,
    height,
  };
};
