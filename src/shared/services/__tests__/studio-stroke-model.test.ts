import assert from 'node:assert/strict';
import test from 'node:test';
import { addPoint, createBrushStroke, createShapeStroke, distanceToStroke, eraseStrokes, getStrokeBounds } from '../../../features/studio-editor/strokeModel.js';

function makeStroke(points: Array<{ x: number; y: number }> = [], kind: 'brush' | 'shape' = 'brush'): import('../../../features/studio-editor/strokeModel.js').Stroke {
  return {
    id: 'test-stroke',
    kind,
    ...(kind === 'shape' ? { shape: 'rect' as const } : {}),
    points,
    color: '#14b8a6',
    size: 8,
    opacity: 100,
  };
}

test('addPoint returns a new stroke with the point appended (immutable)', () => {
  const stroke = makeStroke([{ x: 0.1, y: 0.2 }]);
  const next = addPoint(stroke, { x: 0.3, y: 0.4 });
  assert.equal(next.points.length, 2);
  assert.deepEqual(next.points[1], { x: 0.3, y: 0.4 });
  assert.equal(stroke.points.length, 1); // original unchanged
  assert.notEqual(next, stroke); // new object
});

test('createBrushStroke produces a valid brush stroke', () => {
  const stroke = createBrushStroke('id1', { x: 0.5, y: 0.5 }, '#ff0000', 10, 80);
  assert.equal(stroke.kind, 'brush');
  assert.equal(stroke.points.length, 1);
  assert.deepEqual(stroke.points[0], { x: 0.5, y: 0.5 });
  assert.equal(stroke.color, '#ff0000');
  assert.equal(stroke.size, 10);
  assert.equal(stroke.opacity, 80);
});

test('createShapeStroke produces a valid shape stroke', () => {
  const stroke = createShapeStroke('id2', { x: 0.1, y: 0.1 }, 'ellipse', '#00ff00', 5, 60);
  assert.equal(stroke.kind, 'shape');
  assert.equal(stroke.shape, 'ellipse');
  assert.equal(stroke.points.length, 1);
  assert.deepEqual(stroke.points[0], { x: 0.1, y: 0.1 });
});

test('distanceToStroke returns minimum distance to any point', () => {
  const stroke = makeStroke([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  assert.equal(distanceToStroke(stroke, { x: 0, y: 0 }), 0);
  // distance to nearest point in stroke (0,0) or (1,1) is sqrt(0.5^2 + 0.5^2)
  assert.equal(distanceToStroke(stroke, { x: 0.5, y: 0.5 }), Math.sqrt(0.5)); // ~0.7071
  assert.ok(distanceToStroke(stroke, { x: 1, y: 0 }) > 0);
});

test('distanceToStroke returns Infinity for empty stroke', () => {
  const stroke = makeStroke([]);
  assert.equal(distanceToStroke(stroke, { x: 0, y: 0 }), Infinity);
});

test('eraseStrokes removes strokes within radius (immutable)', () => {
  const strokes = [
    makeStroke([{ x: 0.1, y: 0.1 }]),
    makeStroke([{ x: 0.5, y: 0.5 }]),
    makeStroke([{ x: 0.9, y: 0.9 }]),
  ];
  const result = eraseStrokes(strokes, { x: 0.1, y: 0.1 }, 0.2);
  assert.equal(result.length, 2);
  assert.ok(result.every((s) => s.points[0].x !== 0.1 || s.points[0].y !== 0.1));
  assert.equal(strokes.length, 3); // original unchanged
});

test('eraseStrokes keeps strokes outside radius', () => {
  const strokes = [
    makeStroke([{ x: 0.1, y: 0.1 }]),
    makeStroke([{ x: 0.5, y: 0.5 }]),
  ];
  const result = eraseStrokes(strokes, { x: 0.9, y: 0.9 }, 0.1);
  assert.equal(result.length, 2);
});

test('getStrokeBounds returns bounds for non-empty stroke', () => {
  const stroke = makeStroke([{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.1 }, { x: 0.5, y: 0.9 }]);
  const bounds = getStrokeBounds(stroke);
  assert.deepEqual(bounds, { minX: 0.2, minY: 0.1, maxX: 0.8, maxY: 0.9 });
});

test('getStrokeBounds returns null for empty stroke', () => {
  const stroke = makeStroke([]);
  assert.equal(getStrokeBounds(stroke), null);
});