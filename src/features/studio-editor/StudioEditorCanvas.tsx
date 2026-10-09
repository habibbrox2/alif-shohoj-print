import React, { useRef, useState, useEffect } from 'react';
import {
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sun,
  Contrast,
  Crop,
  Check,
  X,
  Type,
  Maximize2,
  Undo2,
  Download,
  Printer,
  Sparkles,
  Layers,
  Palette,
  FileText,
  Sliders,
  Scissors,
  Wand2,
} from 'lucide-react';
import { PrintJob } from '../../shared/types';

type CropPreset = 'free' | 'passport' | 'stamp' | 'nid' | '4r' | 'a4';

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
}

const getInitialCropPreset = (aspectRatio?: string): CropPreset => {
  switch (aspectRatio?.toLowerCase()) {
    case 'passport':
      return 'passport';
    case 'stamp':
      return 'stamp';
    case 'nid':
      return 'nid';
    case 'a4':
      return 'a4';
    case '4r':
      return '4r';
    default:
      return 'free';
  }
};

export const StudioEditorCanvas: React.FC<StudioEditorCanvasProps> = ({
  initialImageUrl,
  job,
  onSave,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageUrl = initialImageUrl || job?.fileUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80';

  // Transformations
  const [rotation, setRotation] = useState<number>(job?.cropSettings?.rotation || 0);
  const [zoom, setZoom] = useState<number>(job?.cropSettings?.zoom || 1);
  const [brightness, setBrightness] = useState<number>(job?.cropSettings?.brightness || 100);
  const [contrast, setContrast] = useState<number>(job?.cropSettings?.contrast || 100);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'none' | 'clean_white' | 'passport_blue' | 'high_sharp' | 'bw_doc'>('none');

  // Text watermark / annotation
  const [annotationText, setAnnotationText] = useState<string>('');
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>('#ffffff');

  // Studio Crop Presets
  const [cropPreset, setCropPreset] = useState<'free' | 'passport' | 'stamp' | 'nid' | '4r' | 'a4'>('free');

  // Image element holder
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      setImgElement(img);
      setImageLoadError(null);
    };
    img.onerror = () => setImageLoadError('ছবিটি লোড করা যায়নি। ফাইলটি পরীক্ষা করে আবার চেষ্টা করুন।');
    setCropPreset(getInitialCropPreset(job?.cropSettings?.aspectRatio));
  }, [imageUrl, job?.cropSettings?.aspectRatio]);

  // Render to canvas
  useEffect(() => {
    if (!imgElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Define base canvas dimensions based on preset
    let targetWidth = 600;
    let targetHeight = 600;

    if (cropPreset === 'passport') {
      targetWidth = 413; // 35mm @ 300 DPI approx
      targetHeight = 531; // 45mm @ 300 DPI approx
    } else if (cropPreset === 'stamp') {
      targetWidth = 250;
      targetHeight = 300;
    } else if (cropPreset === 'nid') {
      targetWidth = 590; // 85mm approx
      targetHeight = 375; // 54mm approx
    } else if (cropPreset === '4r') {
      targetWidth = 600;
      targetHeight = 400;
    } else if (cropPreset === 'a4') {
      targetWidth = 496;
      targetHeight = 701;
    } else {
      targetWidth = imgElement.naturalWidth ? Math.min(imgElement.naturalWidth, 800) : 600;
      targetHeight = imgElement.naturalHeight ? Math.min(imgElement.naturalHeight, 800) : 600;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.save();
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // Apply Background if passport blue or white
    if (activeFilter === 'passport_blue') {
      ctx.fillStyle = '#0f52ba'; // Studio Royal Blue
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    } else if (activeFilter === 'clean_white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    } else {
      ctx.fillStyle = '#0f172a'; // slate 900
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    // Move to center for rotation & zoom
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Filters string
    let filterString = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (grayscale || activeFilter === 'bw_doc') {
      filterString += ` grayscale(100%)`;
    }
    if (activeFilter === 'high_sharp') {
      filterString += ` contrast(130%) brightness(105%)`;
    }
    ctx.filter = filterString;

    // Draw image centered
    const aspect = imgElement.width / imgElement.height;
    let drawW = targetWidth;
    let drawH = targetWidth / aspect;
    if (drawH < targetHeight) {
      drawH = targetHeight;
      drawW = targetHeight * aspect;
    }

    ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Render Text Watermark / Annotation if requested
    if (annotationText && showWatermark) {
      ctx.save();
      ctx.font = 'bold 22px Hind Siliguri, sans-serif';
      ctx.fillStyle = textColor;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText(annotationText, targetWidth / 2, targetHeight - 30);
      ctx.restore();
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
  ]);

  const handleApplyPreset = (preset: 'free' | 'passport' | 'stamp' | 'nid' | '4r' | 'a4') => {
    setCropPreset(preset);
  };

  const handleReset = () => {
    setRotation(0);
    setZoom(1);
    setBrightness(100);
    setContrast(100);
    setGrayscale(false);
    setActiveFilter('none');
    setCropPreset('free');
    setAnnotationText('');
    setShowWatermark(false);
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
      if (onSave) {
        onSave(dataUrl, {
          rotation,
          zoom,
          brightness,
          contrast,
          grayscale,
          cropPreset,
        });
      }
    } catch (error) {
      setIsProcessing(false);
      setSaveError(
        error instanceof Error
          ? `ছবি সংরক্ষণ করা যায়নি: ${error.message}`
          : 'ছবি সংরক্ষণ করা যায়নি। ফাইলটি পরীক্ষা করে আবার চেষ্টা করুন.'
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

  return (
    <div className="fluent-ui flex max-h-[88vh] flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 shadow-xl">
      {/* Canvas Top Bar */}
      <div className="flex flex-col gap-3 border-b border-slate-700/80 bg-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold leading-snug text-white">স্টুডিও এডিটর ক্যানভাস (Canvas Editor)</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800">
                POS & Web Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {job ? `অর্ডার #${job.tokenCode} · ${job.serviceLabelBn}` : 'ডকুমেন্ট ও ছবি প্রসেসিং ক্যানভাস'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            onClick={handleReset}
            className="px-2.5 py-1 text-xs rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>রিসেট</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Editor Body: Left Canvas Preview, Right Tool Controls */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        {/* Left Side: Real-time HTML5 Canvas */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-950 rounded-xl p-4 border border-slate-800/80 relative min-h-[380px]">
          <div className="relative max-w-full max-h-[460px] overflow-hidden rounded-lg shadow-2xl border border-slate-800 flex items-center justify-center bg-slate-900">
            {imageLoadError ? (
              <p role="alert" className="p-6 text-center text-sm text-rose-300">{imageLoadError}</p>
            ) : !imgElement ? (
              <p role="status" className="p-6 text-center text-sm text-slate-400">ছবি লোড হচ্ছে…</p>
            ) : (
              <canvas ref={canvasRef} className="max-w-full max-h-[440px] object-contain shadow-inner" />
            )}
          </div>
          {saveError && <p role="alert" className="mt-2 text-xs text-rose-300">{saveError}</p>}

          {/* Quick overlay badges */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>ক্রপ: {cropPreset.toUpperCase()}</span>
            <span>·</span>
            <span>ঘূর্ণন: {rotation}°</span>
            <span>·</span>
            <span>জুম: {zoom.toFixed(1)}x</span>
            <span>·</span>
            <span>উজ্জ্বলতা: {brightness}%</span>
          </div>
        </div>

        {/* Right Side: Studio Tools & Presets */}
        <div className="lg:col-span-5 space-y-4 text-xs overflow-y-auto pr-1 max-h-[520px]">
          {/* Section 1: Standard Studio Crop Presets */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                <span>স্টুডিও সাইজ প্রিসেট (Crop Presets)</span>
              </span>
              <span className="text-[10px] text-slate-400">১-ক্লিক অনুপাত</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'free' as const, label: 'ফ্রি / অরিজিনাল' },
                { id: 'passport' as const, label: 'পাসপোর্ট (35×45mm)' },
                { id: 'stamp' as const, label: 'স্ট্যাম্প সাইজ' },
                { id: 'nid' as const, label: 'এনআইডি কার্ড' },
                { id: '4r' as const, label: '৪-আর ল্যাব ফটো' },
                { id: 'a4' as const, label: 'A4 ডকুমেন্ট' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  className={`p-1.5 rounded-lg text-center font-medium transition-all ${
                    cropPreset === p.id
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Rotation & Zoom */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>ঘূর্ণন ও জুম অ্যাডজাস্টমেন্ট</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRotation(r => (r - 90 + 360) % 360)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="৯০° বামে ঘোরান"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="৯০° ডানে ঘোরান"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Zoom Slider */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>স্কেল / জুম:</span>
                <span className="font-mono text-emerald-400">{zoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={e => setZoom(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: Studio Filters & Backgrounds */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>স্টুডিও ব্যাকগ্রাউন্ড ও এনহ্যান্সমেন্ট</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setActiveFilter(f => (f === 'passport_blue' ? 'none' : 'passport_blue'))}
                className={`p-2 rounded-lg font-medium text-left flex items-center gap-2 ${
                  activeFilter === 'passport_blue'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-white/50 shrink-0" />
                <span>পাসপোর্ট ব্লু ব্যাকগ্রাউন্ড</span>
              </button>

              <button
                onClick={() => setActiveFilter(f => (f === 'clean_white' ? 'none' : 'clean_white'))}
                className={`p-2 rounded-lg font-medium text-left flex items-center gap-2 ${
                  activeFilter === 'clean_white'
                    ? 'bg-slate-200 text-slate-900 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-white border border-slate-400 shrink-0" />
                <span>হোয়াইট ব্যাকগ্রাউন্ড</span>
              </button>

              <button
                onClick={() => setActiveFilter(f => (f === 'high_sharp' ? 'none' : 'high_sharp'))}
                className={`p-2 rounded-lg font-medium text-left flex items-center gap-2 ${
                  activeFilter === 'high_sharp'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>অটো ক্লিয়ার ও শার্পেন</span>
              </button>

              <button
                onClick={() => setGrayscale(g => !g)}
                className={`p-2 rounded-lg font-medium text-left flex items-center gap-2 ${
                  grayscale
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>ফটোকপি সাদা-কালো</span>
              </button>
            </div>
          </div>

          {/* Section 4: Brightness & Contrast */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-emerald-400" />
              <span>উজ্জ্বলতা ও কনট্রাস্ট (Document Tuning)</span>
            </span>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>উজ্জ্বলতা (Brightness):</span>
                <span className="font-mono text-emerald-400">{brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="180"
                value={brightness}
                onChange={e => setBrightness(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>কনট্রাস্ট (Contrast):</span>
                <span className="font-mono text-emerald-400">{contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="180"
                value={contrast}
                onChange={e => setContrast(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Section 5: Text Annotation / Shop Stamp */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-emerald-400" />
                <span>দোকানের স্ট্যাম্প বা সিল টেক্সট (Watermark)</span>
              </span>
              <input
                type="checkbox"
                checked={showWatermark}
                onChange={e => setShowWatermark(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            {showWatermark && (
              <div className="space-y-2 pt-1 animate-in fade-in">
                <input
                  type="text"
                  placeholder="যেমন: VERIFIED COPY / দোকান কোড"
                  value={annotationText}
                  onChange={e => setAnnotationText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">রং:</span>
                  <button
                    onClick={() => setTextColor('#ffffff')}
                    className={`w-5 h-5 rounded-full bg-white border ${textColor === '#ffffff' ? 'ring-2 ring-emerald-500' : ''}`}
                  />
                  <button
                    onClick={() => setTextColor('#ef4444')}
                    className={`w-5 h-5 rounded-full bg-rose-500 border ${textColor === '#ef4444' ? 'ring-2 ring-emerald-500' : ''}`}
                  />
                  <button
                    onClick={() => setTextColor('#3b82f6')}
                    className={`w-5 h-5 rounded-full bg-blue-500 border ${textColor === '#3b82f6' ? 'ring-2 ring-emerald-500' : ''}`}
                  />
                  <button
                    onClick={() => setTextColor('#10b981')}
                    className={`w-5 h-5 rounded-full bg-emerald-500 border ${textColor === '#10b981' ? 'ring-2 ring-emerald-500' : ''}`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-3.5 bg-slate-800 border-t border-slate-700/80 flex items-center justify-between">
        <button
          onClick={handleDownload}
          className="px-3.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>জেপিজি ডাউনলোড করুন</span>
        </button>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700"
            >
              বাতিল
            </button>
          )}

          <button
            onClick={handleSaveCanvas}
            disabled={isProcessing || !imgElement || !!imageLoadError}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-900/30 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isProcessing ? 'প্রসেসিং হচ্ছে…' : 'ক্যানভাস সংরক্ষণ ও প্রিন্টে প্রেরণ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
