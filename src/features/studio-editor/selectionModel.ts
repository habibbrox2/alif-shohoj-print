/** Selection model for Photoshop-7-style marquee tools. Coordinates are
 * normalised (0..1) against the canvas pixel size, matching the stroke model. */

export type SelectionMode = 'rect' | 'ellipse' | 'single';

export interface Selection {
  id: string;
  mode: SelectionMode;
  start: { x: number; y: number };
  end: { x: number; y: number };
  feather: number;
  antiAlias: boolean;
}

/** Normalise a drag so start is always the top-left corner. */
export function normalizeSelection(s: Selection): Selection {
  return {
    ...s,
    start: { x: Math.min(s.start.x, s.end.x), y: Math.min(s.start.y, s.end.y) },
    end: { x: Math.max(s.start.x, s.end.x), y: Math.max(s.start.y, s.end.y) },
  };
}

export function selectionBounds(s: Selection) {
  const n = normalizeSelection(s);
  return {
    x: n.start.x,
    y: n.start.y,
    w: Math.max(0, n.end.x - n.start.x),
    h: Math.max(0, n.end.y - n.start.y),
  };
}

/** True when a normalised point falls inside the selection rectangle/ellipse. */
export function hitTestSelection(s: Selection, point: { x: number; y: number }): boolean {
  const { x, y, w, h } = selectionBounds(s);
  if (w <= 0 || h <= 0) return false;
  if (point.x < x || point.x > x + w || point.y < y || point.y > y + h) return false;
  if (s.mode === 'ellipse') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const dx = (point.x - cx) / (w / 2);
    const dy = (point.y - cy) / (h / 2);
    return dx * dx + dy * dy <= 1;
  }
  return true;
}

/** Pure alpha mask for a selection region (no DOM). 255 = inside. */
export function buildSelectionMask(
  width: number,
  height: number,
  mode: SelectionMode
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5) / width;
      const ny = (y + 0.5) / height;
      const inside =
        mode === 'ellipse'
          ? Math.pow((nx - 0.5) * 2, 2) + Math.pow((ny - 0.5) * 2, 2) <= 1
          : true;
      mask[y * width + x] = inside ? 1 : 0;
    }
  }
  return mask;
}

/** Rasterise a selection into a canvas alpha mask (0 = outside, 255 = inside). */
export function rasterizeSelection(
  ctx: CanvasRenderingContext2D,
  s: Selection
): ImageData {
  const canvas = ctx.canvas;
  const { x, y, w, h } = selectionBounds(s);
  const pw = Math.max(1, Math.round(w * canvas.width));
  const ph = Math.max(1, Math.round(h * canvas.height));
  const mask = ctx.createImageData(pw, ph);
  const alpha = buildSelectionMask(pw, ph, s.mode);
  for (let i = 0; i < alpha.length; i += 1) {
    mask.data[i * 4 + 3] = alpha[i] ? 255 : 0;
  }
  ctx.putImageData(mask, Math.max(1, Math.round(x * canvas.width)), Math.max(1, Math.round(y * canvas.height)));
  return mask;
}

export function createSelection(
  mode: SelectionMode,
  start: { x: number; y: number },
  end: { x: number; y: number }
): Selection {
  return {
    id: `sel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    mode,
    start,
    end,
    feather: 0,
    antiAlias: true,
  };
}