import type { CropPreset } from './cropPresets.js';

/** Tools available in the Studio editor tool palette. */
export type ToolId = 'move' | 'crop' | 'brush' | 'text' | 'shape' | 'eraser';

/** Colour filters that render on top of the numeric photo adjustments. */
export type EditorFilter = 'none' | 'clean_white' | 'passport_blue' | 'high_sharp' | 'bw_doc';

/** Horizontal alignment of the watermark text overlay. */
export type TextAlign = 'left' | 'center' | 'right';

/** Overlay layers the operator can reorder, hide, or lock. */
export type OverlayLayerId = 'text' | 'marks';

/**
 * Edit values persisted back to a print job's crop settings.
 * Keep this shape stable: `StudioPage` reads these fields when re-opening a job.
 */
export interface StudioCanvasAdjustments {
  rotation: number;
  zoom: number;
  brightness: number;
  contrast: number;
  grayscale: boolean;
  cropPreset: CropPreset;
}
