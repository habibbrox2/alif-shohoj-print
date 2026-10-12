import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useStudio } from '../../../shared/context/StudioContext';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { PrintJob, JobStatus } from '../../../shared/types';
import {
  Image,
  Upload,
  FolderOpen,
  X,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { StudioEditorCanvas } from '../../studio-editor/StudioEditorCanvas';
import { createJobId, nextTokenNumber } from '../../../shared/services/jobIdentity';
import { matchPrinterForJob } from '../../printers/printerRouting';

interface StudioImageSource {
  type: 'order' | 'local';
  job?: PrintJob;
  dataUrl?: string;
  fileName?: string;
  filePath?: string;
}

export const StudioPage: React.FC = () => {
  const { t } = useI18n();
  const {
    jobs,
    printers,
    activeCounterId,
    counters,
    pricing,
    services,
    appSettings,
    activeView,
    pendingStudioOrder,
    clearPendingStudioOrder,
  } = useStudio();

  const [activeTab, setActiveTab] = useState<'picker' | 'editor'>('picker');
  const [selectedSource, setSelectedSource] = useState<StudioImageSource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [editorJobId, setEditorJobId] = useState<string | null>(null);
  const [isWalkInJob, setIsWalkInJob] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jobsRef = useRef(jobs);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  // Auto-open pending studio order when Studio tab becomes active
  useEffect(() => {
    if (activeView === 'studio' && pendingStudioOrder) {
      // Find the job in current jobs list (might have been updated)
      const job = jobs.find(j => j.id === pendingStudioOrder.id);
      if (job) {
        handleOrderSelect(job);
      }
      clearPendingStudioOrder();
    }
  }, [activeView, pendingStudioOrder, jobs, clearPendingStudioOrder]);

  // Filter orders that have images (not PDFs)
  const imageJobs = jobs.filter((job: PrintJob) =>
    job.fileUrl &&
    !job.fileUrl.startsWith('data:application/pdf') &&
    !/\.pdf(?:$|[?#])/i.test(job.fileName)
  );

  const handleOrderSelect = useCallback((job: PrintJob) => {
    setSelectedSource({
      type: 'order',
      job,
      dataUrl: job.fileUrl,
      fileName: job.fileName,
    });
    setIsWalkInJob(false);
    setShowOrderPicker(false);
    setActiveTab('editor');
    setEditorJobId(job.id);
  }, []);

  const handleLocalFileSelect = useCallback(async () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      setError('অবৈধ ফাইল টাইপ। শুধু ছবি ফাইল (JPG, PNG, WebP, BMP, TIFF) গ্রহণযোগ্য।');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('ফাইল আকার খুব বড়। সর্বোচ্চ ৫০ MB অনুমোদিত।');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setSelectedSource({
        type: 'local',
        dataUrl,
        fileName: file.name,
      });
      setIsWalkInJob(true);
      setActiveTab('editor');
      setEditorJobId(null);
    } catch (err) {
      setError('ফাইল পড়তে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
      if (event.target) event.target.value = '';
    }
  }, []);

  const handleDesktopFileSelect = useCallback(async () => {
    const desktop = window.alifShohojPrintDesktop;
    if (!desktop) {
      setError('লোকাল ফাইল খুলতে Windows অ্যাপ্লিকেশন প্রয়োজন।');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await desktop.openFileDialog({
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result) {
        setSelectedSource({
          type: 'local',
          dataUrl: result.dataUrl,
          fileName: result.fileName,
          filePath: result.filePath,
        });
        setIsWalkInJob(true);
        setActiveTab('editor');
        setEditorJobId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ফাইল খুলতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleEditorSave = useCallback(async (editedImageUrl: string, adjustments: any) => {
    if (!selectedSource) return;

    if (selectedSource.type === 'order' && selectedSource.job) {
      // For order images, save back to the job via editJob
      // This is handled by StudioEditorCanvas via onSave -> OrderCardModal.editJob
      // Here we just close the editor
      setActiveTab('picker');
      setSelectedSource(null);
      setEditorJobId(null);
    } else if (selectedSource.type === 'local') {
      // For walk-in jobs, create a print job and send to queue
      await createWalkInJob(editedImageUrl, adjustments);
      setActiveTab('picker');
      setSelectedSource(null);
      setEditorJobId(null);
    }
  }, [selectedSource]);

  const createWalkInJob = async (editedImageUrl: string, adjustments: any) => {
    const base64 = editedImageUrl.split(',')[1] || '';
    const fileBytes = Math.max(
      0,
      Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
    );
    const fileSize = fileBytes >= 1024 * 1024
      ? `${(fileBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(1, Math.round(fileBytes / 1024))} KB`;

    const fileName = `${selectedSource?.fileName?.replace(/\.[^/.]+$/, '') || 'walkin'}-edited.jpg`;

    // Determine service type based on image or default
    const serviceType = 'photo_4r'; // Default to 4R photo for walk-in
    const studioService = services.find((s: any) => s.id === serviceType);
    const paperSize = studioService?.preferences.paperSize || '4R (4x6 in)';
    const colorMode = studioService?.preferences.color || 'color';

    // Auto-route printer
    const routing = matchPrinterForJob(serviceType, paperSize, colorMode, printers);
    const targetPrinterId = routing.printerId;
    const targetPrinterName = routing.printerName;

    const nextToken = nextTokenNumber(jobsRef.current.map(job => job.tokenCode), 0);
    const tokenCode = String(nextToken);
    const id = createJobId();

    const paperFinish = (studioService?.preferences.paperType === 'heavy_cardstock' ? 'glossy' : studioService?.preferences.paperType === 'plain' ? 'normal' : studioService?.preferences.paperType) || 'glossy';

    const walkInJob: PrintJob = {
      id,
      tokenCode,
      customerPhone: 'Walk-in',
      customerName: 'Walk-in Customer',
      serviceType,
      serviceLabel: studioService?.title || 'Walk-in Photo Print',
      serviceLabelBn: studioService?.titleBn || 'Walk-in Photo Print',
      paperSize,
      paperFinish,
      copies: 1,
      colorMode,
      status: 'queued' as JobStatus,
      targetPrinterId,
      targetPrinterName,
      routingReason: `Walk-in job: ${routing.reason}`,
      priceBDT: studioService?.basePriceBDT || 20,
      paymentMethod: 'counter_cash',
      paymentStatus: 'unpaid',
      fileUrl: editedImageUrl,
      fileName,
      fileSize,
      createdAt: Date.now(),
      autoDeleteCountdownSeconds: appSettings.retention.completedMinutes * 60,
      counterId: activeCounterId,
      counterName: counters.find((c: any) => c.id === activeCounterId)?.name || 'Studio',
      cropSettings: {
        zoom: adjustments.zoom,
        rotation: adjustments.rotation,
        brightness: adjustments.brightness,
        contrast: adjustments.contrast,
        aspectRatio: adjustments.cropPreset,
      },
      auditLogs: [
        {
          id: `log_${Date.now()}_create`,
          timestamp: Date.now(),
          actor: 'shopkeeper',
          action: 'walkin_created',
          details: `Walk-in job created from local file: ${selectedSource?.fileName || 'unknown'}`,
        },
      ],
    };

    // Save to desktop queue if available
    const desktop = window.alifShohojPrintDesktop;
    if (desktop) {
      try {
        await desktop.saveJob(walkInJob);
      } catch (err) {
        console.error('Failed to save walk-in job to desktop queue:', err);
      }
    }
  };

  const handleEditorClose = useCallback(() => {
    setActiveTab('picker');
    setSelectedSource(null);
    setEditorJobId(null);
  }, []);

  return (
    <div className="fluent-ui flex h-full flex-col bg-slate-900">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Image className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">স্টুডিও (Studio)</h2>
            <p className="text-xs text-slate-400">ছবি এডিট, ব্যাকগ্রাউন্ড রিমুভ ও প্রিন্ট</p>
          </div>
        </div>

        {activeTab === 'editor' && (
          <button
            onClick={handleEditorClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>পিকারে ফিরুন</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Tab 1: Image Picker */}
        {activeTab === 'picker' && (
          <div className="flex h-full flex-col p-5">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">ছবির উৎস নির্বাচন করুন</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Order Images Card */}
                <button
                  onClick={() => setShowOrderPicker(true)}
                  className="relative p-5 rounded-xl border-2 border-slate-700 bg-slate-950/80 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">অর্ডারের ছবি (Order Images)</h4>
                      <p className="text-xs text-slate-400">{imageJobs.length} টি অর্ডারের ছবি উপলব্ধ</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {imageJobs.slice(0, 6).map((job: PrintJob) => (
                      <div
                        key={job.id}
                        onClick={(e) => { e.stopPropagation(); handleOrderSelect(job); }}
                        className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer group-hover:ring-2 group-hover:ring-emerald-500 transition-all"
                      >
                        <img
                          src={job.fileUrl}
                          alt={job.fileName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/parent:opacity-100 transition-opacity">
                          <span className="text-xs text-white px-2 py-1 bg-emerald-600 rounded">নির্বাচন</span>
                        </div>
                        <div className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded truncate">
                          #{job.tokenCode}
                        </div>
                      </div>
                    ))}
                    {imageJobs.length > 6 && (
                      <div className="col-span-full md:col-span-2 flex items-center justify-center p-4 text-slate-400 text-xs border-t border-slate-800">
                        আরো {imageJobs.length - 6} টি ছবি... ক্লিক করুন দেখতে
                      </div>
                    )}
                  </div>
                </button>

                {/* Local File Card */}
                <button
                  onClick={handleDesktopFileSelect}
                  disabled={isLoading}
                  className="relative p-5 rounded-xl border-2 border-slate-700 bg-slate-950/80 hover:border-emerald-500/50 hover:bg-slate-900 transition-all flex flex-col items-center justify-center min-h-[280px] gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700 group-hover:border-emerald-500 transition-colors">
                    <FolderOpen className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <h4 className="font-semibold text-white">লোকাল ফাইল থেকে (Local File)</h4>
                    <p className="text-xs text-slate-400 mt-1">কম্পিউটার থেকে ছবি নির্বাচন করুন</p>
                    <p className="text-[10px] text-slate-500 mt-2">JPG, PNG, WebP, BMP, TIFF · সর্বোচ্চ ৫০ MB</p>
                  </div>
                  {isLoading && <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-slate-800 pt-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">দ্রুত অ্যাকশন</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleLocalFileSelect}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>ব্রাউজার থেকে ফাইল আপলোড</span>
                </button>
                <button
                  onClick={handleDesktopFileSelect}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Windows ফাইল ডায়ালগ খুলুন</span>
                </button>
              </div>
            </div>

            {/* Hidden file input for browser upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Tab 2: Editor */}
        {activeTab === 'editor' && selectedSource && (
          <StudioEditorCanvas
            initialImageUrl={selectedSource.dataUrl}
            job={selectedSource.job}
            onSave={handleEditorSave}
            onClose={handleEditorClose}
          />
        )}

        {/* Order Picker Modal */}
        {showOrderPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="fluent-ui w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-800/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-white">অর্ডারের ছবি নির্বাচন করুন</h3>
                </div>
                <button
                  onClick={() => setShowOrderPicker(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {imageJobs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p>কোনো অর্ডারের ছবি নেই।</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {imageJobs.map((job: PrintJob) => (
                      <button
                        key={job.id}
                        onClick={() => handleOrderSelect(job)}
                        className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-900 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500 transition-all group"
                      >
                        <img
                          src={job.fileUrl}
                          alt={job.fileName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-sm text-white px-3 py-1.5 bg-emerald-600 rounded">নির্বাচন</span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-[10px] font-mono text-emerald-400 truncate">#{job.tokenCode}</p>
                          <p className="text-[9px] text-slate-300 truncate">{job.serviceLabelBn}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-slate-700/60 bg-slate-800/80 flex justify-end">
                <button
                  onClick={() => setShowOrderPicker(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
                >
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};