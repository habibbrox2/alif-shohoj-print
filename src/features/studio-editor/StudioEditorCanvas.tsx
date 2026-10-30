import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  Palette,
  PanelLeft,
  PanelRight,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  SlidersHorizontal,
  Sun,
  Type,
  Undo2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { PrintJob } from '../../shared/types';
import { useTheme } from '../../shared/context/ThemeContext';
import { removeBackground } from '@imgly/background-removal';
import { CROP_PRESETS, CROP_SIZE, getInitialCropPreset, type CropPreset } from './cropPresets';
import { validateImageFile, readFileAsDataUrl } from './validateImageFile';
import {
  DEFAULT_PAINT_LAYER_ID,
  addPoint,
  createBrushStroke,
  createPaintLayer,
  createShapeStroke,
  defaultContentLayerStack,
  eraseStrokes,
  insertContentLayer,
  moveContentLayer,
  nextPaintLayerName,
  updatePaintLayerStrokes,
  type ContentLayer,
  type Stroke,
} from './strokeModel';
import { pushHistory, undo, redo, HISTORY_LIMIT, type EditorSnapshot } from './editorHistory';
import {
  ADJUSTMENT_RANGES,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BRUSH_COLOR,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_TEXT_FONT,
  DEFAULT_TEXT_SIZE,
  STUDIO_FONTS,
  buildPhotoFilter,
  buildRulerTicks,
  clampAdjustment,
  editorHistorySummary,
  resolveFontStack,
} from './studioAdjustments';
import type { EditorFilter, StudioCanvasAdjustments, TextAlign, ToolId } from './studioTypes';
import { buildSelectionMask, createSelection, hitTestSelection, normalizeSelection, rasterizeSelection, selectionBounds, type Selection, type SelectionMode } from './selectionModel';
import { floodFill, maskToSelection, type MagicWandResult } from './magicWand';
import { drawClonedStroke, sampleOffset, type CloneStroke } from './cloneStamp';
import { applyTonalAdjustment, stampTonalPatch, type TonalMode, type TonalRange, type TonalStroke } from './tonalTools';
import { StudioOverflowMenu, StudioStatusBar, StudioToolRail, getStudioTool, type StudioMenuItem } from './StudioWorkspaceChrome';
import { PrintDialog } from './PrintDialog';
import { createWebGLWarpRenderer } from './webglWarpRenderer';
import type { Quad } from './quadWarp';
import {
  clampCropRect,
  cropRectToPixels,
  fitCropRectToAspect,
  fromPixels,
  moveCropRect,
  normalizeCropRect,
  normalizedAspect,
  resizeCropRect,
  resolveCropOutputSize,
  toPixels,
  type CropHandle,
  type CropPoint,
  type CropRect,
  type SizeUnit,
} from './cropTool';
import { replaceBackgroundColor } from './backgroundReplace';

interface StudioEditorCanvasProps {
  initialImageUrl?: string;
  job?: PrintJob;
  onSave?: (editedImageUrl: string, adjustments: StudioCanvasAdjustments) => void;
  onClose?: () => void;
  onPrintPreview?: () => void;
  /**
   * Walk-in print hook. The default path routes through the desktop queue
   * (`printWithSettings`), which refuses when there is no job — that is the
   * walk-in case, where the host page owns job creation and hands back a
   * result instead.
   */
  onPrint?: (request: { dataUrl: string; settings: import('./printSettings').PrintSettings }) => Promise<import('./printBackend').PrintResult>;
  /** Connected printers, used to route a walk-in job to a real device. */
  printers?: import('../../shared/types').PrinterDevice[];
}

type RightTab = 'layers' | 'props' | 'history';

const COLOR_SWATCHES = ['#ffffff', '#111827', '#ef4444', '#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6'];
const FILTERS: ReadonlyArray<{ id: EditorFilter; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'passport_blue', label: 'Passport blue' },
  { id: 'clean_white', label: 'Clean white' },
  { id: 'high_sharp', label: 'Sharpen' },
  { id: 'bw_doc', label: 'B/W document' },
];
const TOUR_STORAGE_KEY = 'alif-shohoj-print-studio-tour';

/* ------------------------------------------------------------------ atoms */

const IconButton: React.FC<{
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}> = ({ onClick, label, children, active = false, disabled = false, tone = 'default' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={`grid h-8 w-8 place-items-center rounded-[9px] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
      disabled
        ? 'cursor-not-allowed text-text-tertiary/40'
        : active
          ? tone === 'danger'
            ? 'bg-error-bg text-error'
            : 'bg-brand-soft text-brand'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
    }`}
  >
    {children}
  </button>
);

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, suffix = '', onChange }) => (
  <label className="block">
    <span className="mb-1.5 flex items-baseline justify-between text-[11px] text-text-secondary">
      <span>{label}</span>
      <span className="font-mono tabular-nums text-brand">
        {value}
        {suffix}
      </span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      className="studio-range h-1 w-full cursor-pointer appearance-none rounded-full bg-bg-tertiary"
    />
  </label>
);

/** Single-row adjustment control: label | range | live value. */
const AdjustmentRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, suffix = '', onChange }) => (
  <div className="flex items-center gap-2">
    <span className="w-16 shrink-0 text-[11px] text-text-secondary">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      aria-label={label}
      className="studio-range h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-bg-tertiary"
    />
    <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-brand">
      {value}
      {suffix}
    </span>
  </div>
);

/** Swatch row with a custom-colour picker; shared by the options bar and Props tab. */
const ColorPickerRow: React.FC<{
  value: string;
  label: string;
  onSelect: (color: string) => void;
}> = ({ value, label, onSelect }) => (
  <div className="flex items-center gap-2">
    <Swatches value={value} label={label} onSelect={onSelect} />
    <label
      className="relative grid h-6 w-6 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-border-primary"
      title={`Custom ${label.toLowerCase()}`}
    >
      <span className="block h-full w-full" style={{ backgroundColor: value }} />
      <input
        type="color"
        value={value}
        onChange={event => onSelect(event.target.value)}
        aria-label={`Custom ${label.toLowerCase()}`}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  </div>
);

const PanelSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, open, onToggle, children }) => (
  <section className="border-b border-border-secondary last:border-b-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover/60"
    >
      <span className="text-brand">{icon}</span>
      <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">{title}</span>
      <span className="text-text-tertiary">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </span>
    </button>
    {open && <div className="space-y-3 px-3.5 pb-3.5">{children}</div>}
  </section>
);

const Swatches: React.FC<{ value: string; label: string; onSelect: (color: string) => void }> = ({ value, label, onSelect }) => (
  <div className="flex flex-wrap gap-1.5">
    {COLOR_SWATCHES.map(color => (
      <button
        key={color}
        type="button"
        onClick={() => onSelect(color)}
        title={color}
        aria-label={`${label} ${color}`}
        className={`h-5 w-5 rounded-full ring-offset-1 ring-offset-surface transition-all ${
          value === color ? 'ring-2 ring-brand' : 'ring-1 ring-white/15 hover:ring-white/40'
        }`}
        style={{ backgroundColor: color }}
      />
    ))}
  </div>
);

const FontSelect: React.FC<{ value: string; onChange: (font: string) => void }> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={event => onChange(event.target.value)}
    aria-label="Font"
    className="rounded-[9px] border border-border-primary bg-bg-secondary px-2 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
  >
    {STUDIO_FONTS.map(font => (
      <option key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
        {font.label}
      </option>
    ))}
  </select>
);

const TextAlignButtons: React.FC<{ value: TextAlign; onSelect: (align: TextAlign) => void }> = ({ value, onSelect }) => (
  <div className="flex gap-1">
    {(['left', 'center', 'right'] as const).map(align => (
      <button
        key={align}
        type="button"
        onClick={() => onSelect(align)}
        title={`Align ${align}`}
        aria-label={`Align ${align}`}
        aria-pressed={value === align}
        className={`grid h-7 w-7 place-items-center rounded-[8px] text-[11px] font-semibold uppercase transition-colors ${
          value === align ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
        }`}
      >
        {align[0]}
      </button>
    ))}
  </div>
);

