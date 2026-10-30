/** Magic Wand: connected-component flood fill on a canvas pixel buffer.
 *
 * Tolerance is 0..100 and compared against the maximum channel delta, so 0 is
 * an exact colour match and 100 selects everything connected. The seed is in
 * canvas pixel coordinates. Returns a Uint8Array mask (1 = inside, 0 = outside).
 */

export interface MagicWandResult {
  mask: Uint8Array;
  width: number;
  height: number;
  count: number;
}

function channelDelta(a: number, b: number): number {
  return Math.abs(a - b) / 255;
}

/** 4-connected flood fill. Tolerance 0 matches exact colours only. */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  tolerance: number
): MagicWandResult {
  const mask = new Uint8Array(width * height);
  const stack: Array<[number, number]> = [[seedX, seedY]];
  const tol = Math.max(0, Math.min(100, tolerance)) / 100;
  let count = 0;

  const idx = (seedY * width + seedX) * 4;
  const sr = data[idx];
  const sg = data[idx + 1];
  const sb = data[idx + 2];

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const mi = y * width + x;
    if (mask[mi]) continue;

    const i = mi * 4;
    if (channelDelta(data[i], sr) > tol || channelDelta(data[i + 1], sg) > tol || channelDelta(data[i + 2], sb) > tol) continue;

    mask[mi] = 1;
    count += 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { mask, width, height, count };
}

/** Convert a mask into a normalised selection rect (bounding box). */
export function maskToSelection(
  result: MagicWandResult
): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  let minX = result.width;
  let minY = result.height;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < result.mask.length; i += 1) {
    if (!result.mask[i]) continue;
    const x = i % result.width;
    const y = (i / result.width) | 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (minX > maxX) return null;
  return {
    start: { x: minX / result.width, y: minY / result.height },
    end: { x: (maxX + 1) / result.width, y: (maxY + 1) / result.height },
  };
}