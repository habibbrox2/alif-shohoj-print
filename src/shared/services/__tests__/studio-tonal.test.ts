import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTonalAdjustment } from '../../../features/studio-editor/tonalTools.js';

function gray(v: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(4);
  d[0] = v; d[1] = v; d[2] = v; d[3] = 255;
  return d;
}

test('dodge lightens midtones', () => {
  const out = applyTonalAdjustment(gray(120), 1, 1, 'dodge', 0.2, 'midtones');
  assert.ok(out[0] > 120);
});

test('burn darkens midtones', () => {
  const out = applyTonalAdjustment(gray(120), 1, 1, 'burn', 0.2, 'midtones');
  assert.ok(out[0] < 120);
});

test('sponge desaturates toward luminance', () => {
  const buf = new Uint8ClampedArray(4);
  buf[0] = 200; buf[1] = 100; buf[2] = 0; buf[3] = 255;
  const out = applyTonalAdjustment(buf, 1, 1, 'sponge', 0.5, 'midtones');
  // luminance ≈ 0.299*200 + 0.587*100 = 118.6; sat gain 1.5 pulls toward it.
  assert.ok(Math.abs(out[0] - out[1]) < Math.abs(200 - 100));
});

test('shadows range leaves highlights untouched', () => {
  const buf = new Uint8ClampedArray(8);
  buf[0] = 200; buf[1] = 200; buf[2] = 200; buf[3] = 255;
  buf[4] = 30; buf[5] = 30; buf[6] = 30; buf[7] = 255;
  const out = applyTonalAdjustment(buf, 2, 1, 'dodge', 0.3, 'shadows');
  assert.equal(out[0], 200);
  assert.ok(out[4] > 30);
});

test('exposure is clamped to [-1, 1]', () => {
  // Exposure magnitude is clamped to 1 → a full 255-step adjustment, then
  // the pixel value is clamped to the 0..255 range.
  const out = applyTonalAdjustment(gray(120), 1, 1, 'dodge', 5, 'midtones');
  assert.equal(out[0], 255);
  const dark = applyTonalAdjustment(gray(120), 1, 1, 'burn', 5, 'midtones');
  assert.equal(dark[0], 0);
});