/** Interactive crop geometry for the Studio editor.
 *
 * Rectangles are normalised (0..1) against the working canvas so a crop
 * survives zooming, panning and canvas resizes. Pixel conversion happens at
 * the edges (`cropRectToPixels`) where the real canvas size is known.
 */

/** Normalised crop rectangle; `x`/`y` is the top-left corner. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Grab points of the crop overlay. */
export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

/** Smallest crop edge in normalised units (2% of the canvas edge). */
export const MIN_CROP_EDGE = 0.02;

/** Units accepted by the custom crop size fields. */
export type SizeUnit = 'px' | 'in' | 'mm';

/** Print resolution used when a size is given in inches or millimetres. */
export const CROP_DPI = 300;

export interface CropPoint {
  x: number;
  y: number;
}

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/** Build a crop rectangle from two drag points (order independent). */
export function normalizeCropRect(start: CropPoint, end: CropPoint): CropRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

/** Keep the rectangle inside the canvas without changing its size. */
export function clampCropRect(rect: CropRect): CropRect {
  const w = Math.min(Math.max(rect.w, 0), 1);
  const h = Math.min(Math.max(rect.h, 0), 1);
  return {
    x: Math.min(Math.max(rect.x, 0), 1 - w),
    y: Math.min(Math.max(rect.y, 0), 1 - h),
    w,
    h,
  };
}

/** Normalised aspect ratio (width / height) of a crop rectangle. */
export function cropRectAspect(rect: CropRect): number {
  if (rect.w <= 0 || rect.h <= 0) return 1;
  return rect.w / rect.h;
}

/**
 * Convert a pixel aspect ratio (e.g. 1500/1200) into the normalised aspect the
 * crop rectangle needs so the cropped pixels keep the requested shape.
 */
export function normalizedAspect(pixelAspect: number, canvasW: number, canvasH: number): number {
  if (!Number.isFinite(pixelAspect) || pixelAspect <= 0) return 1;
  if (canvasW <= 0 || canvasH <= 0) return pixelAspect;
  return (pixelAspect * canvasH) / canvasW;
}

/** Largest centred rectangle with the given normalised aspect ratio. */
export function fitCropRectToAspect(aspect: number): CropRect {
  const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  if (safe >= 1) {
    const h = 1 / safe;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = safe;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

/** Shift the rectangle, keeping it inside the canvas. */
export function moveCropRect(rect: CropRect, dx: number, dy: number): CropRect {
  return clampCropRect({ ...rect, x: rect.x + dx, y: rect.y + dy });
}

/**
 * Resize the rectangle by dragging `handle` by the given normalised deltas.
 * The opposite corner (or edge) stays anchored. When `aspect` is provided the
 * rectangle keeps that normalised aspect ratio.
 */
export function resizeCropRect(
  rect: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  aspect: number | null = null,
): CropRect {
  if (handle === 'move') return moveCropRect(rect, dx, dy);

  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');

  const anchorX = west ? rect.x + rect.w : rect.x;
  const anchorY = north ? rect.y + rect.h : rect.y;

  let left = west ? rect.x + dx : rect.x;
  let right = east ? rect.x + rect.w + dx : rect.x + rect.w;
  let top = north ? rect.y + dy : rect.y;
  let bottom = south ? rect.y + rect.h + dy : rect.y + rect.h;

  let width = Math.abs(right - left);
  let height = Math.abs(bottom - top);

  if (aspect !== null && Number.isFinite(aspect) && aspect > 0) {
    // The dominant dragged axis drives the other one so the box never flips.
    if (width / Math.max(height, 1e-6) > aspect) height = width / aspect;
    else width = height * aspect;
  }

  width = Math.max(MIN_CROP_EDGE, width);
  height = Math.max(MIN_CROP_EDGE, height);

  if (west) left = anchorX - width;
  else right = anchorX + width;
  if (north) top = anchorY - height;
  else bottom = anchorY + height;

  return clampCropRect({
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    w: width,
    h: height,
  });
}

/** Convert a normalised crop rectangle into canvas pixels. */
export function cropRectToPixels(rect: CropRect, width: number, height: number): PixelRect {
  return {
    x: Math.round(rect.x * width),
    y: Math.round(rect.y * height),
    w: Math.max(1, Math.round(rect.w * width)),
    h: Math.max(1, Math.round(rect.h * height)),
  };
}

/**
 * Output size of the exported canvas: the requested target size when one is
 * given, otherwise the cropped pixel size (the crop keeps its resolution).
 */
export function resolveCropOutputSize(
  crop: PixelRect,
  target: { w: number; h: number } | null,
): { w: number; h: number } {
  if (target && target.w > 0 && target.h > 0) {
    return { w: Math.round(target.w), h: Math.round(target.h) };
  }
  return { w: Math.max(1, Math.round(crop.w)), h: Math.max(1, Math.round(crop.h)) };
}

/** Convert a user-entered size into pixels for the given unit. */
export function toPixels(value: number, unit: SizeUnit, dpi = CROP_DPI): number {
  if (!Number.isFinite(value)) return 0;
  if (unit === 'in') return Math.round(value * dpi);
  if (unit === 'mm') return Math.round((value / 25.4) * dpi);
  return Math.round(value);
}

/** Convert pixels back into the unit the user is typing in. */
export function fromPixels(pixels: number, unit: SizeUnit, dpi = CROP_DPI): number {
  if (unit === 'in') return Math.round((pixels / dpi) * 100) / 100;
  if (unit === 'mm') return Math.round((pixels / dpi) * 25.4 * 100) / 100;
  return Math.round(pixels);
}
