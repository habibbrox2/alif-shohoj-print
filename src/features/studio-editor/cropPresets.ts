/** Crop preset identifiers used in the Studio editor. */
export type CropPreset = 'free' | 'passport' | 'stamp' | 'nid' | '4r' | 'a4';

/**
 * Human-readable crop preset definitions.
 * Each preset has a label (for UI), a note (physical dimensions), and the exact pixel size at 300 DPI.
 */
export const CROP_PRESETS: ReadonlyArray<{
  id: CropPreset;
  label: string;
  note: string;
}> = [
  { id: 'free', label: 'Original', note: 'no crop' },
  { id: 'passport', label: 'Passport', note: '35 × 45 mm' },
  { id: 'stamp', label: 'Stamp', note: '25 × 30 mm' },
  { id: 'nid', label: 'NID card', note: '85 × 54 mm' },
  { id: '4r', label: '4R photo', note: '4 × 6 in' },
  { id: 'a4', label: 'A4', note: 'document' },
];

/**
 * Exact pixel dimensions for each crop preset at 300 DPI.
 * `null` means "auto" — the canvas size is derived from the source image (clamped to max 800px).
 */
export const CROP_SIZE: Record<CropPreset, { w: number; h: number } | null> = {
  free: null,
  passport: { w: 413, h: 531 },
  stamp: { w: 250, h: 300 },
  nid: { w: 590, h: 375 },
  '4r': { w: 600, h: 400 },
  a4: { w: 496, h: 701 },
};

/**
 * Resolve the canvas pixel size for a given preset and source image dimensions.
 * - If the preset has a fixed size (non-free), return it directly.
 * - For 'free', clamp the natural dimensions to a max of 800px per side.
 * - If natural dimensions are 0/undefined, fall back to 600×600.
 */
export function resolveCanvasSize(
  preset: CropPreset,
  naturalW: number,
  naturalH: number
): { w: number; h: number } {
  const fixed = CROP_SIZE[preset];
  if (fixed) return fixed;

  const w = Math.min(naturalW || 0, 800);
  const h = Math.min(naturalH || 0, 800);

  if (w > 0 && h > 0) return { w, h };

  return { w: 600, h: 600 };
}

/**
 * Infer the initial crop preset from an aspect ratio string (case-insensitive).
 * Returns 'free' for unknown or missing values.
 */
export function getInitialCropPreset(aspectRatio?: string): CropPreset {
  switch (aspectRatio?.toLowerCase()) {
    case 'passport':
      return 'passport';
    case 'stamp':
      return 'stamp';
    case 'nid':
      return 'nid';
    case 'a4':
      return 'a4';
    case '4r':
      return '4r';
    default:
      return 'free';
  }
}

/**
 * Type guard for crop preset values.
 */
export function isCropPreset(value: unknown): value is CropPreset {
  return typeof value === 'string' && (CROP_SIZE as Record<string, unknown>).hasOwnProperty(value);
}