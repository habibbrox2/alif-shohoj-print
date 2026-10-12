import assert from 'node:assert/strict';
import test from 'node:test';
import { HISTORY_LIMIT, pushHistory, redo, undo } from '../../../features/studio-editor/editorHistory.js';
import type { EditorSnapshot } from '../../../features/studio-editor/editorHistory.js';

const snap = (n: number): EditorSnapshot => ({
  rotation: n,
  zoom: 1,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: false,
  activeFilter: 'none',
  cropPreset: 'free',
  annotationText: '',
  showWatermark: false,
  textColor: '#fff',
  textSize: 22,
  textAlign: 'center',
  backgroundColor: '#0f172a',
  strokes: [],
  showBgRemoved: false,
});

test('pushHistory truncates any redo tail before appending', () => {
  const { history, index } = pushHistory([snap(0), snap(1), snap(2)], 1, snap(9));
  assert.equal(index, 2);
  assert.equal(history.length, 3);
  assert.equal(history[2].rotation, 9);
});

test('undo and redo move the index and are null at the ends', () => {
  const seeded = pushHistory([snap(0)], 0, snap(1));
  assert.equal(undo(seeded.history, 1)?.index, 0);
  assert.equal(undo(seeded.history, 0), null);
  assert.equal(redo(seeded.history, 0)?.index, 1);
  assert.equal(redo(seeded.history, 1), null);
});

test('history never exceeds HISTORY_LIMIT', () => {
  let state = { history: [snap(0)], index: 0 };
  for (let i = 1; i <= HISTORY_LIMIT + 20; i += 1) {
    state = pushHistory(state.history, state.index, snap(i));
  }
  assert.equal(state.history.length, HISTORY_LIMIT);
});