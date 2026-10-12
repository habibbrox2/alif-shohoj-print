import type { EditorFilter, TextAlign } from './studioTypes.js';
import type { EditorSnapshot } from './strokeModel.js';

/** Slider bounds shared by the options bar and the adjustments panel. */
export const ADJUSTMENT_RANGES = {
  brightness: { min: 50, max: 180, step: 1, suffix: '%' },
  contrast: { min: 50, max: 180, step: 1, suffix: '%' },
  saturation: { min: 0, max: 200, step: 1, suffix: '%' },
  // Exposure is measured in stops (EV) and multiplies on top of brightness.
  exposure: { min: -2, max: 2, step: 0.1, suffix: ' EV' },
  scale: { min: 0.5, max: 2.5, step: 0.05, suffix: '×' },
  textSize: { min: 12, max: 72, step: 1, suffix: ' px' },
} as const;

/** Default canvas fill behind the photo, matching the previous editor shell. */
export const DEFAULT_BACKGROUND_COLOR = '#0f172a';
export const DEFAULT_TEXT_SIZE = 22;
export const DEFAULT_TEXT_ALIGN: TextAlign = 'center';
export const DEFAULT_BRUSH_COLOR = '#14b8a6';

/** A selectable watermark font. `stack` is a CSS font stack safe for canvas rendering. */
export interface StudioFontOption {
  id: string;
  label: string;
  stack: string;
}

/**
 * Curated fonts for watermark captions. Hind Siliguri stays first because it
 * covers Bengali text; the rest are fonts guaranteed on stock Windows.
 */
export const STUDIO_FONTS: readonly StudioFontOption[] = [
  { id: 'hind', label: 'Hind Siliguri', stack: "'Hind Siliguri', sans-serif" },
  { id: 'segoe', label: 'Segoe UI', stack: "'Segoe UI', sans-serif" },
  { id: 'arial', label: 'Arial', stack: 'Arial, sans-serif' },
  { id: 'times', label: 'Times New Roman', stack: "'Times New Roman', serif" },
  { id: 'courier', label: 'Courier New', stack: "'Courier New', monospace" },
];

export const DEFAULT_TEXT_FONT = STUDIO_FONTS[0].id;

/** Resolve a stored font id to a CSS font stack, falling back to the default. */
export function resolveFontStack(id: string): string {
  return STUDIO_FONTS.find(font => font.id === id)?.stack ?? STUDIO_FONTS[0].stack;
}

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
  /** Exposure in stops (EV); multiplies the brightness term. Defaults to 0. */
  exposure?: number;
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
  const exposure = adjustmentsVisible ? input.exposure ?? 0 : 0;

  // Exposure is multiplicative: +1 EV doubles the brightness term.
  const exposedBrightness = Math.round(b * 2 ** exposure * 100) / 100;

  let filter = `brightness(${exposedBrightness}%) contrast(${c}%) saturate(${s}%)`;
  if (adjustmentsVisible && (grayscale || activeFilter === 'bw_doc')) filter += ' grayscale(100%)';
  if (adjustmentsVisible && activeFilter === 'high_sharp') filter += ' contrast(130%) brightness(105%)';
  return filter;
}

/** Short, human-readable label for a history entry. */
export function editorHistorySummary(entry: EditorSnapshot, index: number): string {
  if (index === 0) return 'Opened';
  if (entry.label) return entry.label;
  if (entry.contentLayers.some((layer) => layer.kind === 'paint' && layer.strokes.length > 0)) return 'Marks';
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
