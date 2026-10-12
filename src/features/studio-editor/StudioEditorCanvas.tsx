import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  History,
  Layers as LayersIcon,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
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
  editorHistorySummary,
  resolveFontStack,
} from './studioAdjustments';
import type { EditorFilter, StudioCanvasAdjustments, TextAlign, ToolId } from './studioTypes';
import { StudioOverflowMenu, StudioStatusBar, StudioToolRail, getStudioTool, type StudioMenuItem } from './StudioWorkspaceChrome';

interface StudioEditorCanvasProps {
  initialImageUrl?: string;
  job?: PrintJob;
  onSave?: (editedImageUrl: string, adjustments: StudioCanvasAdjustments) => void;
  onClose?: () => void;
  onPrintPreview?: () => void;
  onPrint?: () => void;
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

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

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
      <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{title}</span>
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

/* ------------------------------------------------------------------ main */

export const StudioEditorCanvas: React.FC<StudioEditorCanvasProps> = ({ initialImageUrl, job, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigatorRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const erasingRef = useRef(false);
  const isDesktop = useIsDesktop();
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
  const [contrast, setContrast] = useState<number>(job?.cropSettings?.contrast || 100);
  const [saturation, setSaturation] = useState<number>(100);
  const [exposure, setExposure] = useState<number>(0);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<EditorFilter>('none');
  const [cropPreset, setCropPreset] = useState<CropPreset>(getInitialCropPreset(job?.cropSettings?.aspectRatio));
  const [annotationText, setAnnotationText] = useState<string>('');
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(DEFAULT_TEXT_SIZE);
  const [textAlign, setTextAlign] = useState<TextAlign>(DEFAULT_TEXT_ALIGN);
  const [textFont, setTextFont] = useState<string>(DEFAULT_TEXT_FONT);
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
  const [showAdjustments, setShowAdjustments] = useState<boolean>(true);
  const [showTextOptions, setShowTextOptions] = useState<boolean>(true);
  const [showBackground, setShowBackground] = useState<boolean>(true);
  const [showLayers, setShowLayers] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean>(false);
  const [showToolRail, setShowToolRail] = useState<boolean>(true);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);
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
  const [bgRemovedImgElement, setBgRemovedImgElement] = useState<HTMLImageElement | null>(null);
  const [showBgRemoved, setShowBgRemoved] = useState<boolean>(false);
  const [bgRemovalError, setBgRemovalError] = useState<string | null>(null);

  // ---------------------------------------------------------- history core
  const makeSeed = useCallback((preset: CropPreset): EditorSnapshot => ({
    rotation: 0,
    zoom: 1,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    exposure: 0,
    grayscale: false,
    activeFilter: 'none',
    cropPreset: preset,
    annotationText: '',
    showWatermark: false,
    textColor: '#ffffff',
    textSize: DEFAULT_TEXT_SIZE,
    textAlign: DEFAULT_TEXT_ALIGN,
    textFont: DEFAULT_TEXT_FONT,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    contentLayers: defaultContentLayerStack(),
    showBgRemoved: false,
  }), []);

  const snapshot = useCallback((): EditorSnapshot => ({
    rotation,
    zoom: scale,
    brightness,
    contrast,
    saturation,
    exposure,
    grayscale,
    activeFilter,
    cropPreset,
    annotationText,
    showWatermark,
    textColor,
    textSize,
    textAlign,
    textFont,
    backgroundColor,
    contentLayers: contentLayersRef.current,
    showBgRemoved,
  }), [rotation, scale, brightness, contrast, saturation, exposure, grayscale, activeFilter, cropPreset, annotationText, showWatermark, textColor, textSize, textAlign, textFont, backgroundColor, showBgRemoved]);

  const applySnapshot = useCallback((next: EditorSnapshot) => {
    setRotation(next.rotation);
    setScale(next.zoom);
    setBrightness(next.brightness);
    setContrast(next.contrast);
    setSaturation(next.saturation);
    setExposure(next.exposure);
    setGrayscale(next.grayscale);
    setActiveFilter(next.activeFilter);
    setCropPreset(next.cropPreset);
    setAnnotationText(next.annotationText);
    setShowWatermark(next.showWatermark);
    setTextColor(next.textColor);
    setTextSize(next.textSize);
    setTextAlign(next.textAlign);
    setTextFont(next.textFont);
    setBackgroundColor(next.backgroundColor);
    setContentLayers(next.contentLayers);
    setActiveLayerId(current =>
      next.contentLayers.some(layer => layer.id === current)
        ? current
        : next.contentLayers.find(layer => layer.kind === 'paint')?.id ?? DEFAULT_PAINT_LAYER_ID
    );
    setShowBgRemoved(next.showBgRemoved);
  }, []);

  const commit = useCallback((patch: Partial<EditorSnapshot>, label?: string) => {
    const merged: EditorSnapshot = { ...snapshot(), ...patch };
    if (label) merged.label = label;
    applySnapshot(merged);
    const result = pushHistory(historyRef.current, historyIndexRef.current, merged, HISTORY_LIMIT);
    historyRef.current = result.history;
    historyIndexRef.current = result.index;
    setHistory(result.history);
    setHistoryIndex(result.index);
  }, [snapshot, applySnapshot]);

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

  // -------------------------------------------------------------- rendering
  const canvasSize = useMemo(() => {
    const fixed = CROP_SIZE[cropPreset];
    if (fixed) return fixed;
    return {
      w: imgElement?.naturalWidth ? Math.min(imgElement.naturalWidth, 800) : 600,
      h: imgElement?.naturalHeight ? Math.min(imgElement.naturalHeight, 800) : 600,
    };
  }, [cropPreset, imgElement]);

  useEffect(() => {
    if (!imgElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    const { w: width, h: height } = canvasSize;

    ctx.clearRect(0, 0, width, height);

    // Base fill. After background removal the canvas stays transparent so the
    // checkerboard (or the exported PNG alpha) reads correctly.
    if (!showBgRemoved) {
      if (activeFilter === 'passport_blue') ctx.fillStyle = '#0f52ba';
      else if (activeFilter === 'clean_white') ctx.fillStyle = '#ffffff';
      else ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    if (layerVisible.photo) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      ctx.filter = buildPhotoFilter({
        brightness,
        contrast,
        saturation,
        exposure,
        grayscale,
        activeFilter,
        adjustmentsVisible: layerVisible.adjust,
      });

      const aspect = imgElement.width / imgElement.height;
      let drawW = width;
      let drawH = width / aspect;
      if (drawH < height) {
        drawH = height;
        drawW = height * aspect;
      }
      ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

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
      ctx.font = `bold ${textSize}px ${resolveFontStack(textFont)}`;
      ctx.fillStyle = textColor;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
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
  }, [
    imgElement,
    canvasSize,
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
    showBgRemoved,
    layerVisible,
  ]);

  // Navigator thumbnail mirrors the committed canvas.
  useEffect(() => {
    const nav = navigatorRef.current;
    const source = canvasRef.current;
    if (!nav || !source || !imgElement || source.width === 0) return;
    const maxWidth = 236;
    const maxHeight = 140;
    const ratio = Math.min(maxWidth / source.width, maxHeight / source.height, 1);
    nav.width = Math.max(1, Math.round(source.width * ratio));
    nav.height = Math.max(1, Math.round(source.height * ratio));
    const ctx = nav.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, nav.width, nav.height);
    ctx.drawImage(source, 0, 0, nav.width, nav.height);
  });

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

  const eraseAt = (point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const radius = (brushSize * 4) / Math.max(rect.width, 1);
    writeActiveLayer(strokes => eraseStrokes(strokes, point, radius));
  };

  const activeLayer = contentLayers.find(layer => layer.id === activeLayerId);
  const canPaint = (toolId: ToolId) =>
    (toolId === 'brush' || toolId === 'shape' || toolId === 'eraser') &&
    activeLayer?.kind === 'paint' &&
    !isLayerLocked(activeLayerId);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
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
    const stroke = tool === 'shape'
      ? createShapeStroke(id, point, shapeKind, brushColor, Math.max(2, brushSize / 2), brushOpacity)
      : createBrushStroke(id, point, brushColor, brushSize, brushOpacity);
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

    const active = activeStrokeRef.current;
    if (!active || event.buttons !== 1) return;
    const updated = addPoint(active, point);
    activeStrokeRef.current = updated;
    writeActiveLayer(strokes => strokes.map(stroke => (stroke.id === updated.id ? updated : stroke)));
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
  const handleApplyPreset = (preset: CropPreset) => commit({ cropPreset: preset }, `Crop · ${preset}`);

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
      const resultBlob = await removeBackground(blob);
      const resultUrl = URL.createObjectURL(resultBlob);
      const resultImg = new Image();
      resultImg.src = resultUrl;
      await new Promise<void>((resolve, reject) => {
        resultImg.onload = () => resolve();
        resultImg.onerror = reject;
      });
      setBgRemovedImgElement(resultImg);
      setShowBgRemoved(true);
      setImgElement(resultImg);
      commit({ showBgRemoved: true }, 'Remove background');
    } catch (error) {
      setBgRemovalError(
        error instanceof Error
          ? `ব্যাকগ্রাউন্ড সরাতে সমস্যা: ${error.message}`
          : 'ব্যাকগ্রাউন্ড সরাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
      );
      setShowBgRemoved(false);
    } finally {
      setIsRemovingBackground(false);
    }
  };

