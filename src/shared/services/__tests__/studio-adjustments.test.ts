import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPhotoFilter,
  buildRulerTicks,
  clampAdjustment,
  editorHistorySummary,
} from '../../../features/studio-editor/studioAdjustments.js';
import type { EditorSnapshot } from '../../../features/studio-editor/editorHistory.js';

const snapshot = (overrides: Partial<EditorSnapshot> = {}): EditorSnapshot => ({
  rotation: 0,
  zoom: 1,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: false,
  activeFilter: 'none',
  cropPreset: 'free',
  annotationText: '',
  showWatermark: false,
  textColor: '#ffffff',
  textSize: 22,
  textAlign: 'center',
  backgroundColor: '#0f172a',
  strokes: [],
  showBgRemoved: false,
  ...overrides,
});

test('buildPhotoFilter mirrors the adjustment values when visible', () => {
  assert.equal(
    buildPhotoFilter({
      brightness: 120,
      contrast: 90,
      saturation: 150,
      grayscale: false,
      activeFilter: 'none',
      adjustmentsVisible: true,
    }),
    'brightness(120%) contrast(90%) saturate(150%)',
  );
});

test('buildPhotoFilter falls back to identity when adjustments are hidden', () => {
  assert.equal(
    buildPhotoFilter({
      brightness: 180,
      contrast: 50,
      saturation: 200,
      grayscale: true,
      activeFilter: 'bw_doc',
      adjustmentsVisible: false,
    }),
    'brightness(100%) contrast(100%) saturate(100%)',
  );
});

test('buildPhotoFilter appends grayscale and sharpen terms', () => {
  const grayscale = buildPhotoFilter({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: false,
    activeFilter: 'bw_doc',
    adjustmentsVisible: true,
  });
  assert.ok(grayscale.endsWith('grayscale(100%)'));

  const sharp = buildPhotoFilter({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: false,
    activeFilter: 'high_sharp',
    adjustmentsVisible: true,
  });
  assert.ok(sharp.endsWith('contrast(130%) brightness(105%)'));
});

test('clampAdjustment clamps and rejects non-finite values', () => {
  assert.equal(clampAdjustment(500, 0, 200), 200);
  assert.equal(clampAdjustment(-10, 0, 200), 0);
  assert.equal(clampAdjustment(Number.NaN, 50, 180), 50);
});

test('buildRulerTicks spreads evenly across the axis length', () => {
  assert.deepEqual(buildRulerTicks(600, 4), [
    { ratio: 0, px: 0 },
    { ratio: 0.25, px: 150 },
    { ratio: 0.5, px: 300 },
    { ratio: 0.75, px: 450 },
    { ratio: 1, px: 600 },
  ]);
  assert.deepEqual(buildRulerTicks(0, 4), [
    { ratio: 0, px: 0 },
    { ratio: 0.25, px: 0 },
    { ratio: 0.5, px: 0 },
    { ratio: 0.75, px: 0 },
    { ratio: 1, px: 0 },
  ]);
});

test('editorHistorySummary labels the active step', () => {
  assert.equal(editorHistorySummary(snapshot(), 0), 'Opened');
  assert.equal(editorHistorySummary(snapshot({ cropPreset: 'passport' }), 2), 'Crop · passport');
  assert.equal(editorHistorySummary(snapshot({ label: 'Brightness', cropPreset: 'passport' }), 3), 'Brightness');
  assert.equal(
    editorHistorySummary(
      snapshot({
        strokes: [
          { id: 's1', kind: 'brush', points: [{ x: 0.1, y: 0.1 }], color: '#fff', size: 8, opacity: 100 },
        ],
      }),
      1,
    ),
    'Marks',
  );
  assert.equal(editorHistorySummary(snapshot({ showWatermark: true }), 1), 'Watermark');
  assert.equal(editorHistorySummary(snapshot({ rotation: 90 }), 1), 'Rotate');
  assert.equal(editorHistorySummary(snapshot({ brightness: 120 }), 1), 'Adjust');
});
