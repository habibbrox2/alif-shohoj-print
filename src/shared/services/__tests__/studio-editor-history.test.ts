import assert from 'node:assert/strict';
import test from 'node:test';
import { pushHistory, undo, redo, HISTORY_LIMIT } from '../../../features/studio-editor/editorHistory.js';
import type { EditorSnapshot } from '../../../features/studio-editor/strokeModel.js';

function makeSnapshot(label?: string): EditorSnapshot {
  return {
    rotation: 0,
    zoom: 1,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    exposure: 0,
    grayscale: false,
    activeFilter: 'none',
    cropPreset: 'free',
    annotationText: '',
    showWatermark: false,
    textColor: '#ffffff',
    textSize: 24,
    textAlign: 'center',
    textFont: 'Inter',
    backgroundColor: '#ffffff',
    contentLayers: [],
    showBgRemoved: false,
    label,
  };
}

test('pushHistory appends and sets index to last entry', () => {
  const s1 = makeSnapshot('a');
  const s2 = makeSnapshot('b');
  const r1 = pushHistory([], -1, s1);
  assert.equal(r1.history.length, 1);
  assert.equal(r1.index, 0);
  const r2 = pushHistory(r1.history, r1.index, s2);
  assert.equal(r2.history.length, 2);
  assert.equal(r2.index, 1);
});

test('pushHistory truncates redo tail', () => {
  const s1 = makeSnapshot('1');
  const s2 = makeSnapshot('2');
  const s3 = makeSnapshot('3');
  const s4 = makeSnapshot('4');
  let r = pushHistory([], -1, s1);
  r = pushHistory(r.history, r.index, s2);
  r = pushHistory(r.history, r.index, s3);
  // undo twice
  const u1 = undo(r.history, r.index);
  assert.ok(u1);
  const u2 = undo(u1.history, u1.index);
  assert.ok(u2);
  // push new snapshot should truncate s2, s3 (redo tail)
  r = pushHistory(u2.history, u2.index, s4);
  assert.equal(r.history.length, 2); // s1, s4
  assert.equal(r.history[r.index].label, '4');
});

test('pushHistory caps at HISTORY_LIMIT', () => {
  let history: EditorSnapshot[] = [];
  let index = -1;
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
    const res = pushHistory(history, index, makeSnapshot(String(i)));
    history = res.history;
    index = res.index;
  }
  assert.equal(history.length, HISTORY_LIMIT);
  assert.equal(history[index].label, String(HISTORY_LIMIT + 4));
});

test('undo/redo behave correctly', () => {
  let r = pushHistory([], -1, makeSnapshot('1'));
  r = pushHistory(r.history, r.index, makeSnapshot('2'));
  r = pushHistory(r.history, r.index, makeSnapshot('3'));
  assert.equal(r.index, 2);
  let u = undo(r.history, r.index);
  assert.ok(u);
  assert.equal(u.index, 1);
  let re = redo(u.history, u.index);
  assert.ok(re);
  assert.equal(re.index, 2);
  assert.equal(undo(r.history, 0), null);
  assert.equal(redo(r.history, r.history.length - 1), null);
});
