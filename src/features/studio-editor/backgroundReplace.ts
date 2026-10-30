/** Background colour replacement for the Studio editor.
 *
 * This is a chroma-key style replacement: pixels close to a target colour are
 * repainted with a new colour, optionally keeping their original brightness so
 * shading and hair edges survive. The logic is pure (pixel buffer in, pixel
 * buffer out) so it can be unit-tested without a DOM.
 */

export interface ColorReplaceOptions {
  /** Colour to remove, hex `#rrggbb`. */
  target: string;
  /** Colour painted in its place, hex `#rrggbb`. */
  replacement: string;
  /** 0..100 — how far a pixel may deviate and still count as a match. */
  tolerance: number;
  /** 0..100 — width of the fade band around the tolerance edge. */
  softness: number;
  /** Keep the original brightness of the replaced pixels. */
  preserveLuminance: boolean;
}

/** Optional selection mask (1 = inside the selection). */
export interface ColorReplaceMask {
  mask: Uint8Array;
  width: number;
  height: number;
}

export interface ColorReplaceResult {
  /** Number of pixels that changed. */
  replaced: number;
  /** Number of pixels inspected. */
  total: number;
}

const clamp255 = (value: number): number => Math.min(255, Math.max(0, value));

/** Parse a `#rrggbb` colour into its RGB channels. */
export function parseHexColor(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [0, 0, 0];
    return [r, g, b];
  }
  const n = parseInt(cleaned, 16);
  if (Number.isNaN(n) || cleaned.length !== 6) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Normalised RGB distance between two colours (0 = identical, 1 = opposite). */
export function colorDistance(
  r: number,
  g: number,
  b: number,
  target: [number, number, number],
): number {
  const dr = (r - target[0]) / 255;
  const dg = (g - target[1]) / 255;
  const db = (b - target[2]) / 255;
  return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
}

/** Read a mask value using normalised coordinates so masks of any size work. */
function maskValue(mask: ColorReplaceMask, x: number, y: number, width: number, height: number): number {
  if (mask.width <= 0 || mask.height <= 0) return 0;
  const mx = Math.min(mask.width - 1, Math.max(0, Math.round((x / Math.max(1, width - 1)) * (mask.width - 1))));
  const my = Math.min(mask.height - 1, Math.max(0, Math.round((y / Math.max(1, height - 1)) * (mask.height - 1))));
  return mask.mask[my * mask.width + mx] ? 1 : 0;
}

/**
 * Replace the target colour inside `data`.
 *
 * @param data RGBA pixel buffer (mutated in place).
 * @param width Buffer width in pixels.
 * @param height Buffer height in pixels.
 * @param options Replacement colour, tolerance and softness.
 * @param mask Optional selection mask; only masked pixels are touched.
 * @param invertMask Replace outside the mask instead of inside it.
 */
export function replaceBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: ColorReplaceOptions,
  mask: ColorReplaceMask | null = null,
  invertMask = false,
): ColorReplaceResult {
  const target = parseHexColor(options.target);
  const replacement = parseHexColor(options.replacement);
  const tolerance = Math.min(100, Math.max(0, options.tolerance)) / 100;
  const softness = Math.min(100, Math.max(0, options.softness)) / 100;
  const outer = Math.min(1, tolerance + softness);
  const targetLuma = 0.299 * target[0] + 0.587 * target[1] + 0.114 * target[2];

  let replaced = 0;
  const total = Math.max(0, width) * Math.max(0, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      const distance = colorDistance(r, g, b, target);
      let factor = 0;
      if (distance <= tolerance) factor = 1;
      else if (softness > 0 && distance <= outer) factor = 1 - (distance - tolerance) / softness;
      if (factor <= 0) continue;

      if (mask) {
        const inside = maskValue(mask, x, y, width, height);
        if (invertMask ? inside : !inside) continue;
      }

      let outR = replacement[0];
      let outG = replacement[1];
      let outB = replacement[2];
      if (options.preserveLuminance && targetLuma > 4) {
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const gain = Math.min(2.4, Math.max(0.4, luma / targetLuma));
        outR = clamp255(replacement[0] * gain);
        outG = clamp255(replacement[1] * gain);
        outB = clamp255(replacement[2] * gain);
      }

      data[index] = r + (outR - r) * factor;
      data[index + 1] = g + (outG - g) * factor;
      data[index + 2] = b + (outB - b) * factor;
      replaced += 1;
    }
  }

  return { replaced, total };
}
