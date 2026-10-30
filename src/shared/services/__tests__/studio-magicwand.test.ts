import assert from 'node:assert/strict';
import test from 'node:test';
import { floodFill, maskToSelection } from '../../../features/studio-editor/magicWand.js';

/** Build a pixel buffer where a red block sits on a green background. */
function redOnGreen(w = 10, h = 10) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (x < 5 && y < 5) {
        data[i] = 255; // R
        data[i + 1] = 0;
        data[i + 2] = 0;
      } else {
        data[i] = 0;
        data[i + 1] = 255; // G
        data[i + 2] = 0;
      }
      data[i + 3] = 255;
    }
  }
  return data;
}

test('tolerance 0 selects only the exact red block', () => {
  const r = floodFill(redOnGreen(), 10, 10, 0, 0, 0);
  assert.equal(r.count, 25);
});

test('tolerance 100 selects the whole buffer', () => {
  const r = floodFill(redOnGreen(), 10, 10, 0, 0, 100);
  assert.equal(r.count, 100);
});

test('tolerance 50 stays inside the red block', () => {
  const r = floodFill(redOnGreen(), 10, 10, 0, 0, 50);
  assert.equal(r.count, 25);
});

test('maskToSelection returns a normalised bounding box', () => {
  const r = floodFill(redOnGreen(), 10, 10, 0, 0, 0);
  const box = maskToSelection(r);
  assert.ok(box);
  assert.equal(box.start.x, 0);
  assert.equal(box.start.y, 0);
  assert.equal(box.end.x, 0.5);
  assert.equal(box.end.y, 0.5);
});

test('maskToSelection returns null for an empty mask', () => {
  const empty = new Uint8Array(100);
  const r = { mask: empty, width: 10, height: 10, count: 0 };
  assert.equal(maskToSelection(r), null);
});