import type { EditorFilter, TextAlign } from './studioTypes.js';
import type { EditorSnapshot } from './strokeModel.js';

/** Slider bounds shared by the options bar and the adjustments panel. */
export const ADJUSTMENT_RANGES = {
  brightness: { min: 50, max: 180, step: 1, suffix: '%' },
  contrast: { min: 50, max: 180, step: 1, suffix: '%' },
  saturation: { min: 0, max: 200, step: 1, suffix: '%' },
  scale: { min: 0.5, max: 2.5, step: 0.05, suffix: '×' },
  textSize: { min: 12, max: 72, step: 1, suffix: ' px' },
} as const;

/** Default canvas fill behind the photo, matching the previous editor shell. */
export const DEFAULT_BACKGROUND_COLOR = '#0f172a';
export const DEFAULT_TEXT_SIZE = 22;
export const DEFAULT_TEXT_ALIGN: TextAlign = 'center';
export const DEFAULT_BRUSH_COLOR = '#14b8a6';

/** Clamp a numeric slider value, falling back to `min` for non-finite input. */
export function clampAdjustment(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export interface PhotoFilterInput {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: boolean;
  activeFilter: EditorFilter;
  adjustmentsVisible: boolean;
}

/**
 * Build the canvas `ctx.filter` string for the photo layer.
 * When the adjustments layer is hidden the numeric values fall back to identity
 * so hiding the layer never changes the pixels.
 */
export function buildPhotoFilter(input: PhotoFilterInput): string {
  const { brightness, contrast, saturation, grayscale, activeFilter, adjustmentsVisible } = input;
  const b = adjustmentsVisible ? brightness : 100;
  const c = adjustmentsVisible ? contrast : 100;
  const s = adjustmentsVisible ? saturation : 100;

  let filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  if (adjustmentsVisible && (grayscale || activeFilter === 'bw_doc')) filter += ' grayscale(100%)';
  if (adjustmentsVisible && activeFilter === 'high_sharp') filter += ' contrast(130%) brightness(105%)';
  return filter;
}

/** Short, human-readable label for a history entry. */
export function editorHistorySummary(entry: EditorSnapshot, index: number): string {
  if (index === 0) return 'Opened';
  if (entry.label) return entry.label;
  if (entry.strokes.length > 0) return 'Marks';
  if (entry.showWatermark || entry.annotationText.trim().length > 0) return 'Watermark';
  if (entry.cropPreset !== 'free') return `Crop · ${entry.cropPreset}`;
  if (entry.rotation !== 0) return 'Rotate';
  return 'Adjust';
}

/**
 * Evenly spaced ruler ticks across a canvas axis. `ratio` is the 0..1 position
 * used for placement; `px` is the source-pixel value shown at that position.
 */
export function buildRulerTicks(lengthPx: number, divisions = 4): Array<{ ratio: number; px: number }> {
  const safeDivisions = Math.max(1, Math.floor(divisions));
  const safeLength = Number.isFinite(lengthPx) && lengthPx > 0 ? Math.round(lengthPx) : 0;
  const ticks: Array<{ ratio: number; px: number }> = [];
  for (let i = 0; i <= safeDivisions; i += 1) {
    const ratio = i / safeDivisions;
    ticks.push({ ratio, px: Math.round(ratio * safeLength) });
  }
  return ticks;
}
