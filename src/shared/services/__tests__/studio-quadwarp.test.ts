import assert from 'node:assert/strict';
import test from 'node:test';
import { applyHomography, computeHomography, identityHomography } from '../../../features/studio-editor/quadWarp.js';

test('identity homography maps a point to itself', () => {
  const H = identityHomography();
  const p = applyHomography(H, 10, 20);
  assert.deepEqual(p, { x: 10, y: 20 });
});

test('computeHomography maps src corners to dst corners', () => {
  const src = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ] as const;
  const dst = [
    { x: 10, y: 10 },
    { x: 110, y: 5 },
    { x: 105, y: 115 },
    { x: 5, y: 105 },
  ] as const;
  const H = computeHomography(src as any, dst as any);
  assert.ok(H);
  for (let i = 0; i < 4; i++) {
    const p = applyHomography(H!, src[i].x, src[i].y);
    assert.ok(Math.abs(p.x - dst[i].x) < 1e-6, `corner ${i} x`);
    assert.ok(Math.abs(p.y - dst[i].y) < 1e-6, `corner ${i} y`);
  }
});

test('computeHomography returns null for degenerate input', () => {
  const src = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ] as const;
  const dst = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ] as const;
  assert.equal(computeHomography(src as any, dst as any), null);
});