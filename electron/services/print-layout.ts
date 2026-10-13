import type { PrintJobLayout } from '../../src/shared/types.js';

/**
 * Sanitisation and page geometry for a Studio print-dialog layout.
 *
 * `PrintJob.printLayout` and `PrintJob.cropSettings` are persisted on a job that
 * reaches the print agent from the renderer, so every field is treated as
 * untrusted: values are clamped here, and a geometry that cannot be drawn is
 * reported instead of producing a blank page that looks like a successful print.
 */

const POINTS_PER_INCH = 72;

/**
 * The repository crops and prints at 300 DPI, so an image's pixel size is read
 * as inches at that resolution. Must stay equal to COMPUTE_DPI in
 * src/features/studio-editor/printSettings.ts, or the printed size stops
 * matching the dialog preview.
 */
const COMPUTE_DPI = 300;

// Bounds mirror the dialog (src/features/studio-editor/printSettings.ts) so a
// legal dialog choice is never rewritten, while anything beyond it is contained.
const MIN_SCALE_PERCENT = 1;
const MAX_SCALE_PERCENT = 640;
const MAX_MARGIN_IN = 4;
const MAX_POSITION_IN = 24;
const MIN_CROP_ZOOM = 0.25;
const MAX_CROP_ZOOM = 3;
const MAX_CROP_ROTATION_DEGREES = 360;

/**
 * Smallest printable area, in points. A margin wider than the sheet would give a
 * zero-width box and therefore a zero-width document; the dialog preview
 * collapses the same way.
 */
const MIN_PRINTABLE_POINTS = 1;

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
 * Canvas zoom from the crop settings. The record crosses the network, so a
 * string or a missing value falls back to 1 rather than reaching the geometry
 * as NaN.
 */
export const sanitizeCropZoom = (value: unknown): number =>
  clampNumber(value, MIN_CROP_ZOOM, MAX_CROP_ZOOM, 1);

/** Crop rotation in degrees, reduced to a single turn; anything else reads as 0. */
export const sanitizeCropRotation = (value: unknown): number =>
  clampNumber(value, -MAX_CROP_ROTATION_DEGREES, MAX_CROP_ROTATION_DEGREES, 0);

/**
 * Natural size of an embedded image in points, read at the repository's 300 DPI
 * the same way `computePrintLayout` reads the dialog's canvas. This is what
 * makes the printed document the same size the dialog previewed.
 */
export const getNaturalSize = (widthPx: number, heightPx: number): DocumentBox => {
  const toPoints = (pixels: unknown): number =>
    (isFiniteNumber(pixels) ? Math.max(pixels, 0) : 0) / COMPUTE_DPI * POINTS_PER_INCH;

  return { x: 0, y: 0, width: toPoints(widthPx), height: toPoints(heightPx) };
};

/**
 * Printable area of the sheet: the page inset by `marginIn` on every side. The
 * margin is only a fit target, so it never moves the document itself.
 */
export const getPrintableArea = (pageWidth: number, pageHeight: number, marginIn: number): PrintableArea => {
  const margin = clampNumber(marginIn, 0, MAX_MARGIN_IN, 0) * POINTS_PER_INCH;

  return {
    width: Math.max(pageWidth - 2 * margin, MIN_PRINTABLE_POINTS),
    height: Math.max(pageHeight - 2 * margin, MIN_PRINTABLE_POINTS),
  };
};

/**
 * Uniform factor that fits a document of the given point size inside an area.
 * A document of unknown size is left alone rather than scaled to nothing, which
 * `resolveDocumentBox` would then have to reject.
 */
export const fitScaleFactor = (width: number, height: number, area: PrintableArea): number => {
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) return 1;
  if (!(area.width > 0) || !(area.height > 0)) return 1;
  return Math.min(area.width / width, area.height / height);
};

const requireDrawableSize = (value: number, axis: string): number => {
  if (!isFiniteNumber(value) || value <= 0) {
    throw new Error(`Print settings produced an invalid document ${axis}; check the image and the print dialog values.`);
  }
  return value;
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
 * print a blank sheet. The anchor uses the un-rotated size, so a 90 degree crop
 * rotation can still leave the rotated corners over the edge.
 */
export const resolveDocumentBox = (args: {
  pageWidth: number;
  pageHeight: number;
  docWidth: number;
  docHeight: number;
  layout: SanitizedPrintLayout;
}): DocumentBox => {
  const { pageWidth, pageHeight, layout } = args;
  // A zero or non-finite box is not a document: it would print a blank sheet
  // and report success, so the job fails with a visible reason instead.
  const width = requireDrawableSize(args.docWidth, 'width');
  const height = requireDrawableSize(args.docHeight, 'height');

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
