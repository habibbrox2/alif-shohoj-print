import React, { useEffect, useState } from 'react';
import { useStudio } from '../../shared/context/StudioContext';
import { PrintJob, RejectReason, PaperSize, ColorMode } from '../../shared/types';
import {
  X,
  Printer,
  Check,
  AlertTriangle,
  RotateCw,
  Sun,
  Maximize2,
  Clock,
  History,
  Trash2,
  Edit3,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { StudioEditorCanvas } from '../studio-editor/StudioEditorCanvas';

export const OrderCardModal: React.FC = () => {
  const {
    activeOrderCardJob,
    setActiveOrderCardJob,
    approveJob,
    rejectJob,
    editJob,
    printers,
    pricing,
  } = useStudio();

  const [activeTab, setActiveTab] = useState<'card' | 'preview' | 'edit' | 'canvas' | 'reject' | 'audit'>('card');

  // Reject state
  const [selectedRejectReason, setSelectedRejectReason] = useState<RejectReason>('blurry_photo');
  const [rejectNote, setRejectNote] = useState('');

  // Edit state
  const [editCopies, setEditCopies] = useState<number>(activeOrderCardJob?.copies || 1);
  const [editPaperSize, setEditPaperSize] = useState<PaperSize>(activeOrderCardJob?.paperSize || '4R (4x6 in)');
  const [editColorMode, setEditColorMode] = useState<ColorMode>(activeOrderCardJob?.colorMode || 'color');
  const [editPrinterId, setEditPrinterId] = useState<string>(activeOrderCardJob?.targetPrinterId || '');
  const [editRotation, setEditRotation] = useState<number>(activeOrderCardJob?.cropSettings?.rotation || 0);
  const [editBrightness, setEditBrightness] = useState<number>(activeOrderCardJob?.cropSettings?.brightness || 100);
  const [editContrast, setEditContrast] = useState<number>(activeOrderCardJob?.cropSettings?.contrast || 100);
  const [editGridCount, setEditGridCount] = useState<number>(activeOrderCardJob?.gridCount || 4);
  const [windowsPrinters, setWindowsPrinters] = useState<string[]>([]);
  const [printerLoadError, setPrinterLoadError] = useState<string | null>(null);

  useEffect(() => {
    const desktop = window.broxprintDesktop;
    if (!desktop) return;
    let active = true;
    void desktop.listPrinters()
      .then(availablePrinters => {
        if (active) {
          setWindowsPrinters(availablePrinters);
          setPrinterLoadError(null);
        }
      })
      .catch(error => {
        if (active) setPrinterLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, []);

  if (!activeOrderCardJob) return null;

  const job = activeOrderCardJob;
  const isPdf = job.fileUrl.startsWith('data:application/pdf') || /\.pdf(?:$|[?#])/i.test(job.fileName);
  const hasFile = Boolean(job.fileUrl);

  const formatTimeAgo = (timestamp: number) => {
    const mins = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
    return `${mins} মিনিট আগে`;
  };

  const handleApprove = () => {
    approveJob(job.id);
    setActiveOrderCardJob(null);
  };

  const handleConfirmReject = () => {
    rejectJob(job.id, selectedRejectReason, rejectNote);
    setActiveOrderCardJob(null);
  };

  const calculateRecalculatedPrice = () => {
    let base = 35;
    if (job.serviceType === 'passport_photo') base = editGridCount === 8 ? pricing.passport8in1 : pricing.passport4in1;
    else if (job.serviceType === 'nid_card') base = pricing.nidSmartCard;
    else if (job.serviceType === 'photo_4r') base = pricing.photo4R;
    else if (job.serviceType === 'doc_a4') base = editColorMode === 'color' ? pricing.docA4Color : pricing.docA4BW;
    return base * editCopies;
  };

  const handleSaveEdit = () => {
    const windowsPrinterName = editPrinterId.startsWith('windows:')
      ? editPrinterId.slice('windows:'.length)
      : null;
    const targetPrinter = printers.find(p => p.id === editPrinterId);
    const newPrice = calculateRecalculatedPrice();
    const priceChanged = newPrice !== job.priceBDT;

    const updates: Partial<PrintJob> = {
      copies: editCopies,
      paperSize: editPaperSize,
      colorMode: editColorMode,
      targetPrinterId: windowsPrinterName ? `windows:${windowsPrinterName}` : editPrinterId || job.targetPrinterId,
      targetPrinterName: windowsPrinterName || (targetPrinter ? targetPrinter.name : job.targetPrinterName),
      priceBDT: newPrice,
      originalPriceBDT: job.originalPriceBDT || job.priceBDT,
      priceChangedConsentRequired: priceChanged,
      gridCount: editGridCount,
      cropSettings: {
        zoom: job.cropSettings?.zoom || 1,
        rotation: editRotation,
        brightness: editBrightness,
        contrast: editContrast,
        aspectRatio: job.cropSettings?.aspectRatio || '4R',
      },
    };

    const auditText = `Shopkeeper modified order: Copies=${editCopies}, Paper=${editPaperSize}, Color=${editColorMode}, Printer=${windowsPrinterName || targetPrinter?.name || job.targetPrinterName}. Price changed from ৳${job.priceBDT} to ৳${newPrice}.`;

    editJob(job.id, updates, auditText);
    setActiveTab('card');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className={`relative w-full ${activeTab === 'canvas' ? 'max-w-6xl max-h-[98vh]' : 'max-w-lg max-h-[92vh]'} bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col`}>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/80 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-emerald-400">#{job.tokenCode}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-300 font-medium">{job.serviceLabelBn}</span>
          </div>
          {job.printError && (
            <p role="alert" className="text-xs text-rose-300">
              প্রিন্ট ব্যর্থ: {job.printError}
            </p>
          )}

          <div className="flex items-center gap-1.5">
            {activeTab === 'canvas' ? (
              <button
                onClick={() => setActiveTab('edit')}
                className="px-2.5 py-1 text-xs rounded-md text-slate-300 hover:text-white"
              >
                ← অর্ডার এডিটে ফিরুন
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('card')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    activeTab === 'card' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  কার্ড
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    activeTab === 'preview' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  প্রিভিউ
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    activeTab === 'audit' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  অডিট লগ
                </button>
              </>
            )}

            <button
              onClick={() => setActiveOrderCardJob(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className={`${activeTab === 'canvas' ? 'p-0 overflow-hidden' : 'p-5 overflow-y-auto'} flex-1`}>
          {activeTab === 'canvas' && (
            <StudioEditorCanvas
              job={job}
              onClose={() => setActiveTab('edit')}
              onSave={(editedImageUrl, adjustments) => {
                const base64 = editedImageUrl.split(',')[1] || '';
                const fileBytes = Math.max(
                  0,
                  Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
                );
                const fileSize = fileBytes >= 1024 * 1024
                  ? `${(fileBytes / (1024 * 1024)).toFixed(2)} MB`
                  : `${Math.max(1, Math.round(fileBytes / 1024))} KB`;
                const fileName = `${job.fileName.replace(/\.[^/.]+$/, '')}-edited.jpg`;
                const aspectRatio = adjustments.cropPreset === 'free'
                  ? job.cropSettings?.aspectRatio || 'free'
                  : adjustments.cropPreset;
                const auditText = `Shopkeeper edited the image in Studio Canvas: crop=${adjustments.cropPreset}, rotation=${adjustments.rotation}°, zoom=${adjustments.zoom}.`;

                editJob(job.id, {
                  fileUrl: editedImageUrl,
                  fileName,
                  fileSize,
                  cropSettings: {
                    zoom: adjustments.zoom,
                    rotation: adjustments.rotation,
                    brightness: adjustments.brightness,
                    contrast: adjustments.contrast,
                    aspectRatio,
                  },
                }, auditText);
                setActiveTab('card');
              }}
            />
          )}

          {/* TAB 1: Main Order Card */}
          {activeTab === 'card' && (
            <div className="space-y-4">
              {/* Order Card Container */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono text-white">#{job.tokenCode}</span>
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatTimeAgo(job.createdAt)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                      ৳ {job.priceBDT}
                    </span>
                    <div className="text-[11px] font-medium text-emerald-400 flex items-center justify-end gap-1">
                      {job.paymentStatus === 'paid_mfs' ? 'পেইড ✅ (bKash/Nagad)' : 'কাউন্টার ক্যাশ ⏳'}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400 font-bold">
                      {job.counterId || 'CTR-01'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      উৎস: <strong className="text-slate-200">{job.counterName || 'কাউন্টার ১ - মূল সার্ভার'}</strong>
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">{job.serviceLabelBn}</h3>
                  <p className="text-xs text-slate-300">
                    {job.paperSize} × {job.copies} কপি · {job.colorMode === 'color' ? 'কালার' : 'সাদা-কালো'}
                    {job.gridCount ? ` · (${job.gridCount}-in-1 টাইল)` : ''}
                  </p>
                </div>

                {/* Printer Capability Match Info */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-slate-300 font-medium">প্রিন্টার: {job.targetPrinterName} (মূল সার্ভার হোস্ট)</span>
                      <span className="text-[10px] text-slate-500 block">{job.routingReason}</span>
                    </div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                {/* Thumbnail Preview Clickable Area */}
                <div
                  onClick={() => setActiveTab('preview')}
                  className="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60 h-44 flex items-center justify-center"
                >
                  {!hasFile ? (
                    <span className="text-sm text-slate-400">প্রিন্টের পর ফাইল মুছে ফেলা হয়েছে</span>
                  ) : isPdf ? (
                    <span className="text-sm font-semibold text-slate-300">PDF · {job.fileName}</span>
                  ) : (
                    <img
                      src={job.fileUrl}
                      alt={job.fileName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      style={{
                        transform: `rotate(${job.cropSettings?.rotation || 0}deg)`,
                        filter: `brightness(${job.cropSettings?.brightness || 100}%) contrast(${job.cropSettings?.contrast || 100}%)`,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 flex items-center justify-center transition-colors">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 text-xs font-medium text-white shadow-lg border border-slate-700">
                      <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                      Preview (বড় করুন)
                    </span>
                  </div>
                </div>

                {/* Ephemeral Privacy Notice */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>ফাইল স্বয়ংক্রিয় ডিলিট:</span>
                  <span className="font-mono text-amber-400 tabular-nums">
                    {Math.floor(job.autoDeleteCountdownSeconds / 60)} মি {job.autoDeleteCountdownSeconds % 60} সে
                  </span>
                </div>
              </div>

              {/* Action Buttons: [ Reject ] [ Edit ] [ Approve ] */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <button
                  onClick={() => setActiveTab('reject')}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-xs font-semibold text-slate-300 border border-slate-700 hover:border-rose-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reject</span>
                </button>

                <button
                  onClick={() => {
                    setEditCopies(job.copies);
                    setEditPaperSize(job.paperSize);
                    setEditColorMode(job.colorMode);
                    setEditPrinterId(
                      window.broxprintDesktop && windowsPrinters.includes(job.targetPrinterName)
                        ? `windows:${job.targetPrinterName}`
                        : job.targetPrinterId
                    );
                    setEditRotation(job.cropSettings?.rotation || 0);
                    setEditBrightness(job.cropSettings?.brightness || 100);
                    setEditContrast(job.cropSettings?.contrast || 100);
                    setEditGridCount(job.gridCount || 4);
                    setActiveTab('edit');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={handleApprove}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Full Image Preview */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{job.fileName} · {job.fileSize}</span>
                <button
                  onClick={() => setActiveTab('card')}
                  className="text-emerald-400 hover:underline"
                >
                  ← কার্ডে ফিরুন
                </button>
              </div>

              <div className="relative rounded-xl border border-slate-700 bg-black flex items-center justify-center p-3 min-h-[300px]">
                {!hasFile ? (
                  <p className="text-sm text-slate-400">প্রিন্টের পর গোপনীয়তার জন্য ফাইল মুছে ফেলা হয়েছে।</p>
                ) : isPdf ? (
                  <iframe title={job.fileName} src={job.fileUrl} className="w-full h-[65vh] rounded" />
                ) : (
                  <img
                    src={job.fileUrl}
                    alt={job.fileName}
                    referrerPolicy="no-referrer"
                    className="max-h-[360px] w-auto object-contain rounded shadow"
                    style={{
                      transform: `rotate(${job.cropSettings?.rotation || 0}deg)`,
                      filter: `brightness(${job.cropSettings?.brightness || 100}%) contrast(${job.cropSettings?.contrast || 100}%)`,
                    }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400">নিরাপত্তা ও গোপনীয়তা:</span>
                <span className="text-emerald-400 font-medium">
                  স্থানীয় প্রিন্ট কিউতে রাখা হয়; অর্ডারের ফাইল শেয়ার করবেন না
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: Edit Order */}
          {activeTab === 'edit' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="font-semibold text-slate-200">অর্ডার সমন্বয় ও পরিমার্জন (Shopkeeper Edit)</h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('canvas')}
                    disabled={isPdf || !hasFile}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-700/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    {isPdf ? 'PDF ক্যানভাসে সম্পাদনযোগ্য নয়' : hasFile ? 'ক্যানভাস এডিটর খুলুন' : 'প্রিন্ট করা ফাইল মুছে গেছে'}
                  </button>
                  <button
                    onClick={() => setActiveTab('card')}
                    className="text-slate-400 hover:text-white"
                  >
                    বাতিল
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Copies */}
                <div>
                  <label className="block text-slate-400 mb-1">কপি সংখ্যা</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditCopies(Math.max(1, editCopies - 1))}
                      className="w-8 h-8 rounded bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono text-base font-bold text-white px-2 tabular-nums">
                      {editCopies}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditCopies(editCopies + 1)}
                      className="w-8 h-8 rounded bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Color Mode */}
                <div>
                  <label className="block text-slate-400 mb-1">কালার মোড</label>
                  <select
                    value={editColorMode}
                    onChange={e => setEditColorMode(e.target.value as ColorMode)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-white text-xs"
                  >
                    <option value="color">কালার (Color)</option>
                    <option value="bw">সাদা-কালো (Black & White)</option>
                  </select>
                  {printerLoadError && <p role="alert" className="text-[11px] text-rose-300 mt-1">{printerLoadError}</p>}
                  {window.broxprintDesktop && windowsPrinters.length === 0 && !printerLoadError && (
                    <p className="text-[11px] text-amber-300 mt-1">এই Windows PC-তে কোনো প্রিন্টার পাওয়া যায়নি।</p>
                  )}
                </div>
              </div>

              {/* Paper Size */}
              <div>
                <label className="block text-slate-400 mb-1">পেপার সাইজ</label>
                <select
                  value={editPaperSize}
                  onChange={e => setEditPaperSize(e.target.value as PaperSize)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-white text-xs"
                >
                  <option value="4R (4x6 in)">4R (4x6 ইঞ্চি স্টুডিও ফটো)</option>
                  <option value="A4 (8.27x11.69 in)">A4 (সাধারণ পেপার)</option>
                  <option value="Passport Grid (4-in-1)">পাসপোর্ট সাইজ ৪ কপি শিট</option>
                  <option value="Passport Grid (8-in-1)">পাসপোর্ট সাইজ ৮ কপি শিট</option>
                  <option value="Stamp Size">স্ট্যাম্প সাইজ ছবি</option>
                </select>
              </div>

              {/* Override Printer */}
              <div>
                <label className="block text-slate-400 mb-1">প্রিন্টার নির্বাচন (Override)</label>
                <select
                  value={editPrinterId}
                  onChange={e => setEditPrinterId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-white text-xs"
                >
                  {windowsPrinters.length > 0 && (
                    <optgroup label="এই Windows PC-এর প্রিন্টার">
                      {windowsPrinters.map(name => (
                        <option key={name} value={`windows:${name}`}>{name}</option>
                      ))}
                    </optgroup>
                  )}
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.status === 'online' ? '🟢 অনলাইন' : '🔴 অফলাইন'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo Adjustments */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-3">
                <div className="font-medium text-slate-300 flex items-center justify-between">
                  <span>ছবি সমন্বয় (Basic Adjustment)</span>
                  <span className="text-[10px] text-slate-500">মূল কনটেন্ট সুরক্ষিত</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>উজ্জ্বলতা (Brightness)</span>
                      <span className="font-mono">{editBrightness}%</span>
                    </label>
                    <input
                      type="range"
                      min={60}
                      max={140}
                      value={editBrightness}
                      onChange={e => setEditBrightness(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>কন্ট্রাস্ট (Contrast)</span>
                      <span className="font-mono">{editContrast}%</span>
                    </label>
                    <input
                      type="range"
                      min={60}
                      max={140}
                      value={editContrast}
                      onChange={e => setEditContrast(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditRotation((editRotation + 90) % 360)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 border border-slate-700"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate (+90°)</span>
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono">কোণ: {editRotation}°</span>
                </div>
              </div>

              {/* Price Calculation alert */}
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-semibold">
                    সংশোধিত মোট বিল: ৳ {calculateRecalculatedPrice()} (পূর্বের বিল: ৳ {job.priceBDT})
                  </div>
                  <p className="text-[10px] text-amber-400/80 mt-0.5">
                    মূল্য পরিবর্তনের পর কাস্টমারের কাউন্টারে সম্মতি প্রয়োজন হতে পারে।
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow"
                >
                  পরিবর্তন সংরক্ষণ করুন
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Reject Order */}
          {activeTab === 'reject' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300">
                <h4 className="font-bold flex items-center gap-1.5 text-sm text-rose-200">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  অর্ডার বাতিল নিশ্চিতকরণ (Reject Order)
                </h4>
                <p className="text-[11px] text-rose-300/80 mt-1">
                  অর্ডার বাতিল করলে কাস্টমার কারণসহ নোটিফিকেশন পাবে। পেইড অর্ডার হলে অটোমেটিক রিফান্ড বা ওয়ালেট ক্রেডিট হবে।
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">বাতিলের কারণ নির্বাচন করুন:</label>
                <div className="space-y-1.5">
                  {[
                    { id: 'blurry_photo', label: 'ছবি অস্পষ্ট / লো-রেজোলিউশন (Blurry Photo)' },
                    { id: 'corrupted_file', label: 'ফাইল নষ্ট বা খোলা যাচ্ছে না (Corrupted File)' },
                    { id: 'invalid_size', label: 'সাইজ ও রেশিও মিলছে না (Invalid Aspect Ratio)' },
                    { id: 'printer_unavailable', label: 'প্রিন্টারে পেপার বা কালি শেষ / অফলাইন' },
                    { id: 'other', label: 'অন্যান্য কারণ (Other Reason)' },
                  ].map(reason => (
                    <label
                      key={reason.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedRejectReason === reason.id
                          ? 'bg-rose-950/40 border-rose-700 text-rose-200'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rejectReason"
                        checked={selectedRejectReason === reason.id}
                        onChange={() => setSelectedRejectReason(reason.id as RejectReason)}
                        className="accent-rose-500"
                      />
                      <span>{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">কাস্টমারের জন্য বার্তা (ঐচ্ছিক):</label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="যেমন: অনুগ্রহ করে ক্যামেরা আলোতে রেখে পুনরায় স্পষ্ট ছবি আপলোড করুন।"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium shadow"
                >
                  অর্ডার বাতিল করুন
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: Audit Log */}
          {activeTab === 'audit' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-400" />
                  অর্ডার অডিট লগ (Security & Audit Trail)
                </h4>
                <button onClick={() => setActiveTab('card')} className="text-emerald-400 hover:underline">
                  ← ফিরে যান
                </button>
              </div>

              <div className="space-y-2">
                {job.auditLogs.map(log => (
                  <div key={log.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-medium text-slate-300">
                        {log.actor === 'shopkeeper' ? 'দোকানদার (Operator)' : log.actor === 'customer' ? 'কাস্টমার (Mobile)' : 'সিস্টেম ইঞ্জিন (Agent)'}
                      </span>
                      <span className="font-mono tabular-nums">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-300 mt-1">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