  const handleRestoreOriginal = () => {
    if (!originalImgElement) return;
    setImgElement(originalImgElement);
    setShowBgRemoved(false);
    setBgRemovalError(null);
    commit({ showBgRemoved: false }, 'Restore original');
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
      onSave?.(dataUrl, { rotation, zoom: scale, brightness, contrast, grayscale, cropPreset });
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;

      if (event.key === 'Escape') {
        if (showOverflowMenu) setShowOverflowMenu(false);
        else if (showSettings) setShowSettings(false);
        else if (showShortcuts) setShowShortcuts(false);
        else if (mobilePanelOpen) setMobilePanelOpen(false);
        return;
      }

      // F7/F8 toggle the side panels; only on desktop where they exist.
      if (isDesktop && !isCtrl && !isShift && (event.key === 'F7' || event.key === 'F8')) {
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
  }, [showOverflowMenu, showSettings, showShortcuts, mobilePanelOpen, isDesktop, handleUndo, handleRedo, handleSaveCanvas, handleActualSize, selectTool]);

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
  ];

  // ------------------------------------------------------------ options bar
  const toolDefinition = getStudioTool(tool);

  const colorRow = (
    <div className="flex items-center gap-2">
      <Swatches value={brushColor} label="Color" onSelect={setBrushColor} />
      <label className="relative grid h-6 w-6 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-border-primary" title="Custom brush color">
        <span className="block h-full w-full" style={{ backgroundColor: brushColor }} />
        <input
          type="color"
          value={brushColor}
          onChange={event => setBrushColor(event.target.value)}
          aria-label="Custom brush color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );

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
          <Swatches value={textColor} label="Text color" onSelect={color => commit({ textColor: color }, 'Text color')} />
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
      <div className="flex shrink-0 items-center gap-1 border-b border-border-primary px-2 py-1.5" role="tablist" aria-label="Editor panels">
        {rightTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={rightTab === tab.id}
            onClick={() => setRightTab(tab.id)}
            className={`flex-1 rounded-[9px] px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              rightTab === tab.id ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMobilePanelOpen(false)}
          title="Hide panels"
          aria-label="Hide panels"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary lg:hidden"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rightTab === 'layers' && (
          <>
            <div className="border-b border-border-secondary p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">Navigator</span>
                <span className="font-mono text-[10px] tabular-nums text-text-tertiary">{Math.round(viewZoom * 100)}%</span>
              </div>
              <div className="grid place-items-center rounded-lg border border-border-secondary bg-[#0e0f10] p-2">
                {imgElement ? (
                  <canvas ref={navigatorRef} className="block max-h-36 max-w-full" aria-label="Navigator preview" />
                ) : (
                  <p className="py-6 text-[11px] text-text-tertiary">No image</p>
                )}
              </div>
            </div>

            <PanelSection title="Layers" icon={<LayersIcon className="h-3.5 w-3.5" />} open={showLayers} onToggle={() => setShowLayers(value => !value)}>
              <ul className="space-y-1">
                {layerMeta.map((layer, index) => (
                  <li
                    key={layer.id}
                    onClick={() => {
                      if (layer.reorderable) setActiveLayerId(layer.id);
                    }}
                    className={`flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 transition-colors ${layer.id === activeLayerId ? 'bg-bg-secondary' : ''}`}
                  >
                    <span className="text-text-tertiary">{layer.icon}</span>
                    <span className={`flex-1 truncate text-[11px] ${layer.id === activeLayerId ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                      {layer.label}
                    </span>

                    {layer.reorderable ? (
                      <>
                        <button
                          type="button"
                          onClick={() => moveLayer(layer.id, -1)}
                          disabled={index === 0}
                          title="Move up"
                          className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
                        >
                          <ChevronRight className="h-3 w-3 -rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLayer(layer.id, 1)}
                          disabled={index === contentLayers.length - 1}
                          title="Move down"
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
                      onClick={() => toggleLayerVisibility(layer.id)}
                      title={isLayerVisible(layer.id) ? 'Hide layer' : 'Show layer'}
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
                        onClick={() => setLayerLocked(previous => ({ ...previous, [layer.id]: !previous[layer.id] }))}
                        title={isLayerLocked(layer.id) ? 'Unlock layer' : 'Lock layer'}
                        className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                      >
                        {isLayerLocked(layer.id) ? <Lock className="h-3 w-3 text-brand" /> : <LockOpen className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </PanelSection>
          </>
        )}

        {rightTab === 'props' && (
          <>
            {tool === 'text' && (
              <PanelSection title="Text" icon={<Type className="h-3.5 w-3.5" />} open={showTextOptions} onToggle={() => setShowTextOptions(value => !value)}>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Font</span>
                  <FontSelect value={textFont} onChange={font => commit({ textFont: font }, 'Text font')} />
                </label>
                <Slider label="Font size" value={textSize} min={ADJUSTMENT_RANGES.textSize.min} max={ADJUSTMENT_RANGES.textSize.max} step={1} suffix=" px" onChange={value => commit({ textSize: value }, 'Text size')} />
                <div>
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Color</span>
                  <Swatches value={textColor} label="Text color" onSelect={color => commit({ textColor: color }, 'Text color')} />
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

            <PanelSection title="Adjustments" icon={<Sun className="h-3.5 w-3.5" />} open={showAdjustments} onToggle={() => setShowAdjustments(value => !value)}>
              <Slider label="Brightness" value={brightness} min={ADJUSTMENT_RANGES.brightness.min} max={ADJUSTMENT_RANGES.brightness.max} step={1} suffix="%" onChange={value => commit({ brightness: value }, 'Brightness')} />
              <Slider label="Contrast" value={contrast} min={ADJUSTMENT_RANGES.contrast.min} max={ADJUSTMENT_RANGES.contrast.max} step={1} suffix="%" onChange={value => commit({ contrast: value }, 'Contrast')} />
              <Slider label="Saturation" value={saturation} min={ADJUSTMENT_RANGES.saturation.min} max={ADJUSTMENT_RANGES.saturation.max} step={1} suffix="%" onChange={value => commit({ saturation: value }, 'Saturation')} />
              <Slider label="Exposure" value={exposure} min={ADJUSTMENT_RANGES.exposure.min} max={ADJUSTMENT_RANGES.exposure.max} step={ADJUSTMENT_RANGES.exposure.step} suffix={ADJUSTMENT_RANGES.exposure.suffix} onChange={value => commit({ exposure: Number(value.toFixed(1)) }, 'Exposure')} />
              <Slider label="Scale" value={scale} min={ADJUSTMENT_RANGES.scale.min} max={ADJUSTMENT_RANGES.scale.max} step={0.05} suffix="×" onChange={value => commit({ zoom: value }, 'Scale')} />
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

            <PanelSection title="Background" icon={<Wand2 className="h-3.5 w-3.5" />} open={showBackground} onToggle={() => setShowBackground(value => !value)}>
              {bgRemovalError && <p role="alert" className="rounded-[10px] bg-error-bg px-2.5 py-1.5 text-[11px] text-error">{bgRemovalError}</p>}
              {!showBgRemoved ? (
                <button
                  type="button"
                  onClick={handleRemoveBackground}
                  disabled={isRemovingBackground || !originalImgElement}
                  className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand px-2.5 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRemovingBackground ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      <span>Remove background</span>
                    </>
                  )}
                </button>
              ) : (
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
            </PanelSection>
          </>
        )}

        {rightTab === 'history' && (
          <PanelSection title="History" icon={<History className="h-3.5 w-3.5" />} open onToggle={() => undefined}>
            {history.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-text-tertiary">No history yet</p>
            ) : (
              <>
                <ol className="max-h-72 space-y-1 overflow-y-auto">
                  {history.slice().reverse().map((entry, reverseIndex) => {
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
                            isCurrent ? 'bg-brand-soft font-medium text-brand' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                          }`}
                        >
                          <span className="font-mono tabular-nums opacity-60">{String(index + 1).padStart(2, '0')}</span>
                          <span className="flex-1 truncate">{editorHistorySummary(entry, index)}</span>
                          {isCurrent && <Check className="h-3.5 w-3.5 text-brand" />}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex gap-1.5 border-t border-border-secondary pt-2">
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
              </>
            )}
          </PanelSection>
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
          <button
            type="button"
            onClick={() => setMobilePanelOpen(true)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary lg:hidden"
            title="Show panels"
            aria-label="Show panels"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- body */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
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
                    {buildRulerTicks(canvasSize.w).map(tick => (
                      <span key={`h-${tick.ratio}`} className="absolute top-0 -translate-x-1/2 font-mono text-[9px] tabular-nums text-text-tertiary" style={{ left: `${tick.ratio * 100}%` }}>
                        {tick.px}
                      </span>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute -left-6 top-0 bottom-0 w-5" aria-hidden="true">
                    {buildRulerTicks(canvasSize.h).map(tick => (
                      <span key={`v-${tick.ratio}`} className="absolute left-0 -translate-y-1/2 font-mono text-[9px] tabular-nums text-text-tertiary" style={{ top: `${tick.ratio * 100}%` }}>
                        {tick.px}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div
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

          {imgElement && (
            <div className="pointer-events-none absolute left-3.5 top-3.5 z-10 rounded-lg border border-border-primary bg-[var(--color-studio-panel)]/85 px-2 py-1 font-mono text-[10px] tabular-nums text-text-secondary backdrop-blur-sm">
              {canvasSize.w}×{canvasSize.h} px · {Math.round(viewZoom * 100)}%
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

        {isDesktop && showRightPanel && (
          <aside className="flex w-[280px] shrink-0 flex-col border-l border-border-primary bg-[var(--color-studio-panel)]">
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

      {/* mobile slide-in panel drawer */}
      {!isDesktop && mobilePanelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="flex-1 bg-black/50" onClick={() => setMobilePanelOpen(false)} aria-hidden="true" />
          <div className="flex h-full w-72 max-w-[85vw] flex-col border-l border-border-primary bg-[var(--color-studio-panel)] shadow-2xl">
            {rightPanel}
          </div>
        </div>
      )}

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
