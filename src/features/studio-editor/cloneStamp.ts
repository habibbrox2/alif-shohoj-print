/** Clone Stamp + Healing Brush.
 *
 * A clone stroke samples pixels from a source offset relative to the stroke's
 * own start point, so the offset is stable across strokes — the classic
 * "double-image" bug is avoided by never recomputing the offset from the
 * current pointer position.
 */

export interface CloneStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  /** Offset in normalised canvas units from the stroke start to the sampled pixel. */
  sampleOffset: { x: number; y: number };
  size: number;
  opacity: number;
  kind: 'clone' | 'heal';
  /**
   * Pixel snapshot of the hidden source canvas taken *before* this stroke was
   * drawn. Stored as a base64 data URL so undo can restore the canvas to its
   * pre-stroke state without replaying every prior stroke.
   */
  sourceSnapshot?: string;
}

/** Sample a pixel offset once per stroke; never re-derive it from the pointer. */
export function sampleOffset(stroke: CloneStroke): { x: number; y: number } {
  return stroke.sampleOffset;
}

/**
 * Restore the hidden source canvas from a stored pre-stroke snapshot.
 * Used by undo so the canvas reverts pixel-perfectly instead of replaying.
 */
export function restoreSourceSnapshot(
  sctx: CanvasRenderingContext2D,
  dataUrl: string
): void {
  const img = new Image();
  img.src = dataUrl;
  img.onload = () => {
    sctx.clearRect(0, 0, sctx.canvas.width, sctx.canvas.height);
    sctx.drawImage(img, 0, 0);
  };
}

/**
 * Draw a cloned stroke onto `dst` from `src`. Both canvases must share the
 * same pixel dimensions. Coordinates are normalised (0..1).
 */
export function drawClonedStroke(
  dst: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  stroke: CloneStroke,
  options?: { snapshot?: boolean }
): void {
  const snap = options?.snapshot;
  if (snap && dst.canvas) {
    const w = dst.canvas.width;
    const h = dst.canvas.height;
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const t = tmp.getContext('2d');
    if (t) {
      t.drawImage(dst.canvas, 0, 0);
      stroke.sourceSnapshot = tmp.toDataURL();
    }
  }
  const w = dst.canvas.width;
  const h = dst.canvas.height;
  const offset = sampleOffset(stroke);
  const radius = Math.max(1, stroke.size / 2);
  const alpha = stroke.opacity / 100;

  dst.save();
  dst.globalAlpha = alpha;
  dst.lineCap = 'round';
  dst.lineJoin = 'round';
  dst.lineWidth = stroke.size;

  for (let i = 1; i < stroke.points.length; i += 1) {
    const a = stroke.points[i - 1];
    const b = stroke.points[i];
    const sx = a.x * w + offset.x * w;
    const sy = a.y * h + offset.y * h;
    const dx = a.x * w;
    const dy = a.y * h;
    const ex = b.x * w;
    const ey = b.y * h;
    // Sample a soft circular brush from the source and paint it onto the dest.
    const steps = Math.max(1, Math.ceil(stroke.size));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const px = dx + (ex - dx) * t;
      const py = dy + (ey - dy) * t;
      const spx = sx + (ex - dx) * t;
      const spy = sy + (ey - dy) * t;
      const img = src.getImageData(
        Math.max(0, Math.round(spx - radius)),
        Math.max(0, Math.round(spy - radius)),
        Math.max(1, Math.round(radius * 2)),
        Math.max(1, Math.round(radius * 2))
      );
      const off = dst.createImageData(img.width, img.height);
      for (let p = 0; p < img.data.length; p += 4) {
        const lx = p / 4 % img.width;
        const ly = (p / 4 / img.width) | 0;
        const dx2 = lx - img.width / 2;
        const dy2 = ly - img.height / 2;
        const a = Math.max(0, 1 - Math.hypot(dx2, dy2) / radius);
        off.data[p + 3] = img.data[p + 3] * a;
      }
      dst.putImageData(off, Math.round(px - radius), Math.round(py - radius));
    }
  }
  dst.restore();
}