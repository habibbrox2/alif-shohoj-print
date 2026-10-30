/**
 * Projective (homography) helpers for the perspective-warp tool.
 *
 * A homography maps a source quadrilateral to a destination quadrilateral.
 * This module is pure (no DOM/GL) so the math can be unit-tested.
 */

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];

/** A 3x3 homography stored row-major (h00..h22). */
export type Homography = [
  number, number, number,
  number, number, number,
  number, number, number
];

/**
 * Compute the homography that maps `src` quad to `dst` quad using the Direct
 * Linear Transform (DLT). Returns null when the system is singular.
 */
export function computeHomography(src: Quad, dst: Quad): Homography | null {
  // Build the 8x9 augmented matrix A | b for the 8 unknowns (h00..h21).
  // For each correspondence (x,y) -> (u,v):
  //   [x y 1 0 0 0 -u*x -u*y] [h00..h21]^T = u
  //   [0 0 0 x y 1 -v*x -v*y]               = v
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }

  // Gaussian elimination with partial pivot on the 8x9 system.
  const n = 8;
  const m = 9;
  const M = A.map(row => row.slice());
  for (let col = 0; col < n; col++) {
    // Pivot
    let pivot = col;
    let best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(M[r][col]);
      if (val > best) { best = val; pivot = r; }
    }
    if (best < 1e-12) return null;
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    // Normalize row
    const pv = M[col][col];
    for (let c = col; c < m; c++) M[col][c] /= pv;
    // Eliminate
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c < m; c++) M[r][c] -= factor * M[col][c];
    }
  }

  const h = [0, 0, 0, 0, 0, 0, 0, 0, 1] as number[];
  for (let i = 0; i < n; i++) h[i] = M[i][m - 1];
  return h as Homography;
}

/** Apply a homography to a point. */
export function applyHomography(H: Homography, x: number, y: number): Point {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-12) return { x, y };
  const nx = (H[0] * x + H[1] * y + H[2]) / w;
  const ny = (H[3] * x + H[4] * y + H[5]) / w;
  return { x: nx, y: ny };
}

/** Identity homography. */
export const identityHomography = (): Homography => [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];