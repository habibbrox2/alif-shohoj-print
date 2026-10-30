import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseHexColor,
  replaceBackgroundColor,
  type ColorReplaceOptions,
} from '../../../features/studio-editor/backgroundReplace.js';

const baseOptions: ColorReplaceOptions = {
  target: '#0000ff',
  replacement: '#ffffff',
  tolerance: 10,
  softness: 0,
  preserveLuminance: false,
};

const makeBuffer = (pixels: Array<[number, number, number]>): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], index) => {
    data[index * 4] = r;
    data[index * 4 + 1] = g;
    data[index * 4 + 2] = b;
    data[index * 4 + 3] = 255;
  });
  return data;
};

test('parseHexColor reads 6-digit and 3-digit hex', () => {
  assert.deepEqual(parseHexColor('#1e40af'), [30, 64, 175]);
  assert.deepEqual(parseHexColor('#fff'), [255, 255, 255]);
  assert.deepEqual(parseHexColor('nope'), [0, 0, 0]);
});

test('replaceBackgroundColor repaints matching pixels only', () => {
  const data = makeBuffer([
    [0, 0, 255],
    [0, 0, 250],
    [200, 30, 30],
  ]);
  const result = replaceBackgroundColor(data, 3, 1, baseOptions);
  assert.equal(result.replaced, 2);
  assert.equal(result.total, 3);
  assert.deepEqual([data[0], data[1], data[2]], [255, 255, 255]);
  assert.deepEqual([data[8], data[9], data[10]], [200, 30, 30]);
});

test('replaceBackgroundColor respects the tolerance', () => {
  const data = makeBuffer([
    [0, 0, 255],
    [0, 0, 200],
  ]);
  const result = replaceBackgroundColor(data, 2, 1, { ...baseOptions, tolerance: 0 });
  assert.equal(result.replaced, 1);
});

test('replaceBackgroundColor blends pixels inside the softness band', () => {
  const data = makeBuffer([
    [0, 0, 255],
    [60, 60, 255],
  ]);
  const result = replaceBackgroundColor(data, 2, 1, { ...baseOptions, tolerance: 0, softness: 100 });
  assert.equal(result.replaced, 2);
  // The far pixel is only partially repainted.
  const blue = data[4];
  assert.ok(blue > 0 && blue < 255, `expected a partial blend, got ${blue}`);
});

test('replaceBackgroundColor keeps luminance when asked', () => {
  const data = makeBuffer([[0, 0, 240]]);
  replaceBackgroundColor(data, 1, 1, { ...baseOptions, preserveLuminance: true });
  // A darker blue must stay darker than a full white replacement.
  const green = data[1];
  assert.ok(green < 255 && green > 0, `expected a shaded replacement, got ${green}`);
});

test('replaceBackgroundColor only touches masked pixels', () => {
  const data = makeBuffer([
    [0, 0, 255],
    [0, 0, 255],
  ]);
  const mask = { mask: new Uint8Array([1, 0]), width: 2, height: 1 };
  const result = replaceBackgroundColor(data, 2, 1, baseOptions, mask);
  assert.equal(result.replaced, 1);
  assert.deepEqual([data[0], data[1], data[2]], [255, 255, 255]);
  assert.deepEqual([data[4], data[5], data[6]], [0, 0, 255]);
});

test('replaceBackgroundColor can invert the mask', () => {
  const data = makeBuffer([
    [0, 0, 255],
    [0, 0, 255],
  ]);
  const mask = { mask: new Uint8Array([1, 0]), width: 2, height: 1 };
  const result = replaceBackgroundColor(data, 2, 1, baseOptions, mask, true);
  assert.equal(result.replaced, 1);
  assert.deepEqual([data[0], data[1], data[2]], [0, 0, 255]);
  assert.deepEqual([data[4], data[5], data[6]], [255, 255, 255]);
});