function parseHexColor(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const n = parseInt(cleaned, 16);
  if (Number.isNaN(n) || cleaned.length !== 6) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Bounds for a custom crop edge. The lower bound keeps canvas dimensions
 *  non-zero; the upper bound stops a typo from allocating a huge canvas. */
const CUSTOM_CROP_MIN = 16;
const CUSTOM_CROP_MAX = 4000;

/** Grab points of the crop box, in normalised crop-box coordinates. */
const CROP_HANDLES: ReadonlyArray<{ id: CropHandle; x: number; y: number; cursor: string }> = [
  { id: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { id: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
  { id: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { id: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { id: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
  { id: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { id: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { id: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
];

function clampCustomSize(value: number): number {
  if (!Number.isFinite(value)) return CUSTOM_CROP_MIN;
  return Math.min(CUSTOM_CROP_MAX, Math.max(CUSTOM_CROP_MIN, Math.round(value)));
}

/* ------------------------------------------------------------------ main */

export const StudioEditorCanvas: React.FC<StudioEditorCanvasProps> = ({ initialImageUrl, job, printers, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const cloneStrokeRef = useRef<CloneStroke | null>(null);
  const erasingRef = useRef(false);
  const tonalStrokeRef = useRef(false);
  // Track object URLs created by this component to prevent memory leaks
  const objectUrlRefs = useRef<Set<string>>(new Set());
  const trackObjectUrl = useCallback((url: string) => {
    if (url?.startsWith('blob:')) objectUrlRefs.current.add(url);
    return url;
  }, []);
  const revokeObjectUrl = useCallback((url?: string | null) => {
    if (!url?.startsWith('blob:')) return;
    try { URL.revokeObjectURL(url); } catch {}
    objectUrlRefs.current.delete(url);
  }, []);
  const revokeAllObjectUrls = useCallback(() => {
    for (const url of objectUrlRefs.current) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    objectUrlRefs.current.clear();
  }, []);
  // Active interactive crop gesture (new box, move or resize).
  const cropDragRef = useRef<{
    mode: 'new' | 'move' | 'resize';
    handle: CropHandle;
    start: CropPoint;
    rect: CropRect;
  } | null>(null);
  // The crop overlay element; pointer maths uses its box.
  const cropOverlayRef = useRef<HTMLDivElement>(null);
  // The editor shell follows the app's resolved theme (ThemeContext swaps the
  // class on <html> live), so the whole workspace reacts without a reload.
  const { resolvedTheme } = useTheme();
  const themeLabel = resolvedTheme === 'dark' ? 'Dark' : 'Light (Gray)';

  const imageUrl = initialImageUrl || job?.fileUrl || '';

  // --- tool state
  const [tool, setTool] = useState<ToolId>('move');
  const [brushSize, setBrushSize] = useState<number>(8);
  const [brushOpacity, setBrushOpacity] = useState<number>(100);
  const [brushColor, setBrushColor] = useState<string>(DEFAULT_BRUSH_COLOR);
  const [shapeKind, setShapeKind] = useState<'rect' | 'ellipse'>('rect');

  // --- view state
  const [viewZoom, setViewZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showChecker, setShowChecker] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showRulers, setShowRulers] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // --- edit state
  const [rotation, setRotation] = useState<number>(job?.cropSettings?.rotation || 0);
  const [scale, setScale] = useState<number>(job?.cropSettings?.zoom || 1);
  const [brightness, setBrightness] = useState<number>(job?.cropSettings?.brightness || 100);
  const [hue, setHue] = useState<number>(job?.cropSettings?.hue || 0);
  const [warmth, setWarmth] = useState<number>(job?.cropSettings?.warmth || 0);
  const [skewX, setSkewX] = useState<number>(job?.cropSettings?.skewX || 0);
  const [skewY, setSkewY] = useState<number>(job?.cropSettings?.skewY || 0);
  const [contrast, setContrast] = useState<number>(job?.cropSettings?.contrast || 100);
  const [saturation, setSaturation] = useState<number>(100);
  const [exposure, setExposure] = useState<number>(0);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<EditorFilter>('none');
  const [cropPreset, setCropPreset] = useState<CropPreset>(getInitialCropPreset(job?.cropSettings?.aspectRatio));
  const [customWidth, setCustomWidth] = useState<number>(600);
  const [customHeight, setCustomHeight] = useState<number>(600);
  // Photoshop-style chain: when linked, editing one side preserves the current ratio.
  const [customAspectLocked, setCustomAspectLocked] = useState<boolean>(false);
  // Interactive crop region, normalised against the working canvas. `null` keeps
  // the whole canvas; the crop is applied at render time so it stays undoable.
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  // Unit used by the custom crop size fields (pixels, inches or millimetres).
  const [cropUnit, setCropUnit] = useState<SizeUnit>('px');
  // Keeps the crop box on the aspect ratio of the selected preset.
  const [cropAspectLocked, setCropAspectLocked] = useState<boolean>(true);
  // Canvas box inside the stage, used to place the crop overlay exactly over
  // the canvas (the canvas is scaled by the zoom/pan transform).
  const [cropOverlayRect, setCropOverlayRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [annotationText, setAnnotationText] = useState<string>('');
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(DEFAULT_TEXT_SIZE);
  const [textAlign, setTextAlign] = useState<TextAlign>(DEFAULT_TEXT_ALIGN);
  const [textFont, setTextFont] = useState<string>(DEFAULT_TEXT_FONT);
  const [textBold, setTextBold] = useState<boolean>(true);
  const [textItalic, setTextItalic] = useState<boolean>(false);
  const [textShadow, setTextShadow] = useState<boolean>(true);
  const [textOpacity, setTextOpacity] = useState<number>(100);
  const [backgroundColor, setBackgroundColor] = useState<string>(DEFAULT_BACKGROUND_COLOR);
  // Ordered content stack (paint layers + the text layer); pointer gestures
  // write through the ref so an in-flight stroke never reads a stale stack.
  const [contentLayers, setContentLayers] = useState<ContentLayer[]>(defaultContentLayerStack);
  const contentLayersRef = useRef<ContentLayer[]>(contentLayers);
  useEffect(() => {
    contentLayersRef.current = contentLayers;
  }, [contentLayers]);
  // Layer pointer strokes land on; applySnapshot keeps it inside the stack.
  const [activeLayerId, setActiveLayerId] = useState<string>(DEFAULT_PAINT_LAYER_ID);

  // --- layers visibility / lock
  const [layerVisible, setLayerVisible] = useState<Record<string, boolean>>({
    text: true,
    marks: true,
    photo: true,
    adjust: true,
  });
  const [layerLocked, setLayerLocked] = useState<Record<string, boolean>>({
    text: false,
    marks: false,
    photo: true,
    adjust: false,
  });
  // Layers without an explicit flag (new paint layers) render visible and unlocked.
  const isLayerVisible = (id: string) => layerVisible[id] ?? true;
  const isLayerLocked = (id: string) => layerLocked[id] ?? false;

  // --- history
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyRef = useRef<EditorSnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // --- panels
  const [rightTab, setRightTab] = useState<RightTab>('props');
  const [showColors, setShowColors] = useState<boolean>(true);
  const [showAdjustments, setShowAdjustments] = useState<boolean>(true);
  const [showTextOptions, setShowTextOptions] = useState<boolean>(true);
  const [showBackground, setShowBackground] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [isTransforming, setIsTransforming] = useState<boolean>(false);
  const transformStartRef = useRef<{ scale: number; rotation: number } | null>(null);
  const [warpCorners, setWarpCorners] = useState<Quad>([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]);
  const warpCornerDragRef = useRef<number | null>(null);
  const warpCanvasRef = useRef<HTMLCanvasElement>(null);
  const warpRendererRef = useRef<ReturnType<typeof createWebGLWarpRenderer>>(null);
  const [transformCanvasRect, setTransformCanvasRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const transformDragRef = useRef<{
    mode: 'scale' | 'rotate';
    startScale: number;
    startRotation: number;
    initialDistance: number;
    initialAngle: number;
  } | null>(null);

  const startTransformDrag = useCallback((mode: 'scale' | 'rotate', event: React.PointerEvent) => {
    if (!transformCanvasRect || !transformContainerRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const containerRect = transformContainerRef.current.getBoundingClientRect();
    const px = event.clientX - containerRect.left;
    const py = event.clientY - containerRect.top;
    const centerX = transformCanvasRect.left + transformCanvasRect.width / 2;
    const centerY = transformCanvasRect.top + transformCanvasRect.height / 2;
    const dx = px - centerX;
    const dy = py - centerY;
    const drag = {
      mode,
      startScale: scale,
      startRotation: rotation,
      initialDistance: Math.max(1, Math.hypot(dx, dy)),
      initialAngle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
    transformDragRef.current = drag;

    const onMove = (e: PointerEvent) => {
      const current = transformDragRef.current;
      const rect = transformCanvasRect;
      const container = transformContainerRef.current;
      if (!current || !rect || !container) return;
      const cRect = container.getBoundingClientRect();
      const pX = e.clientX - cRect.left;
      const pY = e.clientY - cRect.top;
      const cX = rect.left + rect.width / 2;
      const cY = rect.top + rect.height / 2;
      const dX = pX - cX;
      const dY = pY - cY;
      if (current.mode === 'scale') {
        const newDistance = Math.hypot(dX, dY);
        const ratio = current.initialDistance > 0 ? newDistance / current.initialDistance : 1;
        setScale(Math.max(0.1, Math.min(4, current.startScale * ratio)));
      } else {
        const angle = (Math.atan2(dY, dX) * 180) / Math.PI;
        const delta = angle - current.initialAngle;
        setRotation(current.startRotation + delta);
      }
    };
    const onUp = () => {
      transformDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [transformCanvasRect, scale, rotation]);

  const startWarpCornerDrag = useCallback((index: number, event: React.PointerEvent) => {
    if (!transformCanvasRect) return;
    event.preventDefault();
    event.stopPropagation();
    warpCornerDragRef.current = index;
    const onMove = (e: PointerEvent) => {
      const idx = warpCornerDragRef.current;
      if (idx === null) return;
      const rect = transformCanvasRect;
      const container = transformContainerRef.current;
      if (!rect || !container) return;
      const cRect = container.getBoundingClientRect();
      const px = e.clientX - cRect.left;
      const py = e.clientY - cRect.top;
      const nx = Math.max(0, Math.min(1, (px - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (py - rect.top) / rect.height));
      setWarpCorners(prev => {
        const next = [...prev] as Quad;
        next[idx] = { x: nx, y: ny };
        return next;
      });
    };
    const onUp = () => {
      warpCornerDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [transformCanvasRect]);

  const [showPrintDialog, setShowPrintDialog] = useState<boolean>(false);
  // Captured once when the dialog opens so editing the canvas never mutates the
  // document the preview and the print job are built from.
  const [printPreviewDataUrl, setPrintPreviewDataUrl] = useState<string>('');
  const [showToolRail, setShowToolRail] = useState<boolean>(true);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(280);
  const rightPanelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState<boolean>(false);
  const [showTour, setShowTour] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(TOUR_STORAGE_KEY) !== 'done';
    } catch {
      return true;
    }
  });

  // --- image loading
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [originalImgElement, setOriginalImgElement] = useState<HTMLImageElement | null>(null);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState<boolean>(false);
  const [bgRemovalProgress, setBgRemovalProgress] = useState<number>(0);
  const [bgRemovedImgElement, setBgRemovedImgElement] = useState<HTMLImageElement | null>(null);
  const [replacedImgElement, setReplacedImgElement] = useState<HTMLImageElement | null>(null);
  const [showBgRemoved, setShowBgRemoved] = useState<boolean>(false);
  const [bgRemovalError, setBgRemovalError] = useState<string | null>(null);
  // Colour replacement (chroma key) settings for the background panel.
  const [bgReplaceTarget, setBgReplaceTarget] = useState<string>('#1e40af');
  const [bgReplaceColor, setBgReplaceColor] = useState<string>('#ffffff');
  const [bgReplaceTolerance, setBgReplaceTolerance] = useState<number>(30);
  const [bgReplaceSoftness, setBgReplaceSoftness] = useState<number>(20);
  const [bgReplaceKeepLuminance, setBgReplaceKeepLuminance] = useState<boolean>(true);
  const [bgReplaceUseSelection, setBgReplaceUseSelection] = useState<boolean>(false);
  const [bgReplaceInvertSelection, setBgReplaceInvertSelection] = useState<boolean>(false);
  const [bgReplaceError, setBgReplaceError] = useState<string | null>(null);

  // --- extended Photoshop-7 tools (hidden from the tool rail; surfaced via More)
  const [extendedTool, setExtendedTool] = useState<'none' | 'marquee' | 'wand' | 'clone' | 'heal' | 'dodge' | 'burn' | 'sponge'>('none');
  const [selections, setSelections] = useState<Selection[]>([]);
  const [marqueeDraft, setMarqueeDraft] = useState<Selection | null>(null);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [cloneStroke, setCloneStroke] = useState<CloneStroke | null>(null);
  const [cloneSamplePoint, setCloneSamplePoint] = useState<{ x: number; y: number } | null>(null);
  const [tonalMode, setTonalMode] = useState<TonalMode>('dodge');
  const [tonalRange, setTonalRange] = useState<TonalRange>('midtones');
  const [tonalExposure, setTonalExposure] = useState<number>(0.2);
  const [showExtendedTools, setShowExtendedTools] = useState<boolean>(false);
  const [wandResult, setWandResult] = useState<MagicWandResult | null>(null);
  const [wandTolerance, setWandTolerance] = useState<number>(30);
  // The wand keeps the actual flood-fill mask, not just its bounding box, so
  // subsequent fills and edits operate on the real shape.
  const [activeSelectionMask, setActiveSelectionMask] = useState<{ mask: Uint8Array; width: number; height: number } | null>(null);
  // Clone Stamp / Healing Brush strokes committed to the hidden source canvas.
  // Stored in the snapshot so undo/redo can replay them from the photo state
  // instead of relying on a serialised pixel buffer. Each stroke carries the
  // pre-stroke source snapshot, so undo is a pixel-perfect restore instead of
  // a re-application of the stroke onto the current state.
  const [cloneStrokes, setCloneStrokes] = useState<CloneStroke[]>([]);
  const cloneStrokesRef = useRef<CloneStroke[]>([]);
  useEffect(() => { cloneStrokesRef.current = cloneStrokes; }, [cloneStrokes]);
  // Dodge / Burn / Sponge strokes committed to the hidden source canvas.
  const [tonalStrokes, setTonalStrokes] = useState<TonalStroke[]>([]);
  const tonalStrokesRef = useRef<TonalStroke[]>([]);
  useEffect(() => { tonalStrokesRef.current = tonalStrokes; }, [tonalStrokes]);
  // Saved marquee selections (Magic Wand or freehand). The flood-fill mask is
  // kept so a committed selection can be re-used as a fill/stroke boundary
  // without re-running the wand; the mask is not part of the undo stack.
  const [savedSelections, setSavedSelections] = useState<
    Array<{ id: string; mask: Uint8Array; width: number; height: number; label: string }>
  >([]);
  // Active saved-selection index for the HUD overlay; null hides the highlight.
  const [activeSavedSelectionId, setActiveSavedSelectionId] = useState<string | null>(null);
  // Hidden source canvas: photo + tonal adjustments only, no strokes or HUD.
  // Clone Stamp samples from this so the offset stays stable regardless of
  // what the operator has drawn on top.
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Tracks the last photo signature so the source canvas is rebuilt only when
  // the underlying photo changes — edits accumulate across renders.
  const lastPhotoSigRef = useRef<string>('');

  // ---------------------------------------------------------- history core
  const makeSeed = useCallback((preset: CropPreset): EditorSnapshot => ({
    rotation: 0,
    zoom: 1,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    exposure: 0,
    hue: 0,
    warmth: 0,
    skewX: 0,
    skewY: 0,
    grayscale: false,
    activeFilter: 'none',
    cropPreset: preset,
    cropRect: undefined,
    customWidth: 600,
    customHeight: 600,
    annotationText: '',
    showWatermark: false,
    textColor: '#ffffff',
    textSize: DEFAULT_TEXT_SIZE,
    textAlign: DEFAULT_TEXT_ALIGN,
    textFont: DEFAULT_TEXT_FONT,
    textBold: true,
    textItalic: false,
    textShadow: true,
    textOpacity: 100,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    contentLayers: defaultContentLayerStack(),
    cloneStrokes: [],
    tonalStrokes: [],
    showBgRemoved: false,
    bgRemovedImageUrl: undefined,
    replacedImageUrl: undefined,
  }), []);

  const snapshot = useCallback((): EditorSnapshot => {
    const cloneCloneStrokes = typeof structuredClone === 'function' ? structuredClone(cloneStrokesRef.current) : JSON.parse(JSON.stringify(cloneStrokesRef.current));
    const cloneTonalStrokes = typeof structuredClone === 'function' ? structuredClone(tonalStrokesRef.current) : JSON.parse(JSON.stringify(tonalStrokesRef.current));
    // Strip heavy sourceSnapshot data URLs from history to save memory
    for (const stroke of cloneCloneStrokes) {
      if ((stroke as any).sourceSnapshot) {
        // Keep only small snapshots or remove entirely to save memory
        const snap = (stroke as any).sourceSnapshot as string;
        if (typeof snap === 'string' && snap.length > 50000) {
          delete (stroke as any).sourceSnapshot;
        }
      }
    }
    for (const stroke of cloneTonalStrokes) {
      if ((stroke as any).sourceSnapshot) {
        const snap = (stroke as any).sourceSnapshot as string;
        if (typeof snap === 'string' && snap.length > 50000) {
          delete (stroke as any).sourceSnapshot;
        }
      }
    }
    return {
      rotation,
      zoom: scale,
      brightness,
      contrast,
      saturation,
      exposure,
      hue,
      warmth,
      skewX,
      skewY,
      grayscale,
      activeFilter,
      cropPreset,
      cropRect,
      customWidth,
      customHeight,
      annotationText,
      showWatermark,
      textColor,
      textSize,
      textAlign,
      textFont,
      textBold,
      textItalic,
      textShadow,
      textOpacity,
      backgroundColor,
      contentLayers: typeof structuredClone === 'function' ? structuredClone(contentLayersRef.current) : JSON.parse(JSON.stringify(contentLayersRef.current)),
      cloneStrokes: cloneCloneStrokes,
      tonalStrokes: cloneTonalStrokes,
      showBgRemoved,
      bgRemovedImageUrl: bgRemovedImgElement?.src ?? undefined,
      replacedImageUrl: replacedImgElement?.src ?? undefined,
    };
  }, [rotation, scale, brightness, contrast, saturation, exposure, hue, warmth, skewX, skewY, grayscale, activeFilter, cropPreset, cropRect, customWidth, customHeight, annotationText, showWatermark, textColor, textSize, textAlign, textFont, textBold, textItalic, textShadow, textOpacity, backgroundColor,
    cloneStrokes,
    tonalStrokes,
    showBgRemoved, bgRemovedImgElement, replacedImgElement]);

  const applySnapshot = useCallback((next: EditorSnapshot) => {
    setRotation(next.rotation);
    setScale(next.zoom);
    setBrightness(next.brightness);
    setContrast(next.contrast);
    setSaturation(next.saturation);
    setExposure(next.exposure);
    setHue(next.hue ?? 0);
    setWarmth(next.warmth ?? 0);
    setSkewX(next.skewX ?? 0);
    setSkewY(next.skewY ?? 0);
    setGrayscale(next.grayscale);
    setActiveFilter(next.activeFilter);
    setCropPreset(next.cropPreset);
    setCropRect(next.cropRect ?? null);
    setCustomWidth(next.customWidth ?? 600);
    setCustomHeight(next.customHeight ?? 600);
    setAnnotationText(next.annotationText);
    setShowWatermark(next.showWatermark);
    setTextColor(next.textColor);
    setTextSize(next.textSize);
    setTextAlign(next.textAlign);
    setTextFont(next.textFont);
    setTextBold(next.textBold ?? true);
    setTextItalic(next.textItalic ?? false);
    setTextShadow(next.textShadow ?? true);
    setTextOpacity(next.textOpacity ?? 100);
    setBackgroundColor(next.backgroundColor);
    setContentLayers(typeof structuredClone === 'function' ? structuredClone(next.contentLayers) : JSON.parse(JSON.stringify(next.contentLayers)));
    setCloneStrokes(next.cloneStrokes ? (typeof structuredClone === 'function' ? structuredClone(next.cloneStrokes) : JSON.parse(JSON.stringify(next.cloneStrokes))) : []);
    setTonalStrokes(next.tonalStrokes ? (typeof structuredClone === 'function' ? structuredClone(next.tonalStrokes) : JSON.parse(JSON.stringify(next.tonalStrokes))) : []);
    setActiveLayerId(current =>
      next.contentLayers.some(layer => layer.id === current)
        ? current
        : next.contentLayers.find(layer => layer.kind === 'paint')?.id ?? DEFAULT_PAINT_LAYER_ID
    );
    setShowBgRemoved(next.showBgRemoved);
    // The blob URL is rebuilt from the stored reference rather than re-running
    // the model, so undo/redo of "Remove background" is instant.
    if (next.replacedImageUrl) {
      // A background colour replacement is baked into the photo, so it wins
      // over the plain background-removal render.
      const img = new Image();
      img.src = next.replacedImageUrl;
      setReplacedImgElement(img);
      setImgElement(img);
    } else if (next.bgRemovedImageUrl) {
      const img = new Image();
      img.src = next.bgRemovedImageUrl;
      setBgRemovedImgElement(img);
      setImgElement(img);
    } else if (originalImgElement) {
      setImgElement(originalImgElement);
      setBgRemovedImgElement(null);
      setReplacedImgElement(null);
    }
  }, []);

  // A slider that fires on every tick would flood the 50-entry history with
  // identical snapshots, so commits without a label are throttled: the live
  // state still updates immediately, but the history head only advances once
  // the user pauses. A labelled commit (Marks, Watermark, Rotate) always
  // writes — those come from discrete gestures.
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshotRef = useRef<EditorSnapshot | null>(null);
  const commit = useCallback((patch: Partial<EditorSnapshot>, label?: string) => {
    const merged: EditorSnapshot = { ...snapshot(), ...patch };
    if (label) merged.label = label;
    applySnapshot(merged);

    if (label) {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      const result = pushHistory(historyRef.current, historyIndexRef.current, merged, HISTORY_LIMIT);
      historyRef.current = result.history;
      historyIndexRef.current = result.index;
      setHistory(result.history);
      setHistoryIndex(result.index);
      return;
    }

    // Snapshot the live state now; the history push waits for the pause.
    pendingSnapshotRef.current = merged;
    if (commitTimerRef.current) return;
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      const pending = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      if (!pending) return;
      const result = pushHistory(historyRef.current, historyIndexRef.current, pending, HISTORY_LIMIT);
      historyRef.current = result.history;
      historyIndexRef.current = result.index;
      setHistory(result.history);
      setHistoryIndex(result.index);
    }, 400);
  }, [snapshot, applySnapshot]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      // Revoke all tracked object URLs on unmount to prevent memory leaks
      for (const url of objectUrlRefs.current) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      objectUrlRefs.current.clear();
    };
  }, []);

  const resetHistory = useCallback((seed: EditorSnapshot) => {
    historyRef.current = [seed];
    historyIndexRef.current = 0;
    setHistory([seed]);
    setHistoryIndex(0);
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    const result = undo(historyRef.current, historyIndexRef.current);
    if (!result) return;
    historyRef.current = result.history;
    historyIndexRef.current = result.index;
    applySnapshot(result.history[result.index]);
    setHistory(result.history);
    setHistoryIndex(result.index);
  }, [applySnapshot]);

  const handleRedo = useCallback(() => {
    const result = redo(historyRef.current, historyIndexRef.current);
    if (!result) return;
    historyRef.current = result.history;
    historyIndexRef.current = result.index;
    applySnapshot(result.history[result.index]);
    setHistory(result.history);
    setHistoryIndex(result.index);
  }, [applySnapshot]);

  // ------------------------------------------------------------- image load
  const loadImage = useCallback((src: string, preset?: CropPreset) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      setImgElement(img);
      setOriginalImgElement(img);
      setImageLoadError(null);
      setBgRemovalError(null);
      setShowBgRemoved(false);
      setBgRemovedImgElement(null);
      const seed = makeSeed(preset ?? 'free');
      applySnapshot(seed);
      resetHistory(seed);
      setViewZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.onerror = () => setImageLoadError('ছবিটি লোড করা যায়নি। ফাইলটি পরীক্ষা করে আবার চেষ্টা করুন।');
  }, [applySnapshot, makeSeed, resetHistory]);

  useEffect(() => {
    if (imageUrl) loadImage(imageUrl, getInitialCropPreset(job?.cropSettings?.aspectRatio));
  }, [imageUrl, job?.cropSettings?.aspectRatio, loadImage]);

  // --- extended tool HUD helpers (rendered on top of the photo) ---
  const drawSelectionOutline = (ctx: CanvasRenderingContext2D, s: Selection, width: number, height: number) => {
    const { x, y, w, h } = selectionBounds(s);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = Math.max(1, Math.round(2 / viewZoom));
    ctx.setLineDash([6 / viewZoom, 4 / viewZoom]);
    ctx.beginPath();
    if (s.mode === 'ellipse') {
      ctx.ellipse(x * width + w * width / 2, y * height + h * height / 2, w * width / 2, h * height / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.rect(x * width, y * height, w * width, h * height);
    }
    ctx.stroke();
    ctx.restore();
  };

  const drawWandOverlay = (ctx: CanvasRenderingContext2D, result: MagicWandResult, width: number, height: number) => {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
    for (let i = 0; i < result.mask.length; i += 1) {
      if (!result.mask[i]) continue;
      const x = i % result.width;
      const y = (i / result.width) | 0;
      const px = Math.round((x / result.width) * width);
      const py = Math.round((y / result.height) * height);
      ctx.fillRect(px, py, Math.max(1, Math.round(width / result.width)), Math.max(1, Math.round(height / result.height)));
    }
    ctx.restore();
  };

  // -------------------------------------------------------------- rendering
  // The working canvas is where the photo lives; the crop overlay selects a
  // region inside it and the exported canvas uses the cropped resolution.
  const canvasSize = useMemo(() => {
    const fixed = CROP_SIZE[cropPreset];
    if (fixed) return fixed;
    return {
      w: imgElement?.naturalWidth ? Math.min(imgElement.naturalWidth, 800) : 600,
      h: imgElement?.naturalHeight ? Math.min(imgElement.naturalHeight, 800) : 600,
    };
  }, [cropPreset, imgElement]);

  /** Output size requested by the active preset (null = keep the crop size). */
  const cropTargetSize = useMemo<{ w: number; h: number } | null>(() => {
    if (cropPreset === 'custom') return { w: customWidth, h: customHeight };
    return CROP_SIZE[cropPreset] ?? null;
  }, [cropPreset, customWidth, customHeight]);

  /** Pixel size of the exported canvas once the crop is applied. */
  const outputSize = useMemo(() => {
    if (!cropRect) return canvasSize;
    const crop = cropRectToPixels(cropRect, canvasSize.w, canvasSize.h);
    return resolveCropOutputSize(crop, cropTargetSize);
  }, [cropRect, canvasSize, cropTargetSize]);

  /** Crop rectangle in working-canvas pixels (shown in the overlay readout). */
  const cropPixels = useMemo(
    () =>
      cropRect
        ? cropRectToPixels(cropRect, canvasSize.w, canvasSize.h)
        : { x: 0, y: 0, w: canvasSize.w, h: canvasSize.h },
    [cropRect, canvasSize],
  );

  /** Normalised aspect the crop box keeps while the aspect lock is on. */
  const cropAspectNormalized = useMemo(() => {
    if (!cropAspectLocked) return null;
    if (!cropTargetSize) return null;
    return normalizedAspect(cropTargetSize.w / cropTargetSize.h, canvasSize.w, canvasSize.h);
  }, [cropAspectLocked, cropTargetSize, canvasSize]);

  useEffect(() => {
    if (!imgElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The visible canvas carries the cropped region at the requested output
    // resolution; the working canvas (width/height) stays the full photo area
    // so the crop can be undone without re-rendering the photo.
    canvas.width = outputSize.w;
    canvas.height = outputSize.h;
    const { w: width, h: height } = canvasSize;
    const cropPixels = cropRect ? cropRectToPixels(cropRect, width, height) : { x: 0, y: 0, w: width, h: height };
    // Maps working-canvas coordinates onto the cropped output canvas.
    const cropScaleX = outputSize.w / Math.max(1, cropPixels.w);
    const cropScaleY = outputSize.h / Math.max(1, cropPixels.h);

    ctx.clearRect(0, 0, outputSize.w, outputSize.h);

    // The hidden source canvas holds the photo plus any non-destructive edits
    // (Clone Stamp, Healing Brush, Dodge/Burn/Sponge). It is rebuilt only when
    // the photo state changes, so edits accumulate across renders and flow
    // into export/print. The visible canvas is a direct copy plus strokes.
    const photoSig = [
      imgElement?.src, rotation, scale, brightness, contrast, saturation,
      exposure, hue, warmth, skewX, skewY, grayscale, activeFilter, backgroundColor, showBgRemoved,
      layerVisible.photo, layerVisible.adjust, canvasSize.w, canvasSize.h,
      // Clone/tonal strokes are replayed onto the source, so a change in the
      // stroke list must force a rebuild — otherwise the replay would stack on
      // top of the previous edit and double-apply.
      cloneStrokesRef.current.length, tonalStrokesRef.current.length,
    ].join('|');
    const rebuildSource = photoSig !== lastPhotoSigRef.current;
    lastPhotoSigRef.current = photoSig;

    if (sourceCanvasRef.current) {
      const src = sourceCanvasRef.current.getContext('2d');
      if (src) {
        // The hidden source canvas must match the working canvas size. Setting
        // the size clears it, so a size change forces the photo to be redrawn.
        if (sourceCanvasRef.current.width !== width || sourceCanvasRef.current.height !== height) {
          sourceCanvasRef.current.width = width;
          sourceCanvasRef.current.height = height;
        }
        if (rebuildSource) {
          src.clearRect(0, 0, width, height);
          if (!showBgRemoved) {
            if (activeFilter === 'passport_blue') src.fillStyle = '#0f52ba';
            else if (activeFilter === 'clean_white') src.fillStyle = '#ffffff';
            else src.fillStyle = backgroundColor;
            src.fillRect(0, 0, width, height);
          }
          if (layerVisible.photo && imgElement) {
            src.save();
            src.translate(width / 2, height / 2);
            src.rotate((rotation * Math.PI) / 180);
            src.scale(scale, scale);
            src.transform(1, Math.tan((skewY * Math.PI) / 180), Math.tan((skewX * Math.PI) / 180), 1, 0, 0);
            src.filter = buildPhotoFilter({
              brightness, contrast, saturation, exposure, hue, warmth, grayscale, activeFilter, adjustmentsVisible: layerVisible.adjust,
            });
            const aspect = imgElement.width / imgElement.height;
            let drawW = width;
            let drawH = width / aspect;
            if (drawH < height) { drawH = height; drawW = height * aspect; }
            src.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH);
            src.restore();
          }
        }
      }
    }

    // Replay committed Clone Stamp / Healing Brush and Dodge/Burn/Sponge
    // strokes onto the freshly rebuilt source canvas. They are stored as
    // stroke records (not a pixel buffer), so undo/redo can reconstruct them
    // from the photo state — the edits flow into export/print. The replay
    // only runs when the source was rebuilt (cleared + photo redrawn); on a
    // plain re-render the source already holds the accumulated edits, so
    // replaying again would double-apply them.
    if (rebuildSource && sourceCanvasRef.current) {
      const srcEl = sourceCanvasRef.current;
      const sctx = srcEl.getContext('2d');
      if (sctx) {
        for (const stroke of cloneStrokesRef.current) {
          drawClonedStroke(sctx, sctx, stroke);
        }
        for (const stroke of tonalStrokesRef.current) {
          for (const point of stroke.points) stampTonalPatch(sctx, point, stroke);
        }
      }
    }

    // Visible canvas: copy the cropped source region (photo + accumulated
    // edits), then the paint layers on top of it.
    ctx.clearRect(0, 0, outputSize.w, outputSize.h);
    if (!showBgRemoved) {
      if (activeFilter === 'passport_blue') ctx.fillStyle = '#0f52ba';
      else if (activeFilter === 'clean_white') ctx.fillStyle = '#ffffff';
      else ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, outputSize.w, outputSize.h);
    }
    const sourceCanvas = sourceCanvasRef.current;
    if (sourceCanvas) {
      ctx.drawImage(
        sourceCanvas,
        cropPixels.x,
        cropPixels.y,
        cropPixels.w,
        cropPixels.h,
        0,
        0,
        outputSize.w,
        outputSize.h,
      );
    }

    // Layers are authored in working-canvas coordinates, so the crop transform
    // is applied while they are drawn; marks stay aligned with the photo.
    const applyCropTransform = () => {
      ctx.setTransform(cropScaleX, 0, 0, cropScaleY, -cropPixels.x * cropScaleX, -cropPixels.y * cropScaleY);
    };
    applyCropTransform();

    const drawStrokes = (strokes: readonly Stroke[]) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const stroke of strokes) {
        if (stroke.points.length === 0) continue;
        ctx.globalAlpha = stroke.opacity / 100;
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = stroke.size;

        if (stroke.kind === 'shape' && stroke.points.length >= 2) {
          const [start, end] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
          const x = Math.min(start.x, end.x) * width;
          const y = Math.min(start.y, end.y) * height;
          const w = Math.abs(end.x - start.x) * width;
          const h = Math.abs(end.y - start.y) * height;
          if (w < 1 || h < 1) continue;
          if (stroke.shape === 'ellipse') {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeRect(x, y, w, h);
          }
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
        for (let index = 1; index < stroke.points.length; index += 1) {
          ctx.lineTo(stroke.points[index].x * width, stroke.points[index].y * height);
        }
        if (stroke.points.length === 1) ctx.lineTo(stroke.points[0].x * width + 0.1, stroke.points[0].y * height);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawText = () => {
      if (!annotationText || !showWatermark) return;
      ctx.save();
      const weight = textBold ? 'bold' : 'normal';
      const style = textItalic ? 'italic' : 'normal';
      ctx.font = `${style} ${weight} ${textSize}px ${resolveFontStack(textFont)}`;
      ctx.globalAlpha = textOpacity / 100;
      ctx.fillStyle = textColor;
      if (textShadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
      ctx.textAlign = textAlign;
      const margin = 16;
      const x = textAlign === 'left' ? margin : textAlign === 'right' ? width - margin : width / 2;
      ctx.fillText(annotationText, x, height - margin);
      ctx.restore();
    };

    for (const layer of contentLayers) {
      if (!isLayerVisible(layer.id)) continue;
      if (layer.kind === 'paint') drawStrokes(layer.strokes);
      else drawText();
    }

    // --- extended tool overlays (rendered on top of the photo so they read
    //     as HUD marks; they are not part of the saved image). The HUD marks
    //     use output pixels, so the crop transform is dropped first. ---
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (extendedTool === 'marquee' && marqueeDraft) {
      drawSelectionOutline(ctx, marqueeDraft, outputSize.w, outputSize.h);
    }
    if (extendedTool === 'clone' && cloneStroke) {
      const srcEl = sourceCanvasRef.current;
      const srcCtx = srcEl ? srcEl.getContext('2d') : null;
      if (srcEl && srcCtx) {
        // Draw onto the visible canvas only — the source is committed in
        // endStroke so the next clone pass does not feed painted pixels back.
        const preview = document.createElement('canvas');
        preview.width = width;
        preview.height = height;
        const pctx = preview.getContext('2d');
        if (pctx) {
          pctx.drawImage(srcEl, 0, 0);
          drawClonedStroke(pctx, srcCtx, cloneStroke);
          // The preview lives in working-canvas pixels, so it is drawn through
          // the crop transform to stay aligned with the photo.
          ctx.save();
          applyCropTransform();
          ctx.drawImage(preview, 0, 0);
          ctx.restore();
        }
      }
    }
    if (extendedTool === 'wand' && wandResult) {
      drawWandOverlay(ctx, wandResult, outputSize.w, outputSize.h);
    }
    if (extendedTool === 'clone' && cloneSamplePoint) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1, Math.round(2 / viewZoom));
      ctx.setLineDash([4 / viewZoom, 3 / viewZoom]);
      ctx.beginPath();
      ctx.arc(cloneSamplePoint.x * outputSize.w, cloneSamplePoint.y * outputSize.h, 6 / viewZoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [
    imgElement,
    canvasSize,
    outputSize,
    cropRect,
    rotation,
    scale,
    brightness,
    contrast,
    saturation,
    exposure,
    grayscale,
    activeFilter,
    backgroundColor,
    annotationText,
    showWatermark,
    textColor,
    textSize,
    textAlign,
    textFont,
    contentLayers,
    cloneStrokes,
    tonalStrokes,
    showBgRemoved,
    layerVisible,
    extendedTool,
    marqueeDraft,
    cloneStroke,
    cloneSamplePoint,
    wandResult,
  ]);

  // -------------------------------------------------------------- painting
  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const updateCursor = (point: { x: number; y: number }) => {
    const x = Math.round(point.x * canvasSize.w);
    const y = Math.round(point.y * canvasSize.h);
    setCursorPos(previous => (previous && previous.x === x && previous.y === y ? previous : { x, y }));
  };

  // Gesture writes go through the ref first so a stroke in progress never
  // reads a stack from a superseded render (the stale-closure erasure guard).
  const writeActiveLayer = (update: (strokes: Stroke[]) => Stroke[]) => {
    const next = updatePaintLayerStrokes(contentLayersRef.current, activeLayerId, update);
    contentLayersRef.current = next;
    setContentLayers(next);
  };

  // Eraser radius is derived from the brush size in source pixels, so a 20 px
  // brush always erases a 20 px circle no matter how far the canvas is
  // zoomed. Strokes are stored in normalised canvas coordinates, so the radius
  // is the brush size divided by the canvas pixel width — zoom cancels out.
  const eraseAt = (point: { x: number; y: number }) => {
    const radius = brushRadiusNormalised(brushSize * 4);
    writeActiveLayer(strokes => eraseStrokes(strokes, point, radius));
  };

  /**
   * Convert a brush size expressed in source pixels to a normalised 0..1
   * coordinate. The editor draws at the canvas pixel size, so 1 source px is
   * `1 / canvasSize.w` of the width; zoom does not change the stored strokes,
   * only how the canvas is scaled to the screen.
   */
  const brushRadiusNormalised = (size: number) => size / Math.max(canvasSize.w, 1);

  /**
   * Apply a tonal brush (Dodge/Burn/Sponge) inside a soft circle at `point`.
   * Operates on the hidden source canvas so the edit persists across renders
   * and flows into export/print. The brush radius follows the brush size in
   * source pixels, so zoom does not change the painted area.
   */
  /**
   * Active tonal stroke being painted with the pointer. Kept in a ref so the
   * in-flight drag accumulates points without waiting for a re-render.
   */
  const activeTonalStrokeRef = useRef<TonalStroke | null>(null);

  const applyTonalBrush = (point: { x: number; y: number }) => {
    if (extendedTool !== 'dodge' && extendedTool !== 'burn' && extendedTool !== 'sponge') return;
    const mode: TonalMode = extendedTool;
    const srcEl = sourceCanvasRef.current;
    if (!srcEl) return;
    const sctx = srcEl.getContext('2d');
    if (!sctx) return;
    const stroke: TonalStroke = activeTonalStrokeRef.current ?? {
      id: `tonal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      points: [],
      mode,
      exposure: tonalExposure,
      range: tonalRange,
      size: brushSize,
    };
    if (!activeTonalStrokeRef.current) activeTonalStrokeRef.current = stroke;
    stampTonalPatch(sctx, point, stroke);
  };

  const activeLayer = contentLayers.find(layer => layer.id === activeLayerId);
  const canPaint = (toolId: ToolId) =>
    (toolId === 'brush' || toolId === 'shape' || toolId === 'eraser') &&
    activeLayer?.kind === 'paint' &&
    !isLayerLocked(activeLayerId);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (isTransforming) return;
    // The crop overlay owns pointer input while the crop tool is active.
    if (tool === 'crop') return;
    const point = toCanvasPoint(event);
    if (!point) return;
    updateCursor(point);

    if (tool === 'move') {
      panStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
      return;
    }

    // --- extended tools: they share the canvas pointer handlers but are not in the rail
    if (extendedTool === 'marquee') {
      if (!marqueeStart) {
        setMarqueeStart(point);
        return;
      }
      const draft = normalizeSelection(createSelection('rect', marqueeStart, point));
      setMarqueeDraft(draft);
      setMarqueeStart(null);
      commit({}, 'Marquee selection');
      return;
    }
    if (extendedTool === 'wand') {
      const srcEl = sourceCanvasRef.current;
      if (srcEl) {
        const w = srcEl.width;
        const h = srcEl.height;
        const sctx = srcEl.getContext('2d');
        if (sctx) {
          const sx = Math.max(0, Math.min(w - 1, Math.round(point.x * w)));
          const sy = Math.max(0, Math.min(h - 1, Math.round(point.y * h)));
          const img = sctx.getImageData(0, 0, w, h);
          const result = floodFill(img.data, w, h, sx, sy, wandTolerance);
          setWandResult(result);
          setActiveSelectionMask({ mask: result.mask, width: result.width, height: result.height });
          commit({}, 'Magic Wand selection');
        }
      }
      return;
    }
    if (extendedTool === 'clone' || extendedTool === 'heal') {
      if (!cloneSamplePoint) {
        setCloneSamplePoint(point);
        return;
      }
      const id = `clone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const stroke: CloneStroke = {
        id,
        points: [point],
        sampleOffset: { x: point.x - cloneSamplePoint.x, y: point.y - cloneSamplePoint.y },
        size: Math.max(1, brushSize / viewZoom),
        opacity: brushOpacity,
        kind: extendedTool,
      };
      cloneStrokeRef.current = stroke;
      setCloneStroke(stroke);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* best-effort */ }
      return;
    }
    if ((extendedTool === 'dodge' || extendedTool === 'burn' || extendedTool === 'sponge') && imgElement) {
      tonalStrokeRef.current = true;
      applyTonalBrush(point);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* best-effort */ }
      return;
    }

    if (tool === 'eraser') {
      if (!canPaint(tool)) return;
      erasingRef.current = true;
      eraseAt(point);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
      return;
    }

    if (!canPaint(tool)) return;
    const id = `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // The slider is in screen pixels, but strokes are stored in canvas pixels.
    // Dividing by the current zoom keeps the on-screen brush diameter constant
    // when the operator zooms in to paint fine detail.
    const canvasBrushSize = Math.max(1, brushSize / viewZoom);
    const stroke = tool === 'shape'
      ? createShapeStroke(id, point, shapeKind, brushColor, Math.max(2, canvasBrushSize / 2), brushOpacity)
      : createBrushStroke(id, point, brushColor, canvasBrushSize, brushOpacity);
    activeStrokeRef.current = stroke;
    writeActiveLayer(strokes => [...strokes, stroke]);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (panStartRef.current) {
      const start = panStartRef.current;
      setPan({ x: start.panX + (event.clientX - start.x), y: start.panY + (event.clientY - start.y) });
      return;
    }

    const point = toCanvasPoint(event);
    if (!point) return;
    updateCursor(point);

    if (tool === 'eraser' && event.buttons === 1 && canPaint(tool)) {
      erasingRef.current = true;
      eraseAt(point);
      return;
    }

    // Tonal tools paint a soft brush along the drag; each move stamps onto the
    // source canvas so the effect accumulates instead of resetting.
    if (tonalStrokeRef.current && (extendedTool === 'dodge' || extendedTool === 'burn' || extendedTool === 'sponge')) {
      applyTonalBrush(point);
      const stroke = activeTonalStrokeRef.current;
      if (stroke) {
        const last = stroke.points[stroke.points.length - 1];
        if (!last || last.x !== point.x || last.y !== point.y) {
          stroke.points.push(point);
        }
      }
      return;
    }

    const active = activeStrokeRef.current;
    if (!active || event.buttons !== 1) return;
    const updated = addPoint(active, point);
    activeStrokeRef.current = updated;
    writeActiveLayer(strokes => strokes.map(stroke => (stroke.id === updated.id ? updated : stroke)));

    // Clone Stamp / Healing Brush strokes are stored separately and drawn
    // onto the source canvas so they become part of the photo for the next
    // clone pass (no double-image drift).
    const cloneActive = cloneStrokeRef.current;
    if (cloneActive && (extendedTool === 'clone' || extendedTool === 'heal')) {
      const updatedClone = { ...cloneActive, points: [...cloneActive.points, point] };
      cloneStrokeRef.current = updatedClone;
      setCloneStroke(updatedClone);
    }
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (panStartRef.current) {
      panStartRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* pointer already released */
      }
      return;
    }
    const wasErasing = erasingRef.current;
    erasingRef.current = false;
    if (activeStrokeRef.current || wasErasing) {
      activeStrokeRef.current = null;
      // snapshot() reads contentLayersRef.current, which pointer events keep in sync.
      commit({}, 'Marks');
    }
    if (tonalStrokeRef.current && (extendedTool === 'dodge' || extendedTool === 'burn' || extendedTool === 'sponge')) {
      tonalStrokeRef.current = false;
      const stroke = activeTonalStrokeRef.current;
      activeTonalStrokeRef.current = null;
      if (stroke && stroke.points.length > 0) {
        cloneStrokesRef.current = [...cloneStrokesRef.current];
        // Capture the pre-stroke source so undo can restore it directly.
        const srcEl = sourceCanvasRef.current;
        if (srcEl) {
          const sctx = srcEl.getContext('2d');
          if (sctx) {
            const tmp = document.createElement('canvas');
            tmp.width = srcEl.width;
            tmp.height = srcEl.height;
            const t = tmp.getContext('2d');
            if (t) {
              t.drawImage(srcEl, 0, 0);
              stroke.sourceSnapshot = tmp.toDataURL();
            }
          }
        }
        tonalStrokesRef.current = [...tonalStrokesRef.current, stroke];
        setTonalStrokes(tonalStrokesRef.current);
      }
      commit({}, extendedTool === 'dodge' ? 'Dodge' : extendedTool === 'burn' ? 'Burn' : 'Sponge');
    }
    if (cloneStrokeRef.current && (extendedTool === 'clone' || extendedTool === 'heal')) {
      const stroke = cloneStrokeRef.current;
      cloneStrokeRef.current = null;
      const srcEl = sourceCanvasRef.current;
      if (srcEl) {
        // Snapshot first so the stroke samples from the pre-stroke pixels;
        // drawing in place would otherwise feed painted pixels back as source.
        // The snapshot is stored on the stroke so undo can restore it directly
        // instead of replaying every prior clone stroke onto the photo.
        const sctx = srcEl.getContext('2d');
        if (sctx) {
          drawClonedStroke(sctx, sctx, stroke, { snapshot: true });
        }
        cloneStrokesRef.current = [...cloneStrokesRef.current, stroke];
        setCloneStrokes(cloneStrokesRef.current);
      }
      setCloneStroke(null);
      setCloneSamplePoint(null);
      commit({}, 'Clone Stamp');
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLCanvasElement>) => {
    setCursorPos(null);
    endStroke(event);
  };

  // ---------------------------------------------------------------- actions
  /** The crop box that matches the active print size, centred on the canvas. */
  const fittedCropRect = useMemo<CropRect | null>(() => {
    if (!cropTargetSize) return null;
    return fitCropRectToAspect(normalizedAspect(cropTargetSize.w / cropTargetSize.h, canvasSize.w, canvasSize.h));
  }, [cropTargetSize, canvasSize]);

  /** Select a print size and refit the crop box to it. */
  const handleApplyPreset = (preset: CropPreset) => {
    const size = preset === 'custom' ? { w: customWidth, h: customHeight } : CROP_SIZE[preset];
    if (!size) {
      // "Original" keeps the whole canvas.
      setCropRect(null);
      commit({ cropPreset: preset, cropRect: undefined }, `Crop · ${preset}`);
      return;
    }
    const rect = fitCropRectToAspect(normalizedAspect(size.w / size.h, canvasSize.w, canvasSize.h));
    setCropRect(rect);
    commit({ cropPreset: preset, cropRect: rect }, `Crop · ${preset}`);
  };

  /** Drop the crop and export the full canvas again. */
  const handleResetCrop = () => {
    setCropRect(null);
    commit({ cropRect: undefined }, 'Crop · reset');
  };

  const handleCustomWidthChange = (pixels: number) => {
    const next = clampCustomSize(pixels);
    const height = customAspectLocked && customHeight > 0
      ? clampCustomSize(Math.round((next * customHeight) / Math.max(1, customWidth)))
      : customHeight;
    const rect = fitCropRectToAspect(normalizedAspect(next / Math.max(1, height), canvasSize.w, canvasSize.h));
    setCropRect(rect);
    commit({ cropPreset: 'custom', customWidth: next, customHeight: height, cropRect: rect }, 'Crop · custom');
  };

  const handleCustomHeightChange = (pixels: number) => {
    const next = clampCustomSize(pixels);
    const width = customAspectLocked && customWidth > 0
      ? clampCustomSize(Math.round((next * customWidth) / Math.max(1, customHeight)))
      : customWidth;
    const rect = fitCropRectToAspect(normalizedAspect(width / Math.max(1, next), canvasSize.w, canvasSize.h));
    setCropRect(rect);
    commit({ cropPreset: 'custom', customHeight: next, customWidth: width, cropRect: rect }, 'Crop · custom');
  };

  // ------------------------------------------------------- interactive crop
  /** Pointer position inside the crop overlay, normalised against the canvas. */
  const cropPointFromEvent = (event: React.PointerEvent<HTMLDivElement>): CropPoint => {
    const rect = (cropOverlayRef.current ?? event.currentTarget).getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / Math.max(1, rect.width),
      y: (event.clientY - rect.top) / Math.max(1, rect.height),
    };
  };

  const handleCropPointerDown = (event: React.PointerEvent<HTMLDivElement>, handle?: CropHandle) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = cropPointFromEvent(event);
    const overlay = cropOverlayRef.current;
    try {
      overlay?.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
    const rect = cropRect;
    if (handle) {
      cropDragRef.current = { mode: 'resize', handle, start: point, rect: rect ?? { x: 0, y: 0, w: 1, h: 1 } };
      return;
    }
    const inside =
      !!rect &&
      point.x >= rect.x &&
      point.x <= rect.x + rect.w &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.h;
    if (inside && rect) {
      cropDragRef.current = { mode: 'move', handle: 'move', start: point, rect };
      return;
    }
    cropDragRef.current = { mode: 'new', handle: 'move', start: point, rect: { x: point.x, y: point.y, w: 0, h: 0 } };
  };

  const handleCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    const point = cropPointFromEvent(event);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    if (drag.mode === 'move') {
      setCropRect(moveCropRect(drag.rect, dx, dy));
      return;
    }
    if (drag.mode === 'resize') {
      setCropRect(resizeCropRect(drag.rect, drag.handle, dx, dy, cropAspectNormalized));
      return;
    }
    // A fresh box grows from the press point; the aspect lock keeps its shape.
    setCropRect(resizeCropRect({ x: drag.start.x, y: drag.start.y, w: 0, h: 0 }, 'se', dx, dy, cropAspectNormalized));
  };

  const handleCropPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropDragRef.current) return;
    cropDragRef.current = null;
    try {
      cropOverlayRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
    // One history entry per finished gesture, not per pointer move.
    commit({}, 'Crop');
  };

  const handleRotate = (delta: number) => commit({ rotation: (rotation + delta + 360) % 360 }, 'Rotate');

  const handleReset = () => {
    const seed = makeSeed('free');
    applySnapshot(seed);
    const result = pushHistory(historyRef.current, historyIndexRef.current, seed, HISTORY_LIMIT);
    historyRef.current = result.history;
    historyIndexRef.current = result.index;
    setHistory(result.history);
    setHistoryIndex(result.index);
    setViewZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleRemoveBackground = async () => {
    if (!originalImgElement) return;
    setIsRemovingBackground(true);
    setBgRemovalError(null);
    setBgRemovalProgress(0);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      canvas.width = originalImgElement.naturalWidth;
      canvas.height = originalImgElement.naturalHeight;
      ctx.drawImage(originalImgElement, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/png');
      });
      // The first call downloads the 30-80 MB model, so the progress callback
      // is what keeps the UI honest instead of a frozen spinner.
      const resultBlob = await removeBackground(blob, {
        progress: (_label, loaded, total) => {
          const fraction = total > 0 ? loaded / total : 0;
          setBgRemovalProgress(Math.round(fraction * 100));
        },
      });
      revokeObjectUrl(bgRemovedImgElement?.src);
      const resultUrl = trackObjectUrl(URL.createObjectURL(resultBlob));
      const resultImg = new Image();
      resultImg.src = resultUrl;
      await new Promise<void>((resolve, reject) => {
        resultImg.onload = () => resolve();
        resultImg.onerror = reject;
      });
      setBgRemovedImgElement(resultImg);
      setShowBgRemoved(true);
      setImgElement(resultImg);
      commit({ showBgRemoved: true, bgRemovedImageUrl: resultUrl }, 'Remove background');
    } catch (error) {
      setBgRemovalError(
        error instanceof Error
          ? `ব্যাকগ্রাউন্ড সরাতে সমস্যা: ${error.message}`
          : 'ব্যাকগ্রাউন্ড সরাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
      );
      setShowBgRemoved(false);
      setBgRemovedImgElement(null);
    } finally {
      setIsRemovingBackground(false);
      setBgRemovalProgress(0);
    }
  };

  /**
   * Fill the active wand selection with the current brush colour. Operates on
   * the hidden source canvas so the fill persists across renders and flows
   * into export/print. Uses the real flood-fill mask, not a bounding box.
   */
  const handleFillSelection = () => {
    if (!activeSelectionMask) return;
    const srcEl = sourceCanvasRef.current;
    if (!srcEl) return;
    const sctx = srcEl.getContext('2d');
    if (!sctx) return;
    const { mask, width, height } = activeSelectionMask;
    const img = sctx.getImageData(0, 0, width, height);
    const [r, g, b] = parseHexColor(brushColor);
    for (let i = 0; i < mask.length; i += 1) {
      if (!mask[i]) continue;
      const p = i * 4;
      img.data[p] = r;
      img.data[p + 1] = g;
      img.data[p + 2] = b;
      img.data[p + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    setActiveSelectionMask(null);
    setWandResult(null);
    commit({}, 'Fill selection');
  };

  const handleRestoreOriginal = () => {
    if (!originalImgElement) return;
    revokeObjectUrl(bgRemovedImgElement?.src);
    revokeObjectUrl(replacedImgElement?.src);
    setImgElement(originalImgElement);
    setShowBgRemoved(false);
    setBgRemovalError(null);
    setBgRemovedImgElement(null);
    setReplacedImgElement(null);
    commit({ showBgRemoved: false, bgRemovedImageUrl: undefined, replacedImageUrl: undefined }, 'Restore original');
  };

  /**
   * Replace a flat background colour (chroma key) with a new colour.
   *
   * The replacement is baked into the photo itself so it survives export and
   * printing. When "use selection" is on, only the pixels inside the current
   * wand/marquee selection are repainted, which keeps skin and clothing safe.
   */
  const handleReplaceBackgroundColour = () => {
    const source = imgElement;
    if (!source) return;
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    if (!width || !height) {
      setBgReplaceError('ছবির সাইজ পড়া যায়নি।');
      return;
    }
    setBgReplaceError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context not available');
      ctx.drawImage(source, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      // The selection mask is authored on the working canvas, which cover-fits
      // the photo. Map each image pixel back through that cover-fit so the mask
      // lines up with the real photo pixels instead of the canvas pixels.
      let mask = bgReplaceUseSelection ? activeSelectionMask : null;
      if (mask) {
        const imgMask = new Uint8Array(width * height);
        const aspect = source.width / source.height;
        let drawW = canvasSize.w;
        let drawH = canvasSize.w / aspect;
        if (drawH < canvasSize.h) {
          drawH = canvasSize.h;
          drawW = canvasSize.h * aspect;
        }
        const offsetX = (canvasSize.w - drawW) / 2;
        const offsetY = (canvasSize.h - drawH) / 2;
        const maskW = mask.width;
        const maskH = mask.height;
        for (let iy = 0; iy < height; iy += 1) {
          for (let ix = 0; ix < width; ix += 1) {
            const canvasX = offsetX + (ix / Math.max(1, width - 1)) * drawW;
            const canvasY = offsetY + (iy / Math.max(1, height - 1)) * drawH;
            const mx = Math.min(maskW - 1, Math.max(0, Math.round(canvasX)));
            const my = Math.min(maskH - 1, Math.max(0, Math.round(canvasY)));
            imgMask[iy * width + ix] =
              canvasX >= 0 && canvasX < canvasSize.w && canvasY >= 0 && canvasY < canvasSize.h
                ? mask.mask[my * maskW + mx]
                  ? 1
                  : 0
                : 0;
          }
        }
        mask = { mask: imgMask, width, height };
      }
      const result = replaceBackgroundColor(
        imageData.data,
        width,
        height,
        {
          target: bgReplaceTarget,
          replacement: bgReplaceColor,
          tolerance: bgReplaceTolerance,
          softness: bgReplaceSoftness,
          preserveLuminance: bgReplaceKeepLuminance,
        },
        mask,
        bgReplaceInvertSelection,
      );
      if (result.replaced === 0) {
        setBgReplaceError('এই রঙের কোনো পিক্সেল পাওয়া যায়নি — টলারেন্স বাড়িয়ে আবার চেষ্টা করুন।');
        return;
      }
      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      const img = new Image();
      img.onload = () => {
        setReplacedImgElement(img);
        setImgElement(img);
        commit({ replacedImageUrl: img.src }, 'Replace background colour');
      };
      img.src = dataUrl;
    } catch (error) {
      setBgReplaceError(
        error instanceof Error
          ? `ব্যাকগ্রাউন্ডের রঙ বদলাতে সমস্যা: ${error.message}`
          : 'ব্যাকগ্রাউন্ডের রঙ বদলাতে সমস্যা হয়েছে।',
      );
    }
  };

  const handleSaveCanvas = () => {
    if (!canvasRef.current || !imgElement) {
      setSaveError('ছবি লোড হওয়ার পর সংরক্ষণ করুন।');
      return;
    }
    setIsProcessing(true);
    setSaveError(null);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.95);
      setIsProcessing(false);
      onSave?.(dataUrl, { rotation, zoom: scale, brightness, contrast, grayscale, cropPreset, hue, warmth, skewX, skewY });
    } catch (error) {
      setIsProcessing(false);
      setSaveError(
        error instanceof Error ? `ছবি সংরক্ষণ করা যায়নি: ${error.message}` : 'ছবি সংরক্ষণ করা যায়নি। ফাইলটি পরীক্ষা করে আবার চেষ্টা করুন।',
      );
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `alif_shohoj_print_${Date.now()}.jpg`;
    link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  /**
   * Snapshot the canvas once: the preview must not shift under the dialog.
   * The canvas element only exists while an image is open, so this doubles as
   * the guard for the Ctrl+P entry point, which has no button to disable.
   */
  const openPrintDialog = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPrintPreviewDataUrl(canvas.toDataURL('image/jpeg', 0.92));
    setShowPrintDialog(true);
  }, []);

  /**
   * Walk-in print: build a queue job from the snapshot and print it directly,
   * instead of asking the operator to pick an order first. The dialog still
   * owns the settings; this hook only supplies the missing job context.
   */
  const handleWalkInPrint = useCallback(async (request: { dataUrl: string; settings: import('./printSettings').PrintSettings }): Promise<import('./printBackend').PrintResult> => {
    const bridge = window.alifShohojPrintDesktop;
    if (!bridge) return { ok: false, message: 'Print backend not yet connected' };
    const { createJobId, nextTokenNumber } = await import('../../shared/services/jobIdentity');
    const { matchPrinterForJob } = await import('../../features/printers/printerRouting');
    const routing = matchPrinterForJob('photo_4r', request.settings.paperSize, 'color', printers ?? []);
    const id = createJobId();
    const tokenCode = String(nextTokenNumber([], 0));
    const walkInJob: PrintJob = {
      id,
      tokenCode,
      customerPhone: 'Walk-in',
      customerName: 'Walk-in Customer',
      serviceType: 'photo_4r',
      serviceLabel: 'Walk-in Photo Print',
      serviceLabelBn: 'ওয়াক-ইন প্রিন্ট',
      paperSize: request.settings.paperSize,
      paperFinish: 'glossy',
      copies: 1,
      colorMode: 'color',
      status: 'queued',
      targetPrinterId: routing.printerId,
      targetPrinterName: routing.printerName,
      routingReason: `Walk-in job: ${routing.reason}`,
      priceBDT: 20,
      paymentMethod: 'counter_cash',
      paymentStatus: 'unpaid',
      fileUrl: request.dataUrl,
      fileName: `walkin-${tokenCode}.jpg`,
      fileSize: '',
      createdAt: Date.now(),
      autoDeleteCountdownSeconds: 60,
      counterId: '',
      counterName: 'Studio',
      cropSettings: { zoom: scale, rotation, brightness, contrast, aspectRatio: cropPreset },
      printLayout: {
        orientation: request.settings.orientation,
        marginIn: request.settings.marginIn,
        centerImage: request.settings.centerImage,
        topIn: request.settings.topIn,
        leftIn: request.settings.leftIn,
        scalePercent: request.settings.scalePercent,
        scaleToFit: request.settings.scaleToFit,
      },
      auditLogs: [{
        id: `log_${Date.now()}_walkin_print`,
        timestamp: Date.now(),
        actor: 'shopkeeper',
        action: 'walkin_print',
        details: 'Walk-in print sent from the Studio editor.',
      }],
    };
    try {
      await bridge.saveJob(walkInJob);
      await bridge.printJob(walkInJob.id);
      return { ok: true, message: 'Job sent to the print queue.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Print request failed.' };
    }
  }, [scale, rotation, brightness, contrast, cropPreset]);

  /** Drops the full-resolution snapshot with the dialog instead of holding it. */
  const closePrintDialog = useCallback(() => {
    setShowPrintDialog(false);
    setPrintPreviewDataUrl('');
  }, []);

  const handleFitToWidth = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElement) return;
    const rect = canvas.getBoundingClientRect();
    const size = CROP_SIZE[cropPreset] ?? { w: imgElement.naturalWidth, h: imgElement.naturalHeight };
    setViewZoom(Math.min(4, Math.max(0.25, rect.width / size.w)));
    setPan({ x: 0, y: 0 });
  }, [cropPreset, imgElement]);

  const handleFitToHeight = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElement) return;
    const rect = canvas.getBoundingClientRect();
    const size = CROP_SIZE[cropPreset] ?? { w: imgElement.naturalWidth, h: imgElement.naturalHeight };
    setViewZoom(Math.min(4, Math.max(0.25, rect.height / size.h)));
    setPan({ x: 0, y: 0 });
  }, [cropPreset, imgElement]);

  const handleActualSize = useCallback(() => {
    setViewZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const dismissTour = useCallback(() => {
    setShowTour(false);
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, 'done');
    } catch {
      /* storage unavailable */
    }
  }, []);

  const swapColors = () => {
    setBrushColor(backgroundColor);
    setBackgroundColor(brushColor);
  };

  const handleOpenFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setSaveError(validation.reason ?? 'ফাইলটি গ্রহণযোগ্য নয়।');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSaveError(null);
      loadImage(dataUrl, 'free');
    } catch {
      setSaveError('ফাইল পড়তে সমস্যা হয়েছে।');
    }
  };

  // ----------------------------------------------------------------- layers
  const moveLayer = (id: string, direction: -1 | 1) => {
    const next = moveContentLayer(contentLayers, id, direction);
    if (next === contentLayers) return;
    commit({ contentLayers: next }, 'Reorder');
  };

  // `?? true` keeps the first click on a layer absent from the record (every
  // created layer) in sync with the `isLayerVisible` read default.
  const toggleLayerVisibility = (id: string) =>
    setLayerVisible(previous => ({ ...previous, [id]: !(previous[id] ?? true) }));

  const handleCreateLayer = () => {
    const activeLayerIndex = contentLayers.findIndex(layer => layer.id === activeLayerId);
    const layer = createPaintLayer(
      `layer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nextPaintLayerName(contentLayers),
    );
    const nextStack = insertContentLayer(contentLayers, activeLayerIndex + 1, layer);
    commit({ contentLayers: nextStack }, 'New layer');
    setActiveLayerId(layer.id);
  };

  const layerMeta: Array<{ id: string; label: string; icon: React.ReactNode; reorderable: boolean }> = useMemo(() => [
    ...contentLayers.map(layer => ({
      id: layer.id,
      label: layer.name,
      icon: layer.kind === 'text' ? <Circle className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />,
      reorderable: true,
    })),
    { id: 'photo', label: 'Photo', icon: <FileText className="h-3.5 w-3.5" />, reorderable: false },
    { id: 'adjust', label: 'Adjustments', icon: <Sun className="h-3.5 w-3.5" />, reorderable: false },
  ], [contentLayers]);

  const cursorClass = tool === 'move' ? 'cursor-grab active:cursor-grabbing' : canPaint(tool) ? 'cursor-crosshair' : 'cursor-default';

  /**
   * Selecting the text tool focuses the Props tab so the text controls are in
   * view; the tab always stays one of the three fixed panels.
   */
  const selectTool = useCallback((next: ToolId) => {
    setTool(next);
    if (next === 'text') setRightTab('props');
    if (next === 'crop') {
      // Show a crop box straight away, fitted to the active print size.
      setCropRect(current => current ?? fittedCropRect);
    }
  }, [fittedCropRect]);

  /** Switch to an extended tool without touching the visible tool rail. */
  const selectExtendedTool = useCallback((next: typeof extendedTool) => {
    setExtendedTool(next);
    setMarqueeDraft(null);
    setMarqueeStart(null);
    setCloneStroke(null);
    setCloneSamplePoint(null);
    // A stale wand overlay must not survive a tool switch — the render
    // effect only paints it while the wand tool is active.
    if (next !== 'wand') setWandResult(null);
  }, []);

  // Mouse wheel zoom/pan handler
  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (isCtrl || isShift) {
      const newZoom = viewZoom + (event.deltaY < 0 ? 0.25 : -0.25);
      const clampedZoom = Math.min(4, Math.max(0.25, Number(newZoom.toFixed(2))));
      if (clampedZoom === viewZoom) return;

      const zoomRatio = clampedZoom / viewZoom;
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * zoomRatio,
        y: mouseY - (mouseY - prev.y) * zoomRatio,
      }));
      setViewZoom(clampedZoom);
    } else {
      setPan(prev => ({
        x: prev.x - event.deltaX,
        y: prev.y - event.deltaY,
      }));
    }
  }, [viewZoom]);

  // Touch gesture state for pinch-to-zoom
  const touchStateRef = useRef<{
    initialDistance: number;
    initialZoom: number;
    isPinching: boolean;
  } | null>(null);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    const touches = event.touches;
    if (touches.length !== 2) return;
    // `passive: false` is required so the listener can call preventDefault and
    // stop the page from scrolling while two fingers are on the canvas.
    event.preventDefault();
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    touchStateRef.current = {
      initialDistance: Math.hypot(dx, dy),
      initialZoom: viewZoom,
      isPinching: true,
    };
  }, [viewZoom]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    const touches = event.touches;
    const state = touchStateRef.current;
    if (!state || !state.isPinching || touches.length < 2) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    const distance = Math.hypot(dx, dy);
    const centerX = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
    const centerY = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;

    const newZoom = Math.min(4, Math.max(0.25, state.initialZoom * (distance / state.initialDistance)));
    if (newZoom !== viewZoom) {
      const zoomRatio = newZoom / viewZoom;
      setPan(prev => ({
        x: centerX - (centerX - prev.x) * zoomRatio,
        y: centerY - (centerY - prev.y) * zoomRatio,
      }));
      setViewZoom(newZoom);
    }
  }, [viewZoom]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length < 2) touchStateRef.current = null;
  }, []);

  // ------------------------------------------------------- keyboard shortcuts
  useEffect(() => {
    if (!isTransforming) {
      setTransformCanvasRect(null);
      if (warpRendererRef.current) {
        warpRendererRef.current.dispose();
        warpRendererRef.current = null;
      }
      return;
    }
    const canvas = warpCanvasRef.current;
    const workingSource = sourceCanvasRef.current ?? imgElement;
    if (!canvas || !workingSource) return;
    // Transform mode now operates on the cropped output, so the warp canvas
    // matches the visible canvas and the source texture is the cropped region.
    canvas.width = outputSize.w;
    canvas.height = outputSize.h;
    const croppedSource = document.createElement('canvas');
    croppedSource.width = outputSize.w;
    croppedSource.height = outputSize.h;
    const cctx = croppedSource.getContext('2d');
    if (cctx) {
      const crop = cropRect ? cropRectToPixels(cropRect, canvasSize.w, canvasSize.h) : { x: 0, y: 0, w: canvasSize.w, h: canvasSize.h };
      cctx.drawImage(workingSource, crop.x, crop.y, crop.w, crop.h, 0, 0, outputSize.w, outputSize.h);
    }
    const renderer = createWebGLWarpRenderer(canvas);
    if (!renderer) return;
    renderer.setImage(croppedSource as any);
    renderer.setCorners(warpCorners);
    renderer.render();
    warpRendererRef.current = renderer;

    const measure = () => {
      const c = canvasRef.current;
      const container = transformContainerRef.current;
      if (!c || !container) return;
      const cr = c.getBoundingClientRect();
      const ctr = container.getBoundingClientRect();
      setTransformCanvasRect({
        left: cr.left - ctr.left,
        top: cr.top - ctr.top,
        width: cr.width,
        height: cr.height,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      renderer.dispose();
      warpRendererRef.current = null;
    };
  }, [isTransforming, warpCorners, canvasSize, outputSize, cropRect]);

  // The crop overlay is an HTML layer above the canvas, so it needs the canvas
  // box inside the stage. The zoom/pan transform moves that box, so the
  // measurement is repeated whenever the view changes.
  useEffect(() => {
    if (tool !== 'crop') {
      setCropOverlayRect(null);
      return;
    }
    const measure = () => {
      const canvas = canvasRef.current;
      const container = transformContainerRef.current;
      if (!canvas || !container) return;
      const cr = canvas.getBoundingClientRect();
      const ctr = container.getBoundingClientRect();
      setCropOverlayRect({
        left: cr.left - ctr.left,
        top: cr.top - ctr.top,
        width: cr.width,
        height: cr.height,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [tool, viewZoom, pan, canvasSize, outputSize]);

  useEffect(() => {
    const renderer = warpRendererRef.current;
    if (!renderer) return;
    renderer.setCorners(warpCorners);
    renderer.render();
  }, [warpCorners]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;

      if (event.key === 'Escape') {
        if (isTransforming) {
          const start = transformStartRef.current;
          if (start) {
            setScale(start.scale);
            setRotation(start.rotation);
          }
          setWarpCorners([
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ]);
          setIsTransforming(false);
          return;
        }
        if (showPrintDialog) closePrintDialog();
        else if (showOverflowMenu) setShowOverflowMenu(false);
        else if (showSettings) setShowSettings(false);
        else if (showShortcuts) setShowShortcuts(false);
        return;
      }

      // The print dialog owns the keyboard while it is open: every other
      // shortcut would mutate the canvas hidden behind the modal.
      if (showPrintDialog) return;

      // F7/F8 toggle the side panels at every window width.
      if (!isCtrl && !isShift && (event.key === 'F7' || event.key === 'F8')) {
        event.preventDefault();
        if (event.key === 'F7') setShowRightPanel(value => !value);
        else setShowToolRail(value => !value);
        return;
      }

      if (isCtrl && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        if (isShift) handleRedo();
        else handleUndo();
        return;
      }
      if (isCtrl && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (isCtrl && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        handleSaveCanvas();
        return;
      }
      if (isCtrl && event.key === '/') {
        event.preventDefault();
        setShowShortcuts(value => !value);
        return;
      }
      if (isCtrl && (event.key === 't' || event.key === 'T')) {
        event.preventDefault();
        if (isTransforming) {
          const renderer = warpRendererRef.current;
          if (renderer) {
            renderer.render();
            const dataUrl = renderer.canvas.toDataURL('image/png');
            const img = new Image();
            img.onload = () => {
              // The warp is baked into the image (at the cropped resolution),
              // so the live transform state and the crop region must reset —
              // otherwise the photo would be transformed/cropped twice.
              setImgElement(img);
              setOriginalImgElement(img);
              setRotation(0);
              setScale(1);
              setSkewX(0);
              setSkewY(0);
              setCropRect(null);
              commit({ cropRect: undefined }, 'Warp');
              setWarpCorners([
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 1 },
              ]);
              setIsTransforming(false);
            };
            img.src = dataUrl;
          } else {
            commit({}, 'Transform');
            setIsTransforming(false);
          }
        } else {
          transformStartRef.current = { scale, rotation };
          setWarpCorners([
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ]);
          setIsTransforming(true);
        }
        return;
      }
      if (isCtrl && event.key === '0') {
        event.preventDefault();
        handleActualSize();
        return;
      }
      if (isCtrl && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        setViewZoom(value => Math.min(4, Number((value + 0.25).toFixed(2))));
        return;
      }
      if (isCtrl && (event.key === '-' || event.key === '_')) {
        event.preventDefault();
        setViewZoom(value => Math.max(0.25, Number((value - 0.25).toFixed(2))));
        return;
      }
      // Shift is left alone: Ctrl+Shift+P is the DevTools command palette.
      if (!isShift && isCtrl && (event.key === 'p' || event.key === 'P')) {
        event.preventDefault();
        openPrintDialog();
        return;
      }
      // Extended Photoshop-7 tools: shortcuts that do not collide with the
      // visible rail (V/C/B/T/S/E). Shift+M marquee, Shift+W magic wand.
      if (isShift && !isCtrl && (event.key === 'm' || event.key === 'M')) {
        event.preventDefault();
        selectExtendedTool(extendedTool === 'marquee' ? 'none' : 'marquee');
        return;
      }
      if (isShift && !isCtrl && (event.key === 'w' || event.key === 'W')) {
        event.preventDefault();
        selectExtendedTool(extendedTool === 'wand' ? 'none' : 'wand');
        return;
      }
      if (!isCtrl && !isShift && event.key === 'Enter' && isTransforming) {
        event.preventDefault();
        const renderer = warpRendererRef.current;
        if (renderer) {
          renderer.render();
          const dataUrl = renderer.canvas.toDataURL('image/png');
          const img = new Image();
          img.onload = () => {
            setImgElement(img);
            setOriginalImgElement(img);
            commit({}, 'Warp');
            setWarpCorners([
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
              { x: 0, y: 1 },
            ]);
            setIsTransforming(false);
          };
          img.src = dataUrl;
        } else {
          commit({}, 'Transform');
          setIsTransforming(false);
        }
        return;
      }

      if (isCtrl) return;

      switch (event.key.toLowerCase()) {
        case 'v':
          selectTool('move');
          break;
        case 'c':
          selectTool('crop');
          break;
        case 'b':
          selectTool('brush');
          break;
        case 't':
          selectTool('text');
          break;
        case 's':
          selectTool('shape');
          break;
        case 'e':
          selectTool('eraser');
          break;
        case '[':
          event.preventDefault();
          setBrushSize(size => Math.max(1, size - 5));
          break;
        case ']':
          event.preventDefault();
          setBrushSize(size => Math.min(40, size + 5));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOverflowMenu, showSettings, showShortcuts, showPrintDialog, openPrintDialog, closePrintDialog, handleUndo, handleRedo, handleSaveCanvas, handleActualSize, selectTool, isTransforming, commit, scale, rotation]);

  // ----------------------------------------------------------- overflow menu
  // The former File/Edit/Image menu bar is gone. The most-used actions live in
  // the options bar quick actions; the rest are collected here so nothing is
  // unreachable.
  const overflowItems: StudioMenuItem[] = [
    { id: 'open', label: 'Open image…', onSelect: () => fileInputRef.current?.click() },
    ...(onClose ? [{ id: 'close', label: 'Close image', disabled: !imgElement, onSelect: onClose }] : []),
    { id: 'reset', label: 'Reset all edits', danger: true, separatorBefore: true, onSelect: handleReset },
    { id: 'settings', label: 'Canvas settings', separatorBefore: true, onSelect: () => setShowSettings(true) },
    { id: 'shortcuts', label: 'Keyboard shortcuts', hint: 'Ctrl+/', onSelect: () => setShowShortcuts(true) },
    { id: 'tour', label: 'Show editor tips', onSelect: () => setShowTour(true) },
    { id: 'ext-tools', label: 'Extended Photoshop tools', separatorBefore: true, onSelect: () => setShowExtendedTools(value => !value) },
    { id: 'marquee', label: 'Marquee (Shift+M)', separatorBefore: true, onSelect: () => selectExtendedTool(extendedTool === 'marquee' ? 'none' : 'marquee') },
    { id: 'wand', label: 'Magic Wand (Shift+W)', onSelect: () => selectExtendedTool(extendedTool === 'wand' ? 'none' : 'wand') },
    { id: 'clone', label: 'Clone Stamp (Alt-click to sample)', onSelect: () => selectExtendedTool(extendedTool === 'clone' ? 'none' : 'clone') },
    { id: 'heal', label: 'Healing Brush', onSelect: () => selectExtendedTool(extendedTool === 'heal' ? 'none' : 'heal') },
    { id: 'dodge', label: 'Dodge', onSelect: () => selectExtendedTool(extendedTool === 'dodge' ? 'none' : 'dodge') },
    { id: 'burn', label: 'Burn', onSelect: () => selectExtendedTool(extendedTool === 'burn' ? 'none' : 'burn') },
    { id: 'sponge', label: 'Sponge', onSelect: () => selectExtendedTool(extendedTool === 'sponge' ? 'none' : 'sponge') },
    ...(activeSelectionMask
      ? [
          {
            id: 'save-selection',
            label: 'Save selection',
            hint: 'Stores the mask for reuse',
            separatorBefore: true,
            onSelect: () => {
              const id = `sel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              setSavedSelections(current => [
                ...current,
                {
                  id,
                  mask: activeSelectionMask.mask,
                  width: activeSelectionMask.width,
                  height: activeSelectionMask.height,
                  label: `Selection ${current.length + 1}`,
                },
              ]);
              setActiveSavedSelectionId(id);
              commit({}, 'Save selection');
            },
          },
        ]
      : []),
    ...(extendedTool === 'wand'
      ? [
          {
            id: 'wand-tolerance',
            label: `Wand tolerance · ${wandTolerance}%`,
            hint: 'Flood-fill colour tolerance',
            separatorBefore: true,
            onSelect: () => setWandTolerance(wandTolerance >= 100 ? 0 : wandTolerance + 10),
          },
        ]
      : []),
    ...(extendedTool === 'dodge' || extendedTool === 'burn' || extendedTool === 'sponge'
      ? [
          {
            id: 'tonal-range',
            label: `Tonal range · ${tonalRange}`,
            hint: 'Shadows, midtones, or highlights',
            separatorBefore: true,
            onSelect: () => setTonalRange(tonalRange === 'shadows' ? 'midtones' : tonalRange === 'midtones' ? 'highlights' : 'shadows'),
          },
          {
            id: 'tonal-exposure',
            label: `Exposure · ${tonalExposure.toFixed(2)}`,
            hint: 'Dodge lightens, Burn darkens',
            onSelect: () => setTonalExposure(tonalExposure >= 0.9 ? 0.1 : Math.round((tonalExposure + 0.1) * 100) / 100),
          },
        ]
      : []),
    ...(savedSelections.length > 0
      ? [
          {
            id: 'clear-saved-selections',
            label: 'Clear saved selections',
            danger: true,
            separatorBefore: true,
            onSelect: () => {
              setSavedSelections([]);
              setActiveSavedSelectionId(null);
            },
          },
        ]
      : []),
  ];

  // ------------------------------------------------------------ options bar
  const toolDefinition = getStudioTool(tool);

  const colorRow = <ColorPickerRow value={brushColor} label="Color" onSelect={setBrushColor} />;

  let toolOptions: React.ReactNode;
  switch (tool) {
    case 'crop':
      toolOptions = (
        <div className="flex items-center gap-1.5">
          {CROP_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.id)}
              title={preset.note}
              className={`rounded-[9px] px-2 py-1 text-[11px] font-medium transition-colors ${
                cropPreset === preset.id ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border-secondary" aria-hidden="true" />
          {cropPreset === 'custom' ? (
            <>
              <label className="text-[11px] text-text-secondary ml-1">সাইজ:</label>
              <input
                type="number"
                value={fromPixels(customWidth, cropUnit)}
                onChange={e => handleCustomWidthChange(toPixels(Number(e.target.value), cropUnit))}
                min="1"
                step={cropUnit === 'px' ? 1 : 0.1}
                className="w-16 h-6 rounded border border-border-secondary bg-surface text-xs text-text p-1 focus:outline-none focus:ring-1 focus:ring-brand"
                aria-label="ক্রপ প্রস্থ"
              />
              <span className="text-[11px] text-text-secondary mx-1">×</span>
              <input
                type="number"
                value={fromPixels(customHeight, cropUnit)}
                onChange={e => handleCustomHeightChange(toPixels(Number(e.target.value), cropUnit))}
                min="1"
                step={cropUnit === 'px' ? 1 : 0.1}
                className="w-16 h-6 rounded border border-border-secondary bg-surface text-xs text-text p-1 focus:outline-none focus:ring-1 focus:ring-brand"
                aria-label="ক্রপ উচ্চতা"
              />
              <select
                value={cropUnit}
                onChange={e => setCropUnit(e.target.value as SizeUnit)}
                className="h-6 rounded border border-border-secondary bg-surface px-1 text-[11px] text-text focus:outline-none focus:ring-1 focus:ring-brand"
                aria-label="সাইজের একক"
              >
                <option value="px">px</option>
                <option value="in">inch</option>
                <option value="mm">mm</option>
              </select>
              <IconButton onClick={() => setCustomAspectLocked(c => !c)} label="আসপেক্ট রেশিও কান্ট্রোল (লিংক)">
                {customAspectLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
              </IconButton>
            </>
          ) : null}
          <IconButton
            onClick={() => setCropAspectLocked(c => !c)}
            label="ক্রপ বক্সের অ্যাসপেক্ট লক"
          >
            {cropAspectLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          </IconButton>
          <button
            type="button"
            onClick={handleResetCrop}
            className="rounded-[9px] px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            title="ক্রপ বাতিল করে পুরো ছবি রাখুন"
          >
            সম্পূর্ণ ছবি
          </button>
          <span className="ml-1 font-mono text-[11px] tabular-nums text-text-secondary">
            {outputSize.w}×{outputSize.h} px
          </span>
          <span className="mx-1 h-4 w-px bg-border-secondary" aria-hidden="true" />
          <IconButton onClick={() => handleRotate(-90)} label="Rotate left">
            <RotateCcw className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={() => handleRotate(90)} label="Rotate right">
            <RotateCw className="h-4 w-4" />
          </IconButton>
        </div>
      );
      break;
    case 'brush':
      toolOptions = (
        <div className="flex items-center gap-4">
          <div className="w-40">
            <Slider label="Size" value={brushSize} min={1} max={40} step={1} suffix=" px" onChange={setBrushSize} />
          </div>
          <div className="w-40">
            <Slider label="Opacity" value={brushOpacity} min={10} max={100} step={5} suffix="%" onChange={setBrushOpacity} />
          </div>
          {colorRow}
        </div>
      );
      break;
    case 'shape':
      toolOptions = (
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            {(['rect', 'ellipse'] as const).map(kind => (
              <button
                key={kind}
                type="button"
                onClick={() => setShapeKind(kind)}
                className={`rounded-[9px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  shapeKind === kind ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {kind === 'rect' ? 'Rectangle' : 'Oval'}
              </button>
            ))}
          </div>
          <div className="w-36">
            <Slider label="Stroke" value={brushSize} min={1} max={40} step={1} suffix=" px" onChange={setBrushSize} />
          </div>
          <div className="w-36">
            <Slider label="Opacity" value={brushOpacity} min={10} max={100} step={5} suffix="%" onChange={setBrushOpacity} />
          </div>
          {colorRow}
        </div>
      );
      break;
    case 'eraser':
      toolOptions = (
        <div className="flex w-48 items-center">
          <Slider label="Eraser size" value={brushSize} min={4} max={40} step={1} suffix=" px" onChange={setBrushSize} />
        </div>
      );
      break;
    case 'text':
      toolOptions = (
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={annotationText}
            onChange={event => setAnnotationText(event.target.value)}
            onBlur={() => commit({}, 'Watermark text')}
            placeholder="VERIFIED COPY / দোকান কোড"
            className="w-56 rounded-[9px] border border-border-primary bg-bg-secondary px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={() => commit({ showWatermark: !showWatermark }, 'Watermark')}
            aria-pressed={showWatermark}
            className={`rounded-[9px] px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              showWatermark ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {showWatermark ? 'Shown' : 'Hidden'}
          </button>
          <FontSelect value={textFont} onChange={font => commit({ textFont: font }, 'Text font')} />
          <div className="w-36">
            <Slider label="Font size" value={textSize} min={ADJUSTMENT_RANGES.textSize.min} max={ADJUSTMENT_RANGES.textSize.max} step={1} suffix=" px" onChange={value => commit({ textSize: value }, 'Text size')} />
          </div>
          <TextAlignButtons value={textAlign} onSelect={align => commit({ textAlign: align }, 'Text align')} />
          <ColorPickerRow value={textColor} label="Text color" onSelect={color => commit({ textColor: color }, 'Text color')} />
        </div>
      );
      break;
    default:
      toolOptions = <span className="text-[11px] text-text-tertiary">Drag to pan the canvas · Ctrl + scroll to zoom</span>;
  }

  const rightTabs: ReadonlyArray<{ id: RightTab; label: string }> = [
    { id: 'layers', label: 'Layers' },
    { id: 'props', label: 'Props' },
    { id: 'history', label: 'History' },
  ];

  const rightPanel = (
    <>
      <div className="flex h-10 shrink-0 items-stretch border-b border-border-primary px-2" role="tablist" aria-label="Editor panels">
        {rightTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={rightTab === tab.id}
            onClick={() => setRightTab(tab.id)}
            className={`relative flex flex-1 items-center justify-center text-[11px] font-semibold transition-colors ${
              rightTab === tab.id ? 'text-brand' : 'text-text-tertiary hover:bg-surface-hover'
            }`}
          >
            {tab.label}
            {rightTab === tab.id && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-brand" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {rightTab === 'layers' && (
          <div className="flex h-full flex-col">
            <ul className="flex-1 space-y-1 overflow-y-auto p-2">
              {layerMeta.map((layer, index) => (
                <li
                  key={layer.id}
                  role={layer.reorderable ? 'button' : undefined}
                  tabIndex={layer.reorderable ? 0 : undefined}
                  aria-label={layer.reorderable ? `${layer.label} layer` : undefined}
                  aria-pressed={layer.reorderable ? layer.id === activeLayerId : undefined}
                  onClick={() => {
                    if (layer.reorderable) setActiveLayerId(layer.id);
                  }}
                  onKeyDown={event => {
                    // Keys pressed on the row's own action buttons are theirs.
                    if (!layer.reorderable || event.target !== event.currentTarget) return;
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setActiveLayerId(layer.id);
                  }}
                  className={`flex items-center gap-2 rounded-[10px] border px-2 py-1.5 transition-colors ${
                    layer.id === activeLayerId
                      ? 'cursor-pointer border-brand/40 bg-brand/15'
                      : `border-transparent ${layer.reorderable ? 'cursor-pointer hover:bg-surface-hover' : ''}`
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-secondary bg-bg-secondary text-text-tertiary">
                    {layer.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[11px] ${layer.id === activeLayerId ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                      {layer.label}
                    </span>
                    <span className="block text-[10px] text-text-tertiary">Normal • 100%</span>
                  </span>

                  {layer.reorderable ? (
                    <>
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          moveLayer(layer.id, -1);
                        }}
                        disabled={index === 0}
                        title="Move up"
                        aria-label={`Move ${layer.label} up`}
                        className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
                      >
                        <ChevronRight className="h-3 w-3 -rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          moveLayer(layer.id, 1);
                        }}
                        disabled={index === contentLayers.length - 1}
                        title="Move down"
                        aria-label={`Move ${layer.label} down`}
                        className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
                      >
                        <ChevronRight className="h-3 w-3 rotate-90" />
                      </button>
                    </>
                  ) : (
                    <span className="w-[1.5rem]" aria-hidden="true" />
                  )}

                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      toggleLayerVisibility(layer.id);
                    }}
                    title={isLayerVisible(layer.id) ? 'Hide layer' : 'Show layer'}
                    aria-label={isLayerVisible(layer.id) ? `Hide ${layer.label}` : `Show ${layer.label}`}
                    className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                  >
                    {isLayerVisible(layer.id) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-50" />}
                  </button>

                  {layer.id === 'photo' || layer.id === 'adjust' ? (
                    <span className="grid h-6 w-6 place-items-center text-text-tertiary/60" title="Always locked">
                      <Lock className="h-3 w-3" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        setLayerLocked(previous => ({ ...previous, [layer.id]: !previous[layer.id] }));
                      }}
                      title={isLayerLocked(layer.id) ? 'Unlock layer' : 'Lock layer'}
                      aria-label={isLayerLocked(layer.id) ? `Unlock ${layer.label}` : `Lock ${layer.label}`}
                      className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      {isLayerLocked(layer.id) ? <Lock className="h-3 w-3 text-brand" /> : <LockOpen className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="shrink-0 border-t border-border-primary p-2">
              <button
                type="button"
                onClick={handleCreateLayer}
                className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-primary px-2 py-2 text-[11px] font-medium text-text-tertiary transition-colors hover:border-brand hover:text-brand"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Layer</span>
              </button>
            </div>
          </div>
        )}

        {rightTab === 'props' && (
          <>
            <PanelSection title="Colors" icon={<Palette className="h-3.5 w-3.5" />} open={showColors} onToggle={() => setShowColors(value => !value)}>
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">Foreground</span>
                  <ColorPickerRow value={brushColor} label="Foreground colour" onSelect={setBrushColor} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">Background</span>
                  <ColorPickerRow value={backgroundColor} label="Background colour" onSelect={color => { setBackgroundColor(color); commit({ backgroundColor: color }, 'Background colour'); }} />
                </div>
              </div>
            </PanelSection>
            <PanelSection title="Adjustments" icon={<Sun className="h-3.5 w-3.5" />} open={showAdjustments} onToggle={() => setShowAdjustments(value => !value)}>
              <AdjustmentRow label="Brightness" value={brightness} min={ADJUSTMENT_RANGES.brightness.min} max={ADJUSTMENT_RANGES.brightness.max} step={ADJUSTMENT_RANGES.brightness.step} suffix={ADJUSTMENT_RANGES.brightness.suffix} onChange={value => commit({ brightness: value }, 'Brightness')} />
              <AdjustmentRow label="Contrast" value={contrast} min={ADJUSTMENT_RANGES.contrast.min} max={ADJUSTMENT_RANGES.contrast.max} step={ADJUSTMENT_RANGES.contrast.step} suffix={ADJUSTMENT_RANGES.contrast.suffix} onChange={value => commit({ contrast: value }, 'Contrast')} />
              <AdjustmentRow label="Saturation" value={saturation} min={ADJUSTMENT_RANGES.saturation.min} max={ADJUSTMENT_RANGES.saturation.max} step={ADJUSTMENT_RANGES.saturation.step} suffix={ADJUSTMENT_RANGES.saturation.suffix} onChange={value => commit({ saturation: value }, 'Saturation')} />
              <AdjustmentRow label="Hue" value={hue} min={ADJUSTMENT_RANGES.hue.min} max={ADJUSTMENT_RANGES.hue.max} step={ADJUSTMENT_RANGES.hue.step} suffix={ADJUSTMENT_RANGES.hue.suffix} onChange={value => commit({ hue: value }, 'Hue')} />
              <AdjustmentRow label="Warmth" value={warmth} min={ADJUSTMENT_RANGES.warmth.min} max={ADJUSTMENT_RANGES.warmth.max} step={ADJUSTMENT_RANGES.warmth.step} suffix={ADJUSTMENT_RANGES.warmth.suffix} onChange={value => commit({ warmth: value }, 'Warmth')} />
              <AdjustmentRow label="Exposure" value={exposure} min={ADJUSTMENT_RANGES.exposure.min} max={ADJUSTMENT_RANGES.exposure.max} step={ADJUSTMENT_RANGES.exposure.step} suffix={ADJUSTMENT_RANGES.exposure.suffix} onChange={value => commit({ exposure: Number(value.toFixed(1)) }, 'Exposure')} />
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {FILTERS.map(filter => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => commit({ activeFilter: filter.id }, filter.label)}
                    className={`rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition-colors ${
                      activeFilter === filter.id ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => commit({ grayscale: !grayscale }, 'Grayscale')}
                  className={`rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    grayscale ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  Grayscale
                </button>
              </div>
            </PanelSection>

            {tool === 'text' && (
              <PanelSection title="Text Options" icon={<Type className="h-3.5 w-3.5" />} open={showTextOptions} onToggle={() => setShowTextOptions(value => !value)}>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Font</span>
                  <FontSelect value={textFont} onChange={font => commit({ textFont: font }, 'Text font')} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Font size</span>
                  <input
                    type="number"
                    value={textSize}
                    min={ADJUSTMENT_RANGES.textSize.min}
                    max={ADJUSTMENT_RANGES.textSize.max}
                    step={ADJUSTMENT_RANGES.textSize.step}
                    onChange={event => {
                      // An emptied field parses as 0 and would drag the text to
                      // the minimum, so the draft is ignored while typing.
                      if (event.target.value === '') return;
                      const parsed = Number(event.target.value);
                      if (Number.isFinite(parsed)) setTextSize(parsed);
                    }}
                    onBlur={() => {
                      const clamped = clampAdjustment(textSize, ADJUSTMENT_RANGES.textSize.min, ADJUSTMENT_RANGES.textSize.max);
                      // Compared against the history head rather than the live
                      // draft: a size typed in range still needs an undo entry,
                      // a blur that changed nothing must not add one.
                      const committed = historyRef.current[historyIndexRef.current]?.textSize;
                      if (clamped !== committed) commit({ textSize: clamped }, 'Text size');
                    }}
                    aria-label="Font size"
                    className="w-full rounded-[9px] border border-border-primary bg-bg-secondary px-2 py-1.5 text-xs tabular-nums text-text-primary focus:border-brand focus:outline-none"
                  />
                </label>
                <div>
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Color</span>
                  <ColorPickerRow value={textColor} label="Text color" onSelect={color => commit({ textColor: color }, 'Text color')} />
                </div>
                <div>
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Alignment</span>
                  <TextAlignButtons value={textAlign} onSelect={align => commit({ textAlign: align }, 'Text align')} />
                </div>
                <p className="text-[10px] leading-relaxed text-text-tertiary">
                  Caption text and watermark visibility are edited in the options bar above.
                </p>
              </PanelSection>
            )}

            <PanelSection title="Background" icon={<Wand2 className="h-3.5 w-3.5" />} open={showBackground} onToggle={() => setShowBackground(value => !value)}>
              {bgRemovalError && <p role="alert" className="rounded-[10px] bg-error-bg px-2.5 py-1.5 text-[11px] text-error">{bgRemovalError}</p>}
              {isRemovingBackground && (
                <div className="space-y-1.5 rounded-[10px] bg-brand-soft px-2.5 py-2">
                  <div className="flex items-center justify-between text-[11px] text-brand">
                    <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing background…</span>
                    <span className="font-mono tabular-nums">{bgRemovalProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand/20">
                    <div className="h-full bg-brand transition-all duration-200" style={{ width: `${bgRemovalProgress}%` }} />
                  </div>
                  <p className="text-[10px] leading-relaxed text-text-tertiary">First run downloads the model (~30–80 MB); this PC only.</p>
                </div>
              )}
              {!showBgRemoved && !isRemovingBackground && (
                <button
                  type="button"
                  onClick={handleRemoveBackground}
                  disabled={!originalImgElement}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand px-2.5 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Remove background</span>
                </button>
              )}
              {showBgRemoved && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 rounded-[10px] bg-brand-soft px-2.5 py-1.5 text-[11px] text-brand">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>Background removed · transparent</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleRestoreOriginal}
                    className="flex w-full items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore original</span>
                  </button>
                </div>
              )}
              <p className="text-[10px] leading-relaxed text-text-tertiary">Runs on-device. No image leaves this PC.</p>

              {/* Colour replacement: repaints a flat backdrop (blue studio
                  wall, white paper) without running the AI model. */}
              <div className="space-y-2.5 rounded-[10px] border border-border-secondary p-2.5">
                <p className="text-[11px] font-semibold text-text-secondary">ব্যাকগ্রাউন্ডের রঙ বদলান</p>
                {bgReplaceError && (
                  <p role="alert" className="rounded-[8px] bg-error-bg px-2 py-1 text-[11px] text-error">
                    {bgReplaceError}
                  </p>
                )}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">যে রঙ সরাতে হবে</span>
                  <ColorPickerRow value={bgReplaceTarget} label="Target colour" onSelect={setBgReplaceTarget} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">নতুন রঙ</span>
                  <ColorPickerRow value={bgReplaceColor} label="Replacement colour" onSelect={setBgReplaceColor} />
                </div>
                <AdjustmentRow
                  label="Tolerance"
                  value={bgReplaceTolerance}
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={setBgReplaceTolerance}
                />
                <AdjustmentRow
                  label="Softness"
                  value={bgReplaceSoftness}
                  min={0}
                  max={100}
                  step={1}
                  suffix="%"
                  onChange={setBgReplaceSoftness}
                />
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={bgReplaceKeepLuminance}
                    onChange={event => setBgReplaceKeepLuminance(event.target.checked)}
                    className="h-3.5 w-3.5 accent-brand"
                  />
                  <span>আলো-ছায়া ধরে রাখুন</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={bgReplaceUseSelection}
                    onChange={event => setBgReplaceUseSelection(event.target.checked)}
                    disabled={!activeSelectionMask}
                    className="h-3.5 w-3.5 accent-brand disabled:opacity-40"
                  />
                  <span>শুধু সিলেকশনের ভেতরে বদলান</span>
                </label>
                {bgReplaceUseSelection && (
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-text-secondary">
                    <input
                      type="checkbox"
                      checked={bgReplaceInvertSelection}
                      onChange={event => setBgReplaceInvertSelection(event.target.checked)}
                      className="h-3.5 w-3.5 accent-brand"
                    />
                    <span>সিলেকশনের বাইরে বদলান</span>
                  </label>
                )}
                <button
                  type="button"
                  onClick={handleReplaceBackgroundColour}
                  disabled={!imgElement}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand px-2.5 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>রঙ বদলান</span>
                </button>
                <p className="text-[10px] leading-relaxed text-text-tertiary">
                  সিলেকশন দিয়ে সীমিত করতে আগে ম্যাজিক ওয়্যান্ড দিয়ে ব্যাকগ্রাউন্ড বেছে নিন।
                </p>
              </div>
            </PanelSection>

            <PanelSection title="Extended tools" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} open={showExtendedTools} onToggle={() => setShowExtendedTools(value => !value)}>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'marquee', label: 'Marquee' },
                    { id: 'wand', label: 'Magic Wand' },
                    { id: 'clone', label: 'Clone Stamp' },
                    { id: 'heal', label: 'Healing' },
                    { id: 'dodge', label: 'Dodge' },
                    { id: 'burn', label: 'Burn' },
                    { id: 'sponge', label: 'Sponge' },
                  ] as const
                ).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectExtendedTool(extendedTool === t.id ? 'none' : t.id)}
                    className={`rounded-[9px] px-2 py-1 text-[11px] font-medium transition-colors ${
                      extendedTool === t.id ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {extendedTool === 'wand' && (
                <div className="mt-2 space-y-1.5">
                  <Slider label="Tolerance" value={wandTolerance} min={0} max={100} step={1} suffix="%" onChange={setWandTolerance} />
                  <p className="text-[10px] leading-relaxed text-text-tertiary">Click the canvas to select a connected colour region.</p>
                </div>
              )}
              {(extendedTool === 'clone' || extendedTool === 'heal') && (
                <p className="mt-2 text-[10px] leading-relaxed text-text-tertiary">
                  Alt-click to sample a pixel, then drag to clone. Clone copies pixels; Healing blends with surrounding texture.
                </p>
              )}
              {(extendedTool === 'dodge' || extendedTool === 'burn' || extendedTool === 'sponge') && (
                <div className="mt-2 space-y-1.5">
                  <Slider label="Exposure" value={tonalExposure} min={0} max={1} step={0.05} suffix="" onChange={setTonalExposure} />
                  <div className="flex gap-1">
                    {(['shadows', 'midtones', 'highlights'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setTonalRange(r)}
                        className={`flex-1 rounded-[9px] px-1.5 py-1 text-[10px] font-medium transition-colors ${
                          tonalRange === r ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        {r === 'shadows' ? 'Shadow' : r === 'midtones' ? 'Mid' : 'Highlight'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] leading-relaxed text-text-tertiary">Click the canvas to apply once. Drag to paint.</p>
                </div>
              )}
              {extendedTool === 'marquee' && (
                <p className="mt-2 text-[10px] leading-relaxed text-text-tertiary">Drag on the canvas to create a rectangular selection. Shift+M toggles.</p>
              )}
            </PanelSection>
          </>
        )}

        {rightTab === 'history' && (
          <div className="flex h-full flex-col">
            <ol className="flex-1 space-y-1 overflow-y-auto p-2">
              {history.length === 0 ? (
                <li className="py-4 text-center text-[11px] text-text-tertiary">No history yet</li>
              ) : (
                history.slice().reverse().map((entry, reverseIndex) => {
                  const index = history.length - 1 - reverseIndex;
                  const isCurrent = index === historyIndex;
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => {
                          applySnapshot(entry);
                          setHistoryIndex(index);
                          historyIndexRef.current = index;
                        }}
                        disabled={isCurrent}
                        className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[11px] transition-colors ${
                          isCurrent ? 'bg-brand/15 text-brand' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                        }`}
                      >
                        <span className="font-mono tabular-nums text-text-tertiary">{String(index + 1).padStart(2, '0')}</span>
                        <span className="flex-1 truncate">{editorHistorySummary(entry, index)}</span>
                        {entry.timestamp && (
                          <span className="font-mono text-[9px] text-text-tertiary">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        )}
                        {isCurrent && <Check className="h-3.5 w-3.5 text-brand" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ol>
            <div className="shrink-0 border-t border-border-secondary p-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="flex-1 rounded-[10px] px-2 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="flex-1 rounded-[10px] px-2 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  Redo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // ------------------------------------------------------------------- view
  return (
    <div className="studio-shell relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--color-studio-app)] text-text-primary">
      {/* ------------------------------------------------------ options bar
          Topmost bar: context-sensitive tool options on the left, the fixed
          quick-actions group on the right. No separate menu bar exists. */}
      <div className="flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-border-primary bg-[var(--color-studio-panel)] px-3">
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-brand">{toolDefinition.icon}</span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary sm:inline">{toolDefinition.label}</span>
        </span>
        <span className="h-5 w-px shrink-0 bg-border-secondary" aria-hidden="true" />
        {toolOptions}

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <IconButton onClick={handleUndo} label="Undo (Ctrl+Z)" disabled={!canUndo}>
            <Undo2 className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={handleRedo} label="Redo (Ctrl+Y)" disabled={!canRedo}>
            <Redo2 className="h-4 w-4" />
          </IconButton>
          <span className="mx-1 h-4 w-px bg-border-secondary" aria-hidden="true" />
          <IconButton onClick={handleSaveCanvas} label="Save to job (Ctrl+S)" disabled={isProcessing || !imgElement || !!imageLoadError}>
            <Save className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={handleDownload} label="Export JPG" disabled={!imgElement}>
            <Download className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={openPrintDialog} label="Print (Ctrl+P)" disabled={!imgElement}>
            <Printer className="h-4 w-4" />
          </IconButton>
          <span className="mx-1 h-4 w-px bg-border-secondary" aria-hidden="true" />
          <IconButton
            onClick={() => setShowToolRail(value => !value)}
            label={showToolRail ? 'Hide tool palette (F8)' : 'Show tool palette (F8)'}
            active={!showToolRail}
          >
            <PanelLeft className="h-4 w-4" />
          </IconButton>
          <IconButton
            onClick={() => setShowRightPanel(value => !value)}
            label={showRightPanel ? 'Hide side panel (F7)' : 'Show side panel (F7)'}
            active={!showRightPanel}
          >
            <PanelRight className="h-4 w-4" />
          </IconButton>
          <span className="mx-1 h-4 w-px bg-border-secondary" aria-hidden="true" />
          <StudioOverflowMenu
            label="More actions (open, reset, canvas settings, shortcuts, tips)"
            items={overflowItems}
            open={showOverflowMenu}
            onToggle={() => setShowOverflowMenu(value => !value)}
            onClose={() => setShowOverflowMenu(false)}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- body */}
      <div className="relative flex min-h-0 flex-1 flex-row">
        {showToolRail && (
          <StudioToolRail
            activeTool={tool}
            onSelectTool={selectTool}
            foreground={brushColor}
            background={backgroundColor}
            onForegroundChange={setBrushColor}
            onBackgroundChange={setBackgroundColor}
            onSwapColors={swapColors}
          />
        )}

        {/* canvas stage */}
        <section className="relative min-w-0 flex-1 overflow-hidden bg-[var(--color-studio-canvas)]">
          <div className="absolute inset-0 grid place-items-center overflow-hidden p-8">
            <div
              className="relative"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${viewZoom})`,
                transformOrigin: 'center center',
                transition: tool === 'move' ? 'none' : 'transform 180ms ease',
              }}
            >
              {showRulers && (
                <>
                  <div className="pointer-events-none absolute -top-5 left-0 right-0 h-4" aria-hidden="true">
                    {buildRulerTicks(outputSize.w).map(tick => (
                      <span key={`h-${tick.ratio}`} className="absolute top-0 -translate-x-1/2 font-mono text-[9px] tabular-nums text-text-tertiary" style={{ left: `${tick.ratio * 100}%` }}>
                        {tick.px}
                      </span>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute -left-6 top-0 bottom-0 w-5" aria-hidden="true">
                    {buildRulerTicks(outputSize.h).map(tick => (
                      <span key={`v-${tick.ratio}`} className="absolute left-0 -translate-y-1/2 font-mono text-[9px] tabular-nums text-text-tertiary" style={{ top: `${tick.ratio * 100}%` }}>
                        {tick.px}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div
                ref={transformContainerRef}
                className={`relative overflow-hidden rounded-xl shadow-[0_18px_60px_-12px_rgba(0,0,0,0.45)] ring-1 ring-border-primary ${cursorClass}`}
                style={
                  showChecker && showBgRemoved
                    ? {
                        // Checkerboard sits behind the canvas so transparent
                        // pixels after background removal reveal it cleanly.
                        backgroundColor: 'var(--color-studio-checker-b)',
                        backgroundImage:
                          'linear-gradient(45deg, var(--color-studio-checker-a) 25%, transparent 25%),linear-gradient(-45deg, var(--color-studio-checker-a) 25%, transparent 25%),linear-gradient(45deg, transparent 75%, var(--color-studio-checker-a) 75%),linear-gradient(-45deg, transparent 75%, var(--color-studio-checker-a) 75%)',
                        backgroundSize: '32px 32px',
                        backgroundPosition: '0 0, 0 16px, 16px -16px, -16px 0',
                      }
                    : undefined
                }
              >
                {showGrid && !imageLoadError && imgElement && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, var(--color-studio-grid) 1px, transparent 1px),linear-gradient(to bottom, var(--color-studio-grid) 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                    }}
                    aria-hidden="true"
                  />
                )}

                {/* Hidden source canvas: photo + tonal adjustments only. Clone
                    Stamp / Healing Brush sample from this so the offset stays
                    stable regardless of what the operator has drawn on top. */}
                <canvas ref={sourceCanvasRef} className="hidden" aria-hidden="true" />
                {imageLoadError ? (
                  <p role="alert" className="max-w-xs p-8 text-center text-sm text-error">{imageLoadError}</p>
                ) : !imgElement ? (
                  imageUrl ? (
                    <p role="status" className="max-w-xs p-8 text-center text-sm text-text-tertiary">ছবি লোড হচ্ছে…</p>
                  ) : (
                    <div className="flex max-w-xs flex-col items-center gap-3 p-8 text-center">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-border-primary bg-surface-elevated/60">
                        <FolderOpen className="h-6 w-6 text-text-tertiary" />
                      </div>
                      <p className="text-sm font-medium text-text-secondary">কোনো ছবি খোলা নেই</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-[10px] bg-brand px-4 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
                      >
                        ছবি খুলুন
                      </button>
                      <p className="text-[11px] text-text-tertiary">JPG, PNG, WebP, BMP, TIFF · সর্বোচ্চ ৫০ MB</p>
                    </div>
                  )
                ) : (
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endStroke}
                    onPointerLeave={handlePointerLeave}
                    onWheel={handleWheel}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="block max-h-[58vh] max-w-full object-contain"
                    style={{ touchAction: 'none' }}
                  />
                )}
                {isTransforming && transformCanvasRect && (
                  <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                    <canvas
                      ref={warpCanvasRef}
                      className="block max-h-[58vh] max-w-full object-contain"
                      style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}
                    />
                    {warpCorners.map((corner, index) => (
                      <div
                        key={`warp-${index}`}
                        onPointerDown={event => startWarpCornerDrag(index, event)}
                        style={{
                          position: 'absolute',
                          left: transformCanvasRect.left + corner.x * transformCanvasRect.width - 7,
                          top: transformCanvasRect.top + corner.y * transformCanvasRect.height - 7,
                          width: 14,
                          height: 14,
                          background: '#f59e0b',
                          border: '2px solid #ffffff',
                          borderRadius: '50%',
                          cursor: 'move',
                          pointerEvents: 'auto',
                          touchAction: 'none',
                          zIndex: 5,
                        }}
                      />
                    ))}
                    <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-brand px-2 py-0.5 text-[10px] font-semibold text-on-brand">
                      Warp: drag corners, Enter commit, Esc cancel
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white" style={{ pointerEvents: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setWarpCorners([
                            { x: 0, y: 0 },
                            { x: 1, y: 0 },
                            { x: 1, y: 1 },
                            { x: 0, y: 1 },
                          ]);
                          setScale(1);
                          setRotation(0);
                          setSkewX(0);
                          setSkewY(0);
                        }}
                        className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30"
                      >
                        Reset
                      </button>
                      <label className="flex items-center gap-1">
                        Skew X
                        <input type="range" min={-45} max={45} step={1} value={skewX} onChange={e => setSkewX(Number(e.target.value))} className="w-20" />
                      </label>
                      <label className="flex items-center gap-1">
                        Skew Y
                        <input type="range" min={-45} max={45} step={1} value={skewY} onChange={e => setSkewY(Number(e.target.value))} className="w-20" />
                      </label>
                    </div>
                  </div>
                )}
                {tool === 'crop' && cropOverlayRect && imgElement && (
                  <div
                    ref={cropOverlayRef}
                    className="absolute"
                    style={{
                      left: cropOverlayRect.left,
                      top: cropOverlayRect.top,
                      width: cropOverlayRect.width,
                      height: cropOverlayRect.height,
                      touchAction: 'none',
                      cursor: 'crosshair',
                    }}
                    onPointerDown={handleCropPointerDown}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    onPointerCancel={handleCropPointerUp}
                  >
                    {cropRect && (
                      <>
                        {/* Everything outside the crop box is dimmed, the way
                            Photoshop shades the excluded area. */}
                        <div
                          className="pointer-events-none absolute"
                          style={{
                            left: `${cropRect.x * 100}%`,
                            top: `${cropRect.y * 100}%`,
                            width: `${cropRect.w * 100}%`,
                            height: `${cropRect.h * 100}%`,
                            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.6)',
                            border: '1px solid rgba(255,255,255,0.95)',
                          }}
                        />
                        {/* Rule of thirds inside the crop box. */}
                        <div
                          className="pointer-events-none absolute"
                          style={{
                            left: `${cropRect.x * 100}%`,
                            top: `${cropRect.y * 100}%`,
                            width: `${cropRect.w * 100}%`,
                            height: `${cropRect.h * 100}%`,
                            backgroundImage:
                              'linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px),linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)',
                            backgroundSize: `${(cropRect.w * 100) / 3}% ${(cropRect.h * 100) / 3}%`,
                            backgroundPosition: `${cropRect.x * 100}% ${cropRect.y * 100}%`,
                          }}
                        />
                        {CROP_HANDLES.map(handle => (
                          <div
                            key={handle.id}
                            onPointerDown={event => handleCropPointerDown(event, handle.id)}
                            style={{
                              position: 'absolute',
                              left: `${(cropRect.x + handle.x * cropRect.w) * 100}%`,
                              top: `${(cropRect.y + handle.y * cropRect.h) * 100}%`,
                              width: 12,
                              height: 12,
                              transform: 'translate(-50%, -50%)',
                              background: '#ffffff',
                              border: '1px solid rgba(15,23,42,0.65)',
                              borderRadius: 2,
                              cursor: handle.cursor,
                              pointerEvents: 'auto',
                              touchAction: 'none',
                            }}
                          />
                        ))}
                        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white">
                          {cropPixels.w} × {cropPixels.h} px → {outputSize.w} × {outputSize.h} px
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!showToolRail && (
            <button
              type="button"
              onClick={() => setShowToolRail(true)}
              aria-label="Show tool palette (F8)"
              title="Show tool palette (F8)"
              className="absolute left-0 top-1/2 z-20 flex h-20 w-3.5 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border-primary bg-[var(--color-studio-panel)] text-text-tertiary shadow-md transition-colors hover:text-text-primary"
            >
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}

          {!showRightPanel && (
            <button
              type="button"
              onClick={() => setShowRightPanel(true)}
              aria-label="Show side panel (F7)"
              title="Show side panel (F7)"
              className="absolute right-0 top-1/2 z-20 flex h-20 w-3.5 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-border-primary bg-[var(--color-studio-panel)] text-text-tertiary shadow-md transition-colors hover:text-text-primary"
            >
              <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            </button>
          )}

          {imgElement && (
            <div className="pointer-events-none absolute left-3.5 top-3.5 z-10 rounded-lg border border-border-primary bg-[var(--color-studio-panel)]/85 px-2 py-1 font-mono text-[10px] tabular-nums text-text-secondary backdrop-blur-sm">
              {outputSize.w}×{outputSize.h} px · {Math.round(viewZoom * 100)}%
            </div>
          )}

          {saveError && (
            <p role="alert" className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-error-bg px-3 py-1.5 text-xs text-error">
              {saveError}
            </p>
          )}

          {showTour && imgElement && (
            <div className="absolute bottom-16 left-3.5 z-20 w-60 rounded-xl border border-border-primary bg-surface-elevated/95 p-3 shadow-xl backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">Editor tips</span>
                <button type="button" onClick={dismissTour} aria-label="Dismiss tips" className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary hover:bg-surface-hover hover:text-text-primary">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="space-y-1.5 text-[11px] leading-relaxed text-text-secondary">
                <li>বাম পাশের টুল প্যালেট থেকে টুল বেছে নিন (V, C, B, T, S, E)।</li>
                <li>উপরের Options Bar-এ টুলের সেটিংস যেমন Brush size, Font size থাকবে।</li>
                <li>ডান পাশে Layers, Props, History ট্যাব ব্যবহার করুন।</li>
              </ul>
              <button type="button" onClick={dismissTour} className="mt-2 w-full rounded-[9px] bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-on-brand hover:bg-brand-hover">
                বুঝেছি
              </button>
            </div>
          )}

          {/* discreet zoom / pan controls, bottom-right */}
          <div className="absolute bottom-3.5 right-3.5 flex items-center gap-0.5 rounded-xl border border-border-primary bg-surface-elevated/90 p-1 shadow-lg backdrop-blur">
            <button type="button" onClick={() => setViewZoom(value => Math.max(0.25, Number((value - 0.25).toFixed(2))))} title="Zoom out" className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleActualSize} title="Actual size (100%)" className="min-w-[3.25rem] rounded-lg px-1 py-1 text-center text-[11px] font-medium tabular-nums text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
              {Math.round(viewZoom * 100)}%
            </button>
            <button type="button" onClick={() => setViewZoom(value => Math.min(4, Number((value + 0.25).toFixed(2))))} title="Zoom in" className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleFitToWidth} title="Fit to width" className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
              <span aria-hidden="true" className="text-[10px] font-semibold">W</span>
            </button>
            <button type="button" onClick={handleFitToHeight} title="Fit to height" className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
              <span aria-hidden="true" className="text-[10px] font-semibold">H</span>
            </button>
          </div>
        </section>

        {showRightPanel && (
          <aside className="relative flex shrink-0 flex-col border-l border-border-primary bg-[var(--color-studio-panel)]" style={{ width: rightPanelWidth }}>
            <div
              onPointerDown={event => {
                event.preventDefault();
                rightPanelResizeRef.current = { startX: event.clientX, startWidth: rightPanelWidth };
                const onMove = (e: PointerEvent) => {
                  const drag = rightPanelResizeRef.current;
                  if (!drag) return;
                  const next = Math.max(220, Math.min(480, drag.startWidth + (drag.startX - e.clientX)));
                  setRightPanelWidth(next);
                };
                const onUp = () => {
                  rightPanelResizeRef.current = null;
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }}
              className="absolute left-0 top-0 bottom-0 z-10 w-1 cursor-col-resize hover:bg-brand/40"
              title="Drag to resize panel"
            />
            {rightPanel}
          </aside>
        )}
      </div>

      <StudioStatusBar
        toolLabel={toolDefinition.label}
        zoomPercent={Math.round(viewZoom * 100)}
        canvasSize={imgElement ? `${canvasSize.w}×${canvasSize.h} px` : 'auto'}
        cursorLabel={cursorPos ? `${cursorPos.x}, ${cursorPos.y}` : '—'}
        rotationLabel={`${rotation}°`}
        documentLabel={job ? `#${job.tokenCode} · ${job.serviceLabelBn}` : initialImageUrl ? 'Local image' : 'No image'}
        themeLabel={themeLabel}
        fileSizeLabel={job?.fileSize}
      />

      {/* settings popover */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} aria-hidden="true" />
          <div className="absolute right-2.5 top-12 z-40 w-56 rounded-xl border border-border-primary bg-surface-elevated p-2 shadow-xl">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Canvas</p>
            {[
              { id: 'checker', label: 'Transparency grid', value: showChecker, onToggle: () => setShowChecker(value => !value) },
              { id: 'grid', label: 'Pixel grid', value: showGrid, onToggle: () => setShowGrid(value => !value) },
              { id: 'rulers', label: 'Rulers', value: showRulers, onToggle: () => setShowRulers(value => !value) },
            ].map(option => (
              <button
                key={option.id}
                type="button"
                onClick={option.onToggle}
                className="flex w-full items-center justify-between rounded-[9px] px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <span>{option.label}</span>
                <span className={`h-4 w-7 rounded-full p-0.5 transition-colors ${option.value ? 'bg-brand' : 'bg-bg-tertiary'}`}>
                  <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${option.value ? 'translate-x-3' : ''}`} />
                </span>
              </button>
            ))}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-1 flex w-full items-center gap-1.5 rounded-[9px] px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
                <span>Close image</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* keyboard shortcuts dialog */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="w-full max-w-md rounded-xl border border-border-primary bg-surface p-4 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Keyboard shortcuts</h3>
              <button type="button" onClick={() => setShowShortcuts(false)} aria-label="Close shortcuts" className="grid h-7 w-7 place-items-center rounded-lg text-text-tertiary hover:bg-surface-hover hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                ['Ctrl+Z', 'Undo'],
                ['Ctrl+Shift+Z', 'Redo'],
                ['Ctrl+Y', 'Redo'],
                ['Ctrl+S', 'Save'],
                ['Ctrl+/', 'Toggle this dialog'],
                ['Ctrl+0', 'Actual size'],
                ['Ctrl +/-', 'Zoom in / out'],
                ['Ctrl+T', 'Transform mode (Enter commit, Esc cancel)'],
                ['V', 'Move'],
                ['C', 'Crop'],
                ['B', 'Brush'],
                ['E', 'Eraser'],
                ['S', 'Shape'],
                ['T', 'Text'],
                ['[ / ]', 'Brush size'],
                ['F7', 'Toggle side panel'],
                ['F8', 'Toggle tool rail'],
              ].map(([key, label]) => (
                <React.Fragment key={key}>
                  <kbd className="rounded border border-border-secondary bg-bg-tertiary px-2 py-1 font-mono text-[10px]">{key}</kbd>
                  <span className="flex items-center text-text-secondary">{label}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* print settings dialog */}
      {showPrintDialog && (
        <PrintDialog
          job={job}
          docPx={canvasSize}
          docDataUrl={printPreviewDataUrl}
          onClose={closePrintDialog}
          onPrint={job ? undefined : handleWalkInPrint}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void handleOpenFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
};
