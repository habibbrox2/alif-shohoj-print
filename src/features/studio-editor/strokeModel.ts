import type { CropPreset } from './cropPresets.js';
import type { CropRect } from './cropTool.js';
import type { EditorFilter, TextAlign } from './studioTypes.js';
import type { CloneStroke } from './cloneStamp.js';
import type { TonalStroke } from './tonalTools.js';

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
 * A content layer in the editor stack. Paint layers own the strokes drawn on
 * the canvas; the single text layer holds the watermark/annotation text.
 * The stack is ordered bottom-first: index 0 renders below later entries.
 */
export type ContentLayer =
  | { id: string; kind: 'paint'; name: string; strokes: Stroke[] }
  | { id: 'text'; kind: 'text'; name: string };

/** Id of the default paint layer seeded under the text layer. */
export const DEFAULT_PAINT_LAYER_ID = 'marks';
/** The text layer id is fixed; it always exists exactly once in the stack. */
export const TEXT_LAYER_ID = 'text';

/**
 * Create an empty paint layer with the given id and name.
 */
export function createPaintLayer(id: string, name: string): ContentLayer {
  return { id, kind: 'paint', name, strokes: [] };
}

/**
 * The starting stack: Marks below the Watermark text layer.
 */
export function defaultContentLayerStack(): ContentLayer[] {
  return [
    createPaintLayer(DEFAULT_PAINT_LAYER_ID, 'Marks'),
    { id: TEXT_LAYER_ID, kind: 'text', name: 'Watermark' },
  ];
}

/**
 * Insert a layer at `index`, returning a new stack (immutable).
 */
export function insertContentLayer(stack: ContentLayer[], index: number, layer: ContentLayer): ContentLayer[] {
  const next = [...stack];
  next.splice(index, 0, layer);
  return next;
}

/**
 * Swap a layer with its neighbour in `direction`; no-op at the ends or for unknown ids.
 */
export function moveContentLayer(stack: ContentLayer[], id: string, direction: -1 | 1): ContentLayer[] {
  const index = stack.findIndex((layer) => layer.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= stack.length) return stack;
  const next = [...stack];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Rewrite the addressed paint layer's strokes; every other layer keeps its identity.
 */
export function updatePaintLayerStrokes(
  stack: ContentLayer[],
  layerId: string,
  update: (strokes: Stroke[]) => Stroke[]
): ContentLayer[] {
  return stack.map((layer) =>
    layer.id === layerId && layer.kind === 'paint' ? { ...layer, strokes: update(layer.strokes) } : layer
  );
}

/**
 * Default name for the next paint layer: `Layer N`, N = paint-layer count + 1.
 */
export function nextPaintLayerName(stack: ContentLayer[]): string {
  const paintCount = stack.filter((layer) => layer.kind === 'paint').length;
  return `Layer ${paintCount + 1}`;
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
  /** Exposure in stops (EV), applied on top of brightness. */
  exposure: number;
  /** Hue rotation in degrees. */
  hue?: number;
  /** Warmth in percent. */
  warmth?: number;
  /** Timestamp (ms) when the history entry was created. */
  timestamp?: number;
  /** Skew X in degrees. */
  skewX?: number;
  /** Skew Y in degrees. */
  skewY?: number;
  grayscale: boolean;
  activeFilter: EditorFilter;
  cropPreset: CropPreset;
  /** Active interactive crop region, normalised against the working canvas.
   *  `undefined`/`null` means the whole canvas is kept. */
  cropRect?: CropRect | null;
  /** Custom crop width in pixels when cropPreset === 'custom'. Optional so
   *  history entries and fixtures recorded before the field existed still
   *  type-check. */
  customWidth?: number;
  /** Custom crop height in pixels when cropPreset === 'custom'. */
  customHeight?: number;
  annotationText: string;
  showWatermark: boolean;
  textColor: string;
  textSize: number;
  textAlign: TextAlign;
  /** Font id from `STUDIO_FONTS`; resolved to a CSS stack when rendering. */
  textFont: string;
  /** Whether the watermark text is rendered in bold. */
  textBold?: boolean;
  /** Whether the watermark text is rendered in italic. */
  textItalic?: boolean;
  /** Whether a drop shadow is drawn behind the watermark text. */
  textShadow?: boolean;
  /** Opacity of the watermark text (0..100). */
  textOpacity?: number;
  backgroundColor: string;
  contentLayers: ContentLayer[];
  /**
   * Clone Stamp / Healing Brush strokes that have been committed to the hidden
   * source canvas. Stored so undo/redo can replay them from the photo state
   * instead of relying on a serialised pixel buffer.
   */
  /**
   * Clone Stamp / Healing Brush strokes that have been committed to the hidden
   * source canvas. Optional so snapshots taken before this field existed
   * (older history entries, tests) still type-check.
   */
  cloneStrokes?: CloneStroke[];
  /**
   * Dodge / Burn / Sponge strokes committed to the hidden source canvas.
   * Optional for the same reason as `cloneStrokes`.
   */
  tonalStrokes?: TonalStroke[];
  showBgRemoved: boolean;
  /**
   * Blob URL of the background-removed render. Stored so undo/redo can rebuild
   * the `<img>` element; without it, undoing "Remove background" would flip
   * the flag back while the canvas still showed the transparent pixels.
   */
  bgRemovedImageUrl?: string;
  /**
   * Data URL of the render after a background colour replacement. Stored for
   * the same reason as `bgRemovedImageUrl`: the history snapshot has to carry
   * the pixels, otherwise undoing the replacement would only flip a flag.
   */
  replacedImageUrl?: string;
  /**
   * Optional human-readable label for the history step that produced this
   * snapshot. Not part of the restored state; it only drives the History list.
   */
  label?: string;
}