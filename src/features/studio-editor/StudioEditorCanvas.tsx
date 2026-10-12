import React, { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  Circle,
  Crop,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FolderOpen,
  Hand,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Settings2,
  Shapes,
  Sparkles,
  Type,
  Undo2,
  Wand2,
  X,
  Maximize2,
  Check,
  Loader2,
  Zap,
  Sun,
  Contrast,
  Scissors,
  FileText,
  Layers as LayersIcon,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  History,
  Keyboard,
  HelpCircle,
  MousePointer,
  PenTool,
  RotateCcw as RotateIcon,
  Expand,
  Shrink,
  Minimize2,
} from 'lucide-react';
import { PrintJob } from '../../shared/types';
import { removeBackground } from '@imgly/background-removal';
import { useI18n } from '../../shared/i18n/I18nContext';
import { CROP_PRESETS, CROP_SIZE, getInitialCropPreset, isCropPreset, type CropPreset, resolveCanvasSize } from './cropPresets';
import { validateImageFile, readFileAsDataUrl, type ImageFileValidationResult } from './validateImageFile';
import { createBrushStroke, createShapeStroke, addPoint, eraseStrokes, type Stroke } from './strokeModel';
import { pushHistory, undo, redo, HISTORY_LIMIT, type EditorSnapshot } from './editorHistory';

type ToolId = 'move' | 'crop' | 'brush' | 'text' | 'shape' | 'eraser';

interface StudioCanvasAdjustments {
  rotation: number;
  zoom: number;
  brightness: number;
  contrast: number;
  grayscale: boolean;
  cropPreset: CropPreset;
}

interface StudioEditorCanvasProps {
  initialImageUrl?: string;
  job?: PrintJob;
  onSave?: (editedImageUrl: string, adjustments: StudioCanvasAdjustments) => void;
  onClose?: () => void;
  onPrintPreview?: () => void;
  onPrint?: () => void;
}

interface StudioEditorCanvasRef {
  triggerSave: () => void;
  triggerPrintPreview: () => void;
  triggerUndo: () => void;
  triggerRedo: () => void;
  hasUnsavedChanges: () => boolean;
}

type OverlayLayerId = 'text' | 'marks';

const TOOLS: Array<{ id: ToolId; label: string; hint: string; shortcut?: string; icon: React.ReactNode }> = [
  { id: 'move', label: 'Select', hint: 'Move / Select (V)', shortcut: 'V', icon: <MousePointer className="h-4 w-4" /> },
  { id: 'crop', label: 'Crop', hint: 'Crop & Rotate (C)', shortcut: 'C', icon: <Crop className="h-4 w-4" /> },
  { id: 'brush', label: 'Brush', hint: 'Brush (B)', shortcut: 'B', icon: <PenTool className="h-4 w-4" /> },
  { id: 'text', label: 'Text', hint: 'Add Text (T)', shortcut: 'T', icon: <Type className="h-4 w-4" /> },
  { id: 'shape', label: 'Shapes', hint: 'Shapes (S)', shortcut: 'S', icon: <Shapes className="h-4 w-4" /> },
  { id: 'eraser', label: 'Eraser', hint: 'Eraser (E)', shortcut: 'E', icon: <Eraser className="h-4 w-4" /> },
];

const COLOR_SWATCHES = ['#ffffff', '#111827', '#ef4444', '#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6'];

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

/* ------------------------------------------------------------------ main */

export const StudioEditorCanvas: React.FC<StudioEditorCanvasProps> = ({ initialImageUrl, job, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);

  const imageUrl = initialImageUrl || job?.fileUrl || '';

  // --- tool state
  const [tool, setTool] = useState<ToolId>('move');
  const [brushSize, setBrushSize] = useState<number>(8);
  const [brushOpacity, setBrushOpacity] = useState<number>(100);
  const [brushColor, setBrushColor] = useState<string>('#14b8a6');
  const [shapeKind, setShapeKind] = useState<'rect' | 'ellipse'>('rect');

  // --- view state
  const [viewZoom, setViewZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showChecker, setShowChecker] = useState<boolean>(true);

  // --- edit state
  const [rotation, setRotation] = useState<number>(job?.cropSettings?.rotation || 0);
  const [zoom, setZoom] = useState<number>(job?.cropSettings?.zoom || 1);
  const [brightness, setBrightness] = useState<number>(job?.cropSettings?.brightness || 100);
  const [contrast, setContrast] = useState<number>(job?.cropSettings?.contrast || 100);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<EditorSnapshot['activeFilter']>('none');
  const [cropPreset, setCropPreset] = useState<CropPreset>(getInitialCropPreset(job?.cropSettings?.aspectRatio));
  const [annotationText, setAnnotationText] = useState<string>('');
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // Strokes are mutated in place while dragging, so a ref keeps snapshot() honest:
  // committing from a stale closure would restore an older array and erase the mark.
  const strokesRef = useRef<Stroke[]>([]);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  const [overlayOrder, setOverlayOrder] = useState<OverlayLayerId[]>(['marks', 'text']);

  // --- layers visibility / lock
  const [layerVisible, setLayerVisible] = useState<Record<OverlayLayerId | 'photo' | 'adjust', boolean>>({
    text: true,
    marks: true,
    photo: true,
    adjust: true,
  });
  const [layerLocked, setLayerLocked] = useState<Record<OverlayLayerId | 'photo' | 'adjust', boolean>>({
    text: false,
    marks: false,
    photo: true,
    adjust: false,
  });

  // --- history
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // --- panels
  const [showLayers, setShowLayers] = useState<boolean>(true);
  const [showProperties, setShowProperties] = useState<boolean>(true);
  const [showAdjustments, setShowAdjustments] = useState<boolean>(true);
  const [showBackground, setShowBackground] = useState<boolean>(true);
  const [showHistory, setShowHistory] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);

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
  const snapshot = useCallback((): EditorSnapshot => ({
    rotation,
    zoom,
    brightness,
    contrast,
    grayscale,
    activeFilter,
    cropPreset,
    annotationText,
    showWatermark,
    textColor,
    strokes: strokesRef.current,
    showBgRemoved,
  }), [rotation, zoom, brightness, contrast, grayscale, activeFilter, cropPreset, annotationText, showWatermark, textColor, showBgRemoved]);

  const applySnapshot = useCallback((next: EditorSnapshot) => {
    setRotation(next.rotation);
    setZoom(next.zoom);
    setBrightness(next.brightness);
    setContrast(next.contrast);
    setGrayscale(next.grayscale);
    setActiveFilter(next.activeFilter);
    setCropPreset(next.cropPreset);
    setAnnotationText(next.annotationText);
    setShowWatermark(next.showWatermark);
    setTextColor(next.textColor);
    setStrokes(next.strokes);
    setShowBgRemoved(next.showBgRemoved);
  }, []);

  const commit = useCallback((patch: Partial<EditorSnapshot>) => {
    const merged: EditorSnapshot = { ...snapshot(), ...patch };
    applySnapshot(merged);
    setHistory(previous => {
      const trimmed = previous.slice(0, historyIndex + 1);
      const next = [...trimmed, merged];
      setHistoryIndex(next.length - 1);
      return next.slice(-50);
    });
  }, [snapshot, applySnapshot, historyIndex]);

  const resetHistory = useCallback((seed: EditorSnapshot) => {
    setHistory([seed]);
    setHistoryIndex(0);
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const target = historyIndex - 1;
    applySnapshot(history[target]);
    setHistoryIndex(target);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const target = historyIndex + 1;
    applySnapshot(history[target]);
    setHistoryIndex(target);
  };

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
      setStrokes([]);
      const seed: EditorSnapshot = {
        rotation: 0,
        zoom: 1,
        brightness: 100,
        contrast: 100,
        grayscale: false,
        activeFilter: 'none',
        cropPreset: preset ?? 'free',
        annotationText: '',
        showWatermark: false,
        textColor: '#ffffff',
        strokes: [],
        showBgRemoved: false,
      };
      applySnapshot(seed);
      resetHistory(seed);
      setViewZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.onerror = () => setImageLoadError('ছবিটি লোড করা যায়নি। ফাইলটি পরীক্ষা করে আবার চেষ্টা করুন।');
  }, [applySnapshot, resetHistory]);

  useEffect(() => {
    if (imageUrl) loadImage(imageUrl, getInitialCropPreset(job?.cropSettings?.aspectRatio));
  }, [imageUrl, job?.cropSettings?.aspectRatio, loadImage]);

  // -------------------------------------------------------------- rendering
  useEffect(() => {
    if (!imgElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = CROP_SIZE[cropPreset] ?? {
      w: imgElement.naturalWidth ? Math.min(imgElement.naturalWidth, 800) : 600,
      h: imgElement.naturalHeight ? Math.min(imgElement.naturalHeight, 800) : 600,
    };
    canvas.width = size.w;
    canvas.height = size.h;
    const { w: width, h: height } = size;

    ctx.clearRect(0, 0, width, height);

    // Base fill. After background removal the canvas stays transparent so the
    // checkerboard (or the exported PNG alpha) reads correctly.
    if (!showBgRemoved) {
      if (activeFilter === 'passport_blue') ctx.fillStyle = '#0f52ba';
      else if (activeFilter === 'clean_white') ctx.fillStyle = '#ffffff';
      else ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
    }

    if (layerVisible.photo) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      let filterString = `brightness(${layerVisible.adjust ? brightness : 100}%) contrast(${layerVisible.adjust ? contrast : 100}%)`;
      if (layerVisible.adjust && (grayscale || activeFilter === 'bw_doc')) filterString += ' grayscale(100%)';
      if (layerVisible.adjust && activeFilter === 'high_sharp') filterString += ' contrast(130%) brightness(105%)';
      ctx.filter = filterString;

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

    const drawStrokes = () => {
      if (!layerVisible.marks) return;
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
      if (!layerVisible.text || !annotationText || !showWatermark) return;
      ctx.save();
      ctx.font = 'bold 22px Hind Siliguri, sans-serif';
      ctx.fillStyle = textColor;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText(annotationText, width / 2, height - 30);
      ctx.restore();
    };

    for (const layer of overlayOrder) {
      if (layer === 'marks') drawStrokes();
      else drawText();
    }
  }, [
    imgElement,
    rotation,
    zoom,
    brightness,
    contrast,
    grayscale,
    activeFilter,
    cropPreset,
    annotationText,
    showWatermark,
    textColor,
    strokes,
    showBgRemoved,
    overlayOrder,
    layerVisible,
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

  const eraseAt = (point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const radius = (brushSize * 4) / Math.max(rect.width, 1);
    const next = strokesRef.current.filter(stroke =>
      !stroke.points.some(p => Math.hypot(p.x - point.x, p.y - point.y) <= radius),
    );
    strokesRef.current = next;
    setStrokes(next);
  };

  const canPaint = (toolId: ToolId) =>
    (toolId === 'brush' || toolId === 'shape' || toolId === 'eraser') && !layerLocked.marks;

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(event);
    if (!point) return;

    if (tool === 'move') {
      panStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === 'eraser') {
      if (layerLocked.marks) return;
      erasingRef.current = true;
      eraseAt(point);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (!canPaint(tool)) return;
    activeStrokeRef.current = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      kind: tool === 'shape' ? 'shape' : 'brush',
      ...(tool === 'shape' ? { shape: shapeKind } : {}),
      points: [point],
      color: brushColor,
      size: tool === 'shape' ? Math.max(2, brushSize / 2) : brushSize,
      opacity: brushOpacity,
    };
    setStrokes(previous => [...previous, activeStrokeRef.current as Stroke]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (panStartRef.current) {
      const start = panStartRef.current;
      setPan({ x: start.panX + (event.clientX - start.x), y: start.panY + (event.clientY - start.y) });
      return;
    }

    const point = toCanvasPoint(event);
    if (!point) return;

    if (tool === 'eraser' && event.buttons === 1) {
      erasingRef.current = true;
      eraseAt(point);
      return;
    }

    const active = activeStrokeRef.current;
    if (!active || event.buttons !== 1) return;
    active.points.push(point);
    setStrokes(previous => [...previous]);
    strokesRef.current = [...strokesRef.current];
  };

  const erasingRef = useRef(false);

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
      // snapshot() reads strokesRef.current, which pointermove keeps in sync;
      // passing the `strokes` closure here would restore a stale array.
      commit({});
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  // ---------------------------------------------------------------- actions
  const handleApplyPreset = (preset: CropPreset) => commit({ cropPreset: preset });

  const handleRotate = (delta: number) => commit({ rotation: (rotation + delta + 360) % 360 });

  const handleReset = () => {
    const seed: EditorSnapshot = {
      rotation: 0,
      zoom: 1,
      brightness: 100,
      contrast: 100,
      grayscale: false,
      activeFilter: 'none',
      cropPreset: 'free',
      annotationText: '',
      showWatermark: false,
      textColor: '#ffffff',
      strokes: [],
      showBgRemoved: false,
    };
    applySnapshot(seed);
    setHistory(previous => [...previous.slice(0, historyIndex + 1), seed].slice(-50));
    setHistoryIndex(index => index + 1);
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
      onSave?.(dataUrl, { rotation, zoom, brightness, contrast, grayscale, cropPreset });
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

  // Quick zoom helpers
  const handleFitToWidth = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgElement;    if (!canvas || !img) return;    const rect = canvas.getBoundingClientRect();    const canvasSize = CROP_SIZE[cropPreset] ?? { w: img.naturalWidth, h: img.naturalHeight };    const scale = rect.width / canvasSize.w;    setViewZoom(Math.min(4, Math.max(0.25, scale)));    setPan({ x: 0, y: 0 });  }, [cropPreset, imgElement]);

  const handleFitToHeight = useCallback(() => {
    const canvas = canvasRef.current;    const img = imgElement;    if (!canvas || !img) return;    const rect = canvas.getBoundingClientRect();    const canvasSize = CROP_SIZE[cropPreset] ?? { w: img.naturalWidth, h: img.naturalHeight };    const scale = rect.height / canvasSize.h;    setViewZoom(Math.min(4, Math.max(0.25, scale)));    setPan({ x: 0, y: 0 });  }, [cropPreset, imgElement]);

  const handleActualSize = useCallback(() => {    setViewZoom(1);    setPan({ x: 0, y: 0 });  }, []);

  const handleOpenFile = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      setSaveError('অবৈধ ফাইল টাইপ। শুধু ছবি ফাইল (JPG, PNG, WebP, BMP, TIFF) গ্রহণযোগ্য।');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setSaveError('ফাইল আকার খুব বড়। সর্বোচ্চ ৫০ MB অনুমোদিত।');
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setSaveError(null);
      loadImage(dataUrl, 'free');
    } catch {
      setSaveError('ফাইল পড়তে সমস্যা হয়েছে।');
    }
  };

  // ----------------------------------------------------------------- layers
  const moveLayer = (id: OverlayLayerId, direction: -1 | 1) => {
    const index = overlayOrder.indexOf(id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= overlayOrder.length) return;
    const next = [...overlayOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setOverlayOrder(next);
  };

  const layerMeta: Array<{ id: OverlayLayerId | 'photo' | 'adjust'; label: string; icon: React.ReactNode }> = useMemo(() => [
    ...overlayOrder.map(id => ({
      id: id as OverlayLayerId | 'photo' | 'adjust',
      label: id === 'text' ? 'Watermark' : 'Marks',
      icon: id === 'text' ? <Type className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />,
    })),
    { id: 'photo' as const, label: 'Photo', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'adjust' as const, label: 'Adjustments', icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
  ], [overlayOrder]);

  const cursorClass = tool === 'move' ? 'cursor-grab active:cursor-grabbing' : canPaint(tool) ? 'cursor-crosshair' : 'cursor-default';

  const canvasSize = CROP_SIZE[cropPreset] ?? { w: 0, h: 0 };

  // Touch gesture state for pinch-to-zoom and two-finger pan
  const touchStateRef = useRef<{
    initialDistance: number;
    initialZoom: number;    initialPan: { x: number; y: number };
    centerX: number;
    centerY: number;
    isPinching: boolean;
  } | null>(null);

  // Mouse wheel zoom/pan handler
  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Mouse position relative to canvas
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (isCtrl || isShift) {
      // Zoom centered on mouse cursor
      const zoomStep = 0.25;
      const newZoom = viewZoom + (event.deltaY < 0 ? zoomStep : -zoomStep);
      const clampedZoom = Math.min(4, Math.max(0.25, Number(newZoom.toFixed(2))));
      if (clampedZoom === viewZoom) return;

      // Adjust pan so the point under mouse stays under mouse
      const zoomRatio = clampedZoom / viewZoom;
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * zoomRatio,
        y: mouseY - (mouseY - prev.y) * zoomRatio,
      }));
      setViewZoom(clampedZoom);
    } else {
      // Pan (vertical scroll = pan Y, horizontal scroll = pan X)
      setPan(prev => ({
        x: prev.x - event.deltaX,
        y: prev.y - event.deltaY,
      }));
    }
  }, [viewZoom]);

  // Touch gesture handlers for pinch-to-zoom and two-finger pan
  const getTouchDistance = (touches: React.TouchList): number => {    if (touches.length < 2) return 0;    const touch0 = touches[0];    const touch1 = touches[1];    const dx = touch0.clientX - touch1.clientX;    const dy = touch0.clientY - touch1.clientY;    return Math.hypot(dx, dy);  };

  const getTouchCenter = (touches: React.TouchList): { x: number; y: number } => {    if (touches.length < 2) return { x: 0, y: 0 };    const touch0 = touches[0];    const touch1 = touches[1];    return {      x: (touch0.clientX + touch1.clientX) / 2,      y: (touch0.clientY + touch1.clientY) / 2,    };  };

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {    const touches = event.touches;    if (touches.length === 2) {      event.preventDefault();      const canvas = canvasRef.current;      if (!canvas) return;      const rect = canvas.getBoundingClientRect();      const distance = getTouchDistance(touches);      const center = getTouchCenter(touches);      touchStateRef.current = {        initialDistance: distance,        initialZoom: viewZoom,        initialPan: { ...pan },        centerX: center.x - rect.left,        centerY: center.y - rect.top,        isPinching: true,      };    }  }, [viewZoom, pan]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {    const touches = event.touches;    const state = touchStateRef.current;    if (!state || !state.isPinching || touches.length < 2) return;    event.preventDefault();
    const canvas = canvasRef.current;    if (!canvas) return;    const rect = canvas.getBoundingClientRect();
    const distance = getTouchDistance(touches);    const center = getTouchCenter(touches);    const centerX = center.x - rect.left;    const centerY = center.y - rect.top;

    const scale = distance / state.initialDistance;    const newZoom = Math.min(4, Math.max(0.25, state.initialZoom * scale));

    if (newZoom !== viewZoom) {      const zoomRatio = newZoom / viewZoom;      setPan(prev => ({        x: centerX - (centerX - prev.x) * zoomRatio,        y: centerY - (centerY - prev.y) * zoomRatio,      }));      setViewZoom(newZoom);    }  }, [viewZoom]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {    if (event.touches.length < 2) {      touchStateRef.current = null;    }  }, []);

  // ----------------------------------------------------------- keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;

      if (isCtrl && event.key === 'z') {
        event.preventDefault();
        if (isShift) {
          handleRedo();        } else {
          handleUndo();        }
        return;      }
      if (isCtrl && event.key === 'y') {
        event.preventDefault();        handleRedo();        return;      }
      if (isCtrl && event.key === 's') {
        event.preventDefault();        handleSaveCanvas();        return;      }      // Tool shortcuts (single key)      switch (event.key.toLowerCase()) {        case 'v':          setTool('move');          break;        case 'c':          setTool('crop');          break;        case 'b':          setTool('brush');          break;        case 't':          setTool('text');          break;        case 's':          if (!isCtrl) setTool('shape');          break;        case 'e':          setTool('eraser');          break;        case 'z':          if (!isCtrl) setTool('move');          break;        case '/':          if (isCtrl) {            event.preventDefault();            setShowShortcuts(v => !v);          }          break;        case '[':          event.preventDefault();          setBrushSize(s => Math.max(1, s - 5));          break;        case ']':          event.preventDefault();          setBrushSize(s => Math.min(40, s + 5));          break;        case '0':          if (isCtrl) {            event.preventDefault();            setViewZoom(1);            setPan({ x: 0, y: 0 });          }          break;        case '=':        case '+':          if (isCtrl) {            event.preventDefault();            setViewZoom(z => Math.min(4, Number((z + 0.25).toFixed(2))));          }          break;        case '-':        case '_':          if (isCtrl) {            event.preventDefault();            setViewZoom(z => Math.max(0.25, Number((z - 0.25).toFixed(2))));          }          break;      }    };
    window.addEventListener('keydown', handleKeyDown);    return () => window.removeEventListener('keydown', handleKeyDown);  }, [canUndo, canRedo, handleUndo, handleRedo, handleSaveCanvas, tool]);

  // ------------------------------------------------------------------- view
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-secondary">
      {/* ---------------------------------------------------------- top bar */}
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border-primary bg-surface px-2.5">
        <div className="flex items-center gap-1">
          <IconButton onClick={() => fileInputRef.current?.click()} label="Open image">
            <FolderOpen className="h-4 w-4" />
          </IconButton>
          <span className="mx-1 h-4 w-px bg-border-secondary" aria-hidden="true" />
          <IconButton onClick={handleUndo} label="Undo" disabled={!canUndo}>
            <Undo2 className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={handleRedo} label="Redo" disabled={!canRedo}>
            <Redo2 className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mx-auto flex min-w-0 items-center gap-2 px-3">
          <span className="truncate text-xs font-semibold text-text-primary">
            {job ? `#${job.tokenCode}` : 'Studio'}
          </span>
          <span className="hidden truncate text-[11px] text-text-tertiary sm:block">
            {job?.serviceLabelBn ?? 'Image editor'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <IconButton onClick={handleDownload} label="Export JPG">
            <Download className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={handleReset} label="Reset all edits" tone="danger">
            <RotateCcw className="h-4 w-4" />
          </IconButton>          <button            type="button"            onClick={() => setShowShortcuts(open => !open)}            aria-expanded={showShortcuts}            title="Keyboard shortcuts (?) (Ctrl+/)"            className={`grid h-8 w-8 place-items-center rounded-[9px] transition-colors ${              showShortcuts ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'            }`}          >            <Keyboard className="h-4 w-4" />          </button>          <button            type="button"            onClick={() => setShowSettings(open => !open)}            aria-expanded={showSettings}            title="Canvas settings"            className={`grid h-8 w-8 place-items-center rounded-[9px] transition-colors ${              showSettings ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'            }`}          >            <Settings2 className="h-4 w-4" />          </button>          <button            type="button"            onClick={handleSaveCanvas}            disabled={isProcessing || !imgElement || !!imageLoadError}            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-brand px-3 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"          >            <Save className="h-3.5 w-3.5" />            Save          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">{/* left tool rail */}
        <nav className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-border-primary bg-surface py-2" aria-label="Editor tools">          {TOOLS.map(item => (            <button              key={item.id}              type="button"              onClick={() => setTool(item.id)}              title={`${item.label} — ${item.hint}${item.shortcut ? ` [${item.shortcut}]` : ''}`}              aria-label={item.label}              aria-pressed={tool === item.id}              className={`grid h-9 w-9 place-items-center rounded-[10px] transition-all duration-150 relative ${                tool === item.id                  ? 'bg-brand-soft text-brand shadow-[inset_0_0_0_1px_rgba(20,184,166,0.25)]'                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'              }`}            >              {item.icon}              {item.shortcut && (                <span className="absolute bottom-0.5 right-0.5 text-[9px] font-mono text-text-tertiary/70 bg-surface-elevated/90 px-0.5 rounded backdrop-blur-sm">                  {item.shortcut}                </span>              )}            </button>          ))}

          <div className="mt-auto flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setViewZoom(z => Math.min(4, Number((z + 0.25).toFixed(2))))}
              title="Zoom in"
              className="grid h-7 w-7 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewZoom(z => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
              title="Zoom out"
              className="grid h-7 w-7 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        </nav>

        {/* canvas stage */}
        <section className="relative min-w-0 flex-1 overflow-hidden bg-[#0e0f10]">
          <div className="absolute inset-0 grid place-items-center overflow-hidden p-8">
            <div
              className="relative"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${viewZoom})`,
                transformOrigin: 'center center',
                transition: tool === 'move' ? 'none' : 'transform 180ms ease',
              }}
            >
              <div
                className={`relative overflow-hidden rounded-xl shadow-[0_18px_60px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/10 ${cursorClass}`}
              >
                {showChecker && showBgRemoved && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.35]"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg,#2a2c2e 25%,transparent 25%),linear-gradient(-45deg,#2a2c2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2c2e 75%),linear-gradient(-45deg,transparent 75%,#2a2c2e 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
                    }}
                    aria-hidden="true"
                  />
                )}
                {imageLoadError ? (
                  <p role="alert" className="max-w-xs p-8 text-center text-sm text-error">{imageLoadError}</p>
                ) : !imgElement ? (
                  <p role="status" className="max-w-xs p-8 text-center text-sm text-text-tertiary">ছবি লোড হচ্ছে…</p>
                ) : (
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endStroke}
                    onPointerLeave={endStroke}
                    onWheel={handleWheel}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="block max-h-[62vh] max-w-full object-contain"
                    style={{ touchAction: 'none' }}
                  />
                )}
              </div>
            </div>
          </div>

          {saveError && (
            <p role="alert" className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-error-bg px-3 py-1.5 text-xs text-error">
              {saveError}
            </p>
          )}{/* discreet zoom / pan controls, bottom-right */}
          <div className="absolute bottom-3.5 right-3.5 flex items-center gap-0.5 rounded-xl border border-border-primary bg-surface-elevated/90 p-1 shadow-lg backdrop-blur">            <button              type="button"              onClick={() => setViewZoom(z => Math.max(0.25, Number((z - 0.25).toFixed(2))))}              title="Zoom out"              className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"            >              <Minus className="h-3.5 w-3.5" />            </button>            <button              type="button"              onClick={() => { setViewZoom(1); setPan({ x: 0, y: 0 }); }}              title="Actual size (100%)"              className="min-w-[3.25rem] rounded-lg px-1 py-1 text-center text-[11px] font-medium tabular-nums text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"            >              {Math.round(viewZoom * 100)}%            </button>            <button              type="button"              onClick={() => setViewZoom(z => Math.min(4, Number((z + 0.25).toFixed(2))))}              title="Zoom in"              className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"            >              <Plus className="h-3.5 w-3.5" />            </button>            <span className="mx-0.5 h-4 w-px bg-border-secondary" aria-hidden="true" />            <button              type="button"              onClick={handleFitToWidth}              title="Fit to width"              className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"            >              <Expand className="h-3.5 w-3.5" />            </button>            <button              type="button"              onClick={handleFitToHeight}              title="Fit to height"              className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"            >              <Shrink className="h-3.5 w-3.5" />            </button>            <button              type="button"              onClick={handleActualSize}              title="Actual size (100%)"              className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"            >              <Minimize2 className="h-3.5 w-3.5" />            </button>            <span className="mx-0.5 h-4 w-px bg-border-secondary" aria-hidden="true" />            <button              type="button"              onClick={() => setPan({ x: 0, y: 0 })}              title="Reset pan"              className="grid h-7 w-7 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"            >              <Maximize2 className="h-3.5 w-3.5" />            </button>          </div>

          {/* quiet status strip */}
          <div className="pointer-events-none absolute bottom-3.5 left-3.5 flex items-center gap-2 text-[10px] text-text-tertiary">
            <span className="rounded-md bg-surface-elevated/80 px-2 py-1 font-mono tabular-nums backdrop-blur">
              {canvasSize.w ? `${canvasSize.w}×${canvasSize.h}` : 'auto'}
            </span>
            <span className="rounded-md bg-surface-elevated/80 px-2 py-1 font-mono tabular-nums backdrop-blur">{rotation}°</span>
          </div>
        </section>

        {/* right panel */}
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-l border-border-primary bg-surface lg:flex">
          {/* Properties */}
          <PanelSection title="Properties" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} open={showProperties} onToggle={() => setShowProperties(v => !v)}>
            {tool === 'crop' ? (
              <div className="space-y-1.5">
                {CROP_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-left text-xs transition-colors ${
                      cropPreset === preset.id
                        ? 'bg-brand-soft text-brand'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="font-mono text-[10px] opacity-70">{preset.note}</span>
                  </button>
                ))}
                <div className="flex items-center gap-1 pt-1">
                  <IconButton onClick={() => handleRotate(-90)} label="Rotate left">
                    <RotateCcw className="h-4 w-4" />
                  </IconButton>
                  <IconButton onClick={() => handleRotate(90)} label="Rotate right">
                    <RotateCw className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            ) : tool === 'text' ? (
              <div className="space-y-2.5">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Watermark text</span>
                  <input
                    type="text"
                    value={annotationText}
                    onChange={event => commit({ annotationText: event.target.value })}
                    placeholder="VERIFIED COPY / দোকান কোড"
                    className="w-full rounded-[10px] border border-border-primary bg-bg-secondary px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => commit({ showWatermark: !showWatermark })}
                  aria-pressed={showWatermark}
                  className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-xs transition-colors ${
                    showWatermark ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <span>Show watermark</span>
                  <span className={`h-4 w-7 rounded-full p-0.5 transition-colors ${showWatermark ? 'bg-brand' : 'bg-bg-tertiary'}`}>
                    <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${showWatermark ? 'translate-x-3' : ''}`} />
                  </span>
                </button>
                <div>
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Color</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_SWATCHES.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => commit({ textColor: color })}
                        title={color}
                        aria-label={`Text color ${color}`}
                        className={`h-5 w-5 rounded-full ring-offset-1 ring-offset-surface transition-all ${
                          textColor === color ? 'ring-2 ring-brand' : 'ring-1 ring-white/15 hover:ring-white/40'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : tool === 'eraser' ? (
              <div className="space-y-2.5">
                <p className="text-[11px] leading-relaxed text-text-tertiary">
                  {layerLocked.marks ? 'Marks layer is locked. Unlock it in Layers to erase.' : 'Drag on the canvas to remove marks.'}
                </p>
                <Slider label="Size" value={brushSize} min={4} max={40} step={1} suffix=" px" onChange={setBrushSize} />
              </div>
            ) : (
              <div className="space-y-3">
                <Slider label="Brush size" value={brushSize} min={1} max={40} step={1} suffix=" px" onChange={setBrushSize} />
                <Slider label="Opacity" value={brushOpacity} min={10} max={100} step={5} suffix="%" onChange={setBrushOpacity} />
                <div>
                  <span className="mb-1.5 block text-[11px] text-text-secondary">Color</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_SWATCHES.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBrushColor(color)}
                        title={color}
                        aria-label={`Brush color ${color}`}
                        className={`h-5 w-5 rounded-full ring-offset-1 ring-offset-surface transition-all ${
                          brushColor === color ? 'ring-2 ring-brand' : 'ring-1 ring-white/15 hover:ring-white/40'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                {tool === 'shape' && (
                  <div className="flex gap-1.5">
                    {(['rect', 'ellipse'] as const).map(kind => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setShapeKind(kind)}
                        className={`flex-1 rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          shapeKind === kind ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        {kind === 'rect' ? 'Rectangle' : 'Oval'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </PanelSection>

          {/* Adjustments */}
          <PanelSection title="Adjustments" icon={<Sun className="h-3.5 w-3.5" />} open={showAdjustments} onToggle={() => setShowAdjustments(v => !v)}>
            <Slider label="Brightness" value={brightness} min={50} max={180} step={1} suffix="%" onChange={value => commit({ brightness: value })} />
            <Slider label="Contrast" value={contrast} min={50} max={180} step={1} suffix="%" onChange={value => commit({ contrast: value })} />
            <Slider label="Scale" value={zoom} min={0.5} max={2.5} step={0.05} suffix="×" onChange={value => commit({ zoom: value })} />
            <div className="grid grid-cols-2 gap-1.5 pt-1">                {([
                  { id: 'none', label: 'None' },
                  { id: 'passport_blue', label: 'Passport blue' },
                  { id: 'clean_white', label: 'Clean white' },
                  { id: 'high_sharp', label: 'Sharpen' },
                ] as const).map(filter => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => commit({ activeFilter: filter.id })}
                  className={`rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    activeFilter === filter.id ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => commit({ grayscale: !grayscale })}
                className={`rounded-[10px] px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  grayscale ? 'bg-brand-soft text-brand' : 'text-text-secondary hover:bg-surface-hover'
                }`}
              >
                Grayscale
              </button>
            </div>
          </PanelSection>{/* Background removal */}
          <PanelSection title="Background" icon={<Wand2 className="h-3.5 w-3.5" />} open={showBackground} onToggle={() => setShowBackground(v => !v)}>
            {bgRemovalError && <p role="alert" className="rounded-[10px] bg-error-bg px-2.5 py-1.5 text-[11px] text-error">{bgRemovalError}</p>}
            {!showBgRemoved ? (              <button                type="button"                onClick={handleRemoveBackground}                disabled={isRemovingBackground || !originalImgElement}                className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand px-2.5 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"              >                {isRemovingBackground ? (                  <>                    <Loader2 className="h-3.5 w-3.5 animate-spin" />                    <span>Processing…</span>                  </>                ) : (                  <>                    <Zap className="h-3.5 w-3.5" />                    <span>Remove background</span>                  </>                )}              </button>            ) : (              <div className="space-y-1.5">                <p className="flex items-center gap-1.5 rounded-[10px] bg-brand-soft px-2.5 py-1.5 text-[11px] text-brand">                  <Check className="h-3.5 w-3.5 shrink-0" />                  <span>Background removed · transparent</span>                </p>                <button                  type="button"                  onClick={handleRestoreOriginal}                  className="flex w-full items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"                >                  <RotateCcw className="h-3.5 w-3.5" />                  <span>Restore original</span>                </button>              </div>            )}
            <p className="text-[10px] leading-relaxed text-text-tertiary">Runs on-device. No image leaves this PC.</p>          </PanelSection>

          {/* History */}          <PanelSection title="History" icon={<History className="h-3.5 w-3.5" />} open={showHistory} onToggle={() => setShowHistory(v => !v)}>            {history.length === 0 ? (              <p className="text-[11px] text-text-tertiary text-center py-4">No history yet</p>            ) : (              <ul className="space-y-1 max-h-60 overflow-y-auto">                {history.slice().reverse().map((snapshot, revIndex) => {                  const index = history.length - 1 - revIndex;                  const isCurrent = index === historyIndex;                  return (                    <li key={index}>                      <button                        type="button"                        onClick={() => {                          applySnapshot(snapshot);                          setHistoryIndex(index);                        }}                        disabled={isCurrent}                        className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[11px] transition-colors ${                          isCurrent                            ? 'bg-brand-soft text-brand font-medium'                            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'                        }`}                      >                        <span className="flex-1 truncate">                          {index === 0 ? 'Initial state' : `Step ${index}`}                        </span>                        {isCurrent && <Check className="h-3.5 w-3.5 text-brand" />}                      </button>                    </li>                  );                })}              </ul>            )}            <div className="flex items-center gap-2 pt-2 border-t border-border-secondary">              <IconButton                onClick={handleUndo}                label="Undo (Ctrl+Z)"                disabled={!canUndo}              >                <Undo2 className="h-4 w-4" />              </IconButton>              <IconButton                onClick={handleRedo}                label="Redo (Ctrl+Y)"                disabled={!canRedo}              >                <Redo2 className="h-4 w-4" />              </IconButton>              <span className="flex-1 text-[10px] text-text-tertiary">                {historyIndex + 1} / {history.length}              </span>            </div>          </PanelSection>

          {/* Keyboard Shortcuts */}          <PanelSection title="Shortcuts" icon={<Keyboard className="h-3.5 w-3.5" />} open={showShortcuts} onToggle={() => setShowShortcuts(v => !v)}>            <div className="space-y-2 text-[11px]">              <div className="grid grid-cols-2 gap-2 text-text-secondary">                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">Ctrl+Z</kbd>                <span>Undo</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">Ctrl+Shift+Z</kbd>                <span>Redo</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">Ctrl+Y</kbd>                <span>Redo</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">Ctrl+S</kbd>                <span>Save</span>              </div>              <div className="pt-2 border-t border-border-secondary grid grid-cols-2 gap-2 text-text-secondary">                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">V</kbd>                <span>Select / Move</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">C</kbd>                <span>Crop</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">B</kbd>                <span>Brush</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">T</kbd>                <span>Text</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">S</kbd>                <span>Shapes</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">E</kbd>                <span>Eraser</span>              </div>              <div className="pt-2 border-t border-border-secondary grid grid-cols-2 gap-2 text-text-secondary">                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">[ / ]</kbd>                <span>Brush size − / +</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">Ctrl+0</kbd>                <span>Reset zoom</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">Ctrl++ / -</kbd>                <span>Zoom in / out</span>                <kbd className="px-2 py-1 rounded bg-bg-tertiary font-mono text-[10px] border border-border-secondary">Ctrl+/</kbd>                <span>Show shortcuts</span>              </div>            </div>          </PanelSection>

          {/* Layers */}
          <PanelSection title="Layers" icon={<LayersIcon className="h-3.5 w-3.5" />} open={showLayers} onToggle={() => setShowLayers(v => !v)}>
            <ul className="space-y-1">
              {layerMeta.map((layer, index) => (
                <li
                  key={layer.id}
                  className={`flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 transition-colors ${
                    index === 0 ? 'bg-bg-secondary' : ''
                  }`}
                >
                  <span className="text-text-tertiary">{layer.icon}</span>
                  <span className={`flex-1 truncate text-[11px] ${index === 0 ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                    {layer.label}
                  </span>

                  {layer.id === 'marks' || layer.id === 'text' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => moveLayer(layer.id as OverlayLayerId, -1)}
                        disabled={index === 0}
                        title="Move up"
                        className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
                      >
                        <ChevronRight className="h-3 w-3 -rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayer(layer.id as OverlayLayerId, 1)}
                        disabled={index === overlayOrder.length - 1}
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
                    onClick={() => setLayerVisible(previous => ({ ...previous, [layer.id]: !previous[layer.id] }))}
                    title={layerVisible[layer.id] ? 'Hide layer' : 'Show layer'}
                    className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                  >
                    {layerVisible[layer.id] ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-50" />}
                  </button>

                  {layer.id === 'photo' || layer.id === 'adjust' ? (
                    <span className="grid h-6 w-6 place-items-center text-text-tertiary/60" title="Always locked">
                      <Lock className="h-3 w-3" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLayerLocked(previous => ({ ...previous, [layer.id]: !previous[layer.id] }))}
                      title={layerLocked[layer.id] ? 'Unlock layer' : 'Lock layer'}
                      className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      {layerLocked[layer.id] ? <Lock className="h-3 w-3 text-brand" /> : <LockOpen className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </PanelSection>

          {/* History */}
          <PanelSection title="History" icon={<Undo2 className="h-3.5 w-3.5" />} open={showHistory} onToggle={() => setShowHistory(v => !v)}>
            {history.length === 0 ? (
              <p className="text-[11px] text-text-tertiary">No edits yet.</p>
            ) : (
              <>
                <ol className="space-y-0.5">
                  {history.slice(-8).reverse().map((entry, index) => {
                    const absoluteIndex = history.length - 1 - index;
                    return (
                      <li
                        key={`${absoluteIndex}-${entry.cropPreset}`}
                        className={`flex items-center gap-2 rounded-[8px] px-2 py-1 text-[11px] ${
                          absoluteIndex === historyIndex ? 'bg-brand-soft text-brand' : 'text-text-tertiary'
                        }`}
                      >
                        <span className="font-mono tabular-nums opacity-60">{String(absoluteIndex + 1).padStart(2, '0')}</span>
                        <span className="flex-1 truncate">{absoluteIndex === 0 ? 'Opened' : entry.cropPreset !== 'free' ? `Crop · ${entry.cropPreset}` : entry.strokes.length > 0 ? 'Marks' : 'Adjust'}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex gap-1.5 pt-1">
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
        </aside>
      </div>

      {/* settings popover */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} aria-hidden="true" />
          <div className="absolute right-2.5 top-12 z-40 w-56 rounded-xl border border-border-primary bg-surface-elevated p-2 shadow-xl">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Canvas</p>
            {[
              { id: 'checker', label: 'Transparency grid', value: showChecker, onChange: () => setShowChecker(v => !v) },
            ].map(option => (
              <button
                key={option.id}
                type="button"
                onClick={option.onChange}
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
                <span>Close editor</span>
              </button>
            )}
          </div>
        </>
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
