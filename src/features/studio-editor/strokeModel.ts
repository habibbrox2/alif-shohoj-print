import type { CropPreset } from './cropPresets.js';
import type { EditorFilter, TextAlign } from './studioTypes.js';

/**
 * A drawn overlay stroke. Coordinates are normalised (0..1) so marks survive a crop resize.
 */
export interface Stroke {
  id: string;
  kind: 'brush' | 'shape';
  shape?: 'rect' | 'ellipse';
  points: Array<{ x: number; y: number }>;
  color: string;
  size: number;
  opacity: number;
}

/**
 * Add a point to a stroke, returning a new stroke object (immutable).
 * This is the fix for the stale-closure erasure bug — we never mutate in place.
 */
export function addPoint(stroke: Stroke, point: { x: number; y: number }): Stroke {
  return {
    ...stroke,
    points: [...stroke.points, point],
  };
}

/**
 * Create a new brush stroke with the given initial point.
 */
export function createBrushStroke(
  id: string,
  point: { x: number; y: number },
  color: string,
  size: number,
  opacity: number
): Stroke {
  return {
    id,
    kind: 'brush',
    points: [point],
    color,
    size,
    opacity,
  };
}

/**
 * Create a new shape stroke with the given initial point.
 */
export function createShapeStroke(
  id: string,
  point: { x: number; y: number },
  shape: 'rect' | 'ellipse',
  color: string,
  size: number,
  opacity: number
): Stroke {
  return {
    id,
    kind: 'shape',
    shape,
    points: [point],
    color,
    size,
    opacity,
  };
}

/**
 * Calculate the distance from a point to a stroke (for eraser hit-testing).
 * Returns the minimum distance from the point to any point in the stroke.
 */
export function distanceToStroke(
  stroke: Stroke,
  point: { x: number; y: number }
): number {
  if (stroke.points.length === 0) return Infinity;

  let minDist = Infinity;
  for (const p of stroke.points) {
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    const dist = Math.hypot(dx, dy);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * Filter out strokes that are within the eraser radius of the given point.
 * Returns a new array (immutable) with matching strokes removed.
 * The eraser radius is in normalised coordinates (0..1).
 */
export function eraseStrokes(
  strokes: readonly Stroke[],
  point: { x: number; y: number },
  radius: number
): Stroke[] {
  return strokes.filter((stroke) => distanceToStroke(stroke, point) > radius);
}

/**
 * Get the bounds of a stroke in normalised coordinates.
 */
export function getStrokeBounds(stroke: Stroke): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (stroke.points.length === 0) return null;

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Everything a user can change. Snapshots of this drive undo/redo.
 */
export interface EditorSnapshot {
  rotation: number;
  zoom: number;
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: boolean;
  activeFilter: EditorFilter;
  cropPreset: CropPreset;
  annotationText: string;
  showWatermark: boolean;
  textColor: string;
  textSize: number;
  textAlign: TextAlign;
  backgroundColor: string;
  strokes: Stroke[];
  showBgRemoved: boolean;
  /**
   * Optional human-readable label for the history step that produced this
   * snapshot. Not part of the restored state; it only drives the History list.
   */
  label?: string;
}