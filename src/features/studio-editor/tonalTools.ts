/** Dodge / Burn / Sponge — localised tonal adjustments.
 *
 * Each mode targets a luminance range (shadows, midtones, highlights) and
 * applies a multiplicative gain. Dodge lightens, Burn darkens, Sponge
 * desaturates. Operates on a pixel buffer in place.
 */

export type TonalMode = 'dodge' | 'burn' | 'sponge';
export type TonalRange = 'shadows' | 'midtones' | 'highlights';

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function inRange(lum: number, range: TonalRange): boolean {
  if (range === 'shadows') return lum < 105;
  if (range === 'highlights') return lum > 150;
  return lum >= 105 && lum <= 150;
}

/**
 * A recorded tonal brush stroke, so Dodge/Burn/Sponge edits survive undo/redo
 * without serialising a pixel buffer. The brush is replayed onto the hidden
 * source canvas from the photo state, so the edit is always reconstructable.
 * Each stroke also carries the pre-stroke source snapshot so undo is a
 * pixel-perfect restore instead of a re-application.
 */
export interface TonalStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  mode: TonalMode;
  exposure: number;
  range: TonalRange;
  size: number;
  /** Base64 data URL of the source canvas before this stroke was applied. */
  sourceSnapshot?: string;
}

/**
 * Apply a tonal brush (Dodge/Burn/Sponge) inside a soft circle at `point`.
 * `radius` is in source pixels. Returns the modified ImageData patch and its
 * origin so the caller can stamp it onto a canvas.
 */
export function stampTonalPatch(
  sctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  stroke: TonalStroke
): void {
  const w = sctx.canvas.width;
  const h = sctx.canvas.height;
  const cx = Math.round(point.x * w);
  const cy = Math.round(point.y * h);
  const radius = Math.max(1, Math.round(stroke.size / 2));
  const x0 = Math.max(0, cx - radius);
  const y0 = Math.max(0, cy - radius);
  const pw = Math.min(w, cx + radius) - x0;
  const ph = Math.min(h, cy + radius) - y0;
  if (pw <= 0 || ph <= 0) return;
  const img = sctx.getImageData(x0, y0, pw, ph);
  const out = applyTonalAdjustment(img.data, pw, ph, stroke.mode, stroke.exposure, stroke.range);
  const patch = new ImageData(out as unknown as Uint8ClampedArray<ArrayBuffer>, pw, ph);
  for (let p = 0; p < patch.data.length; p += 4) {
    const lx = (p / 4) % pw;
    const ly = ((p / 4) / pw) | 0;
    const dx = lx - pw / 2;
    const dy = ly - ph / 2;
    const a = Math.max(0, 1 - Math.hypot(dx, dy) / radius);
    patch.data[p + 3] = Math.round(255 * a);
  }
  sctx.save();
  sctx.globalCompositeOperation = 'source-over';
  sctx.putImageData(patch, x0, y0);
  sctx.restore();
}

/**
 * Apply a tonal adjustment. `exposure` is a gain multiplier:
 * dodge +0.2 lightens, burn -0.2 darkens, sponge reduces saturation.
 */
export function applyTonalAdjustment(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mode: TonalMode,
  exposure: number,
  range: TonalRange = 'midtones'
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  const gain = Math.max(-1, Math.min(1, exposure));
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const lum = luminance(r, g, b);
    if (!inRange(lum, range)) continue;
    if (mode === 'sponge') {
      // Positive exposure desaturates (sponge); negative would re-saturate.
      const sat = 1 - gain;
      const avg = lum;
      out[i] = Math.min(255, Math.round(avg + (r - avg) * sat));
      out[i + 1] = Math.min(255, Math.round(avg + (g - avg) * sat));
      out[i + 2] = Math.min(255, Math.round(avg + (b - avg) * sat));
    } else {
      // Dodge lightens (+), Burn darkens (−). Sponge is handled above.
      const signed = mode === 'burn' ? -gain : gain;
      const delta = signed * 255;
      out[i] = Math.max(0, Math.min(255, Math.round(r + delta)));
      out[i + 1] = Math.max(0, Math.min(255, Math.round(g + delta)));
      out[i + 2] = Math.max(0, Math.min(255, Math.round(b + delta)));
    }
  }
  return out;
}