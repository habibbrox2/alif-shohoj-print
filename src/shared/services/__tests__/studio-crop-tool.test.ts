import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIN_CROP_EDGE,
  clampCropRect,
  cropRectToPixels,
  fitCropRectToAspect,
  fromPixels,
  moveCropRect,
  normalizeCropRect,
  normalizedAspect,
  resizeCropRect,
  resolveCropOutputSize,
  toPixels,
} from '../../../features/studio-editor/cropTool.js';

test('normalizeCropRect is order independent', () => {
  const rect = normalizeCropRect({ x: 0.8, y: 0.9 }, { x: 0.2, y: 0.1 });
  assert.equal(rect.x, 0.2);
  assert.equal(rect.y, 0.1);
  assert.ok(Math.abs(rect.w - 0.6) < 1e-9);
  assert.ok(Math.abs(rect.h - 0.8) < 1e-9);
});

test('clampCropRect keeps the rectangle inside the canvas', () => {
  const rect = clampCropRect({ x: 0.8, y: 0.9, w: 0.5, h: 0.5 });
  assert.equal(rect.x + rect.w, 1);
  assert.equal(rect.y + rect.h, 1);
  assert.equal(rect.w, 0.5);
});

test('fitCropRectToAspect returns the largest centred rectangle', () => {
  const rect = fitCropRectToAspect(0.5);
  assert.equal(rect.w, 0.5);
  assert.equal(rect.h, 1);
  assert.equal(rect.x, 0.25);
  assert.equal(rect.y, 0);

  const wide = fitCropRectToAspect(2);
  assert.equal(wide.w, 1);
  assert.equal(wide.h, 0.5);
  assert.equal(wide.y, 0.25);
});

test('normalizedAspect converts a pixel aspect into the canvas aspect', () => {
  // A 1500x1200 crop inside a square canvas keeps a normalised aspect of 1.25.
  assert.equal(normalizedAspect(1500 / 1200, 800, 800), 1.25);
  // On a 2:1 canvas the same pixel aspect needs a different normalised ratio.
  assert.equal(normalizedAspect(1500 / 1200, 800, 400), 0.625);
});

test('resizeCropRect keeps the opposite corner anchored', () => {
  const rect = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
  const next = resizeCropRect(rect, 'se', 0.1, 0.1);
  assert.equal(next.x, 0.2);
  assert.equal(next.y, 0.2);
  assert.ok(Math.abs(next.w - 0.5) < 1e-9);
  assert.ok(Math.abs(next.h - 0.5) < 1e-9);
});

test('resizeCropRect honours the aspect ratio while dragging a corner', () => {
  const rect = { x: 0, y: 0, w: 0.5, h: 0.5 };
  const next = resizeCropRect(rect, 'se', 0.5, 0.1, 1);
  assert.ok(Math.abs(next.w - next.h) < 1e-9);
  assert.equal(next.x, 0);
  assert.equal(next.y, 0);
});

test('resizeCropRect never shrinks below the minimum edge', () => {
  const rect = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
  const next = resizeCropRect(rect, 'nw', 0.2, 0.2);
  assert.ok(next.w >= MIN_CROP_EDGE - 1e-9);
  assert.ok(next.h >= MIN_CROP_EDGE - 1e-9);
});

test('moveCropRect keeps the rectangle inside the canvas', () => {
  const moved = moveCropRect({ x: 0.8, y: 0.8, w: 0.4, h: 0.4 }, 0.5, 0.5);
  assert.equal(moved.x + moved.w, 1);
  assert.equal(moved.y + moved.h, 1);
});

test('cropRectToPixels converts to canvas pixels', () => {
  const px = cropRectToPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 400, 200);
  assert.deepEqual(px, { x: 100, y: 100, w: 200, h: 50 });
});

test('resolveCropOutputSize uses the target size when given', () => {
  const crop = { x: 0, y: 0, w: 120, h: 90 };
  assert.deepEqual(resolveCropOutputSize(crop, { w: 413, h: 531 }), { w: 413, h: 531 });
  assert.deepEqual(resolveCropOutputSize(crop, null), { w: 120, h: 90 });
});

test('toPixels and fromPixels round-trip through print units', () => {
  assert.equal(toPixels(5, 'in'), 1500);
  assert.equal(toPixels(25.4, 'mm'), 300);
  assert.equal(toPixels(640, 'px'), 640);
  assert.equal(fromPixels(1500, 'in'), 5);
  assert.equal(fromPixels(300, 'mm'), 25.4);
  assert.equal(fromPixels(640, 'px'), 640);
});
