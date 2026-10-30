import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSelectionMask,
  createSelection,
  hitTestSelection,
  normalizeSelection,
  rasterizeSelection,
  selectionBounds,
} from '../../../features/studio-editor/selectionModel.js';

test('normalizeSelection keeps start as top-left', () => {
  const s = normalizeSelection(
    createSelection('rect', { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.2 })
  );
  assert.equal(s.start.x, 0.2);
  assert.equal(s.start.y, 0.2);
  assert.equal(s.end.x, 0.8);
  assert.equal(s.end.y, 0.8);
});

test('selectionBounds returns zero-area for a point selection', () => {
  const s = createSelection('rect', { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 });
  const b = selectionBounds(s);
  assert.equal(b.w, 0);
  assert.equal(b.h, 0);
});

test('hitTestSelection rejects points outside the rect', () => {
  const s = normalizeSelection(
    createSelection('rect', { x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 })
  );
  assert.equal(hitTestSelection(s, { x: 0.35, y: 0.35 }), true);
  assert.equal(hitTestSelection(s, { x: 0.6, y: 0.3 }), false);
});

test('hitTestSelection ellipse rejects corners', () => {
  const s = normalizeSelection(
    createSelection('ellipse', { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 })
  );
  assert.equal(hitTestSelection(s, { x: 0.5, y: 0.5 }), true);
  assert.equal(hitTestSelection(s, { x: 0.25, y: 0.25 }), false);
});

test('buildSelectionMask fills the whole rect and rejects ellipse corners', () => {
  const rect = buildSelectionMask(100, 100, 'rect');
  assert.equal(rect[0], 1);
  assert.equal(rect[rect.length - 1], 1);
  const ellipse = buildSelectionMask(100, 100, 'ellipse');
  assert.equal(ellipse[50 * 100 + 50], 1);
  // corner is outside the inscribed ellipse
  assert.equal(ellipse[0], 0);
  assert.equal(ellipse[99 * 100 + 99], 0);
});