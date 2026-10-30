import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleOffset } from '../../../features/studio-editor/cloneStamp.js';
import type { CloneStroke } from '../../../features/studio-editor/cloneStamp.js';

const stroke = (offset: { x: number; y: number }): CloneStroke => ({
  id: 's1',
  points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
  sampleOffset: offset,
  size: 10,
  opacity: 100,
  kind: 'clone',
});

test('sampleOffset returns the stored offset verbatim', () => {
  assert.deepEqual(sampleOffset(stroke({ x: 0.3, y: -0.2 })), { x: 0.3, y: -0.2 });
});

test('sampleOffset is stable across strokes with the same offset', () => {
  const a = sampleOffset(stroke({ x: 0.5, y: 0.5 }));
  const b = sampleOffset(stroke({ x: 0.5, y: 0.5 }));
  assert.deepEqual(a, b);
});

test('sampleOffset does not drift when the stroke gains points', () => {
  const s = stroke({ x: 0.25, y: 0.25 });
  s.points.push({ x: 0.9, y: 0.9 });
  assert.deepEqual(sampleOffset(s), { x: 0.25, y: 0.25 });
});