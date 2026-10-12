import assert from 'node:assert/strict';
import test from 'node:test';
import { CROP_SIZE, getInitialCropPreset, resolveCanvasSize } from '../../../features/studio-editor/cropPresets.js';

test('crop presets map to exact pixel sizes', () => {
  assert.deepEqual(CROP_SIZE.passport, { w: 413, h: 531 });
  assert.deepEqual(CROP_SIZE.stamp, { w: 250, h: 300 });
  assert.deepEqual(CROP_SIZE.nid, { w: 590, h: 375 });
  assert.deepEqual(CROP_SIZE['4r'], { w: 600, h: 400 });
  assert.deepEqual(CROP_SIZE.a4, { w: 496, h: 701 });
  assert.equal(CROP_SIZE.free, null);
});

test('resolveCanvasSize clamps auto size to 800 and honours presets', () => {
  assert.deepEqual(resolveCanvasSize('passport', 1000, 1000), { w: 413, h: 531 });
  assert.deepEqual(resolveCanvasSize('free', 1200, 900), { w: 800, h: 800 });
  assert.deepEqual(resolveCanvasSize('free', 0, 0), { w: 600, h: 600 });
});

test('getInitialCropPreset matches known aspect ratios and defaults to free', () => {
  assert.equal(getInitialCropPreset('passport'), 'passport');
  assert.equal(getInitialCropPreset('NID'), 'nid');
  assert.equal(getInitialCropPreset('4r'), '4r');
  assert.equal(getInitialCropPreset('unknown'), 'free');
  assert.equal(getInitialCropPreset(undefined), 'free');
});