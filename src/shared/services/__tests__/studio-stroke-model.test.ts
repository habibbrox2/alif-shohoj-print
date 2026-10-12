import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addPoint,
  createBrushStroke,
  createPaintLayer,
  createShapeStroke,
  defaultContentLayerStack,
  distanceToStroke,
  eraseStrokes,
  getStrokeBounds,
  insertContentLayer,
  moveContentLayer,
  nextPaintLayerName,
  updatePaintLayerStrokes,
} from '../../../features/studio-editor/strokeModel.js';
import type { ContentLayer, Stroke } from '../../../features/studio-editor/strokeModel.js';

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

function paintStrokes(stack: ContentLayer[], id: string): Stroke[] | null {
  const layer = stack.find((candidate) => candidate.id === id);
  return layer && layer.kind === 'paint' ? layer.strokes : null;
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

test('createPaintLayer builds an empty paint layer with the given id and name', () => {
  const layer = createPaintLayer('custom', 'Custom');
  assert.deepEqual(layer, { id: 'custom', kind: 'paint', name: 'Custom', strokes: [] });
});

test('defaultContentLayerStack seeds Marks below the Watermark text layer', () => {
  const stack = defaultContentLayerStack();
  assert.equal(stack.length, 2);
  assert.deepEqual(stack[0], { id: 'marks', kind: 'paint', name: 'Marks', strokes: [] });
  assert.deepEqual(stack[1], { id: 'text', kind: 'text', name: 'Watermark' });
});

test('insertContentLayer splices without mutating the input stack', () => {
  const stack = defaultContentLayerStack();
  const layer = createPaintLayer('extra', 'Extra');
  const next = insertContentLayer(stack, 1, layer);
  assert.notEqual(next, stack);
  assert.equal(next[1], layer);
  assert.deepEqual(next.map((l) => l.id), ['marks', 'extra', 'text']);
  assert.deepEqual(stack.map((l) => l.id), ['marks', 'text']); // original unchanged
});

test('moveContentLayer swaps adjacent layers and no-ops at the ends or for unknown ids', () => {
  const stack = defaultContentLayerStack();
  const swapped = moveContentLayer(stack, 'text', -1);
  assert.deepEqual(swapped.map((l) => l.id), ['text', 'marks']);
  assert.deepEqual(stack.map((l) => l.id), ['marks', 'text']); // original unchanged
  assert.deepEqual(moveContentLayer(stack, 'marks', -1).map((l) => l.id), ['marks', 'text']); // bottom end
  assert.deepEqual(moveContentLayer(stack, 'text', 1).map((l) => l.id), ['marks', 'text']); // top end
  assert.deepEqual(moveContentLayer(stack, 'unknown', 1).map((l) => l.id), ['marks', 'text']); // unknown id
});

test('updatePaintLayerStrokes rewrites only the addressed paint layer', () => {
  const stack: ContentLayer[] = [
    createPaintLayer('a', 'Layer A'),
    createPaintLayer('b', 'Layer B'),
    { id: 'text', kind: 'text', name: 'Watermark' },
  ];
  const stroke = makeStroke([{ x: 0.1, y: 0.1 }]);
  const next = updatePaintLayerStrokes(stack, 'a', (strokes) => [...strokes, stroke]);
  assert.notEqual(next, stack);
  assert.equal(paintStrokes(next, 'a')?.length, 1);
  assert.equal(paintStrokes(next, 'b')?.length, 0);
  assert.equal(next[1], stack[1]); // untouched paint layer keeps its identity
  assert.equal(next[2], stack[2]); // text layer untouched
  assert.equal(paintStrokes(stack, 'a')?.length, 0); // original unchanged
});

test('nextPaintLayerName counts existing paint layers', () => {
  assert.equal(nextPaintLayerName([]), 'Layer 1');
  assert.equal(nextPaintLayerName(defaultContentLayerStack()), 'Layer 2');
  assert.equal(
    nextPaintLayerName([
      createPaintLayer('a', 'Layer A'),
      createPaintLayer('b', 'Layer B'),
      { id: 'text', kind: 'text', name: 'Watermark' },
    ]),
    'Layer 3',
  );
});