import React, { useState } from 'react';
import { useStudio } from '../../shared/context/StudioContext';
import { capabilitiesRegistry } from '../printers/drivers/PrinterCapabilitiesRegistry';
import { ServiceType, PrinterDevice, PaperType, PrintQuality, ColorMode } from '../../shared/types';
import {
  Printer,
  Circle,
  Play,
  Sliders,
  Settings,
  ExternalLink,
  Minus,
  Square,
  X,
  FileText,
  Eye,
  RefreshCw,
  Plus,
  Trash2,
  Server,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertCircle,
  Search,
  Wifi,
  HardDrive,
  Cpu,
  Layers,
  ChevronRight,
  Maximize2,
  ShieldCheck,
  Zap,
  Scan,
  QrCode,
  Laptop,
  Monitor,
} from 'lucide-react';

export const WindowsAgentView: React.FC = () => {
  const {
    shopProfile,
    printers,
    togglePrinterStatus,
    refillPrinterPaper,
    refillPrinterInk,
    addNewPrinter,
    removePrinter,
    scanLocalPrinters,
    jobs,
    todayPrintedCount,
    pendingJobsCount,
    setActiveOrderCardJob,
    setActiveView,
    triggerTestPrint,
    services,
    toggleStudioService,
    updateStudioService,
    restartLocalServer,
    setIsExePackageModalOpen,
    counters,
    activeCounterId,
    setActiveCounterId,
    addCounter,
    updateCounter,
    deleteCounter,
    setSelectedPosterCounter,
    sharedScanners,
    triggerNetworkScan,
    setIsPosterModalOpen,
    createCustomerJob,
  } = useStudio();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeWindowTab, setActiveWindowTab] = useState<'console' | 'printers' | 'services' | 'counters' | 'server'>('console');

  // Scanner loading state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Remote Network Scanner state
  const [isRemoteScanning, setIsRemoteScanning] = useState(false);
  const [activeScanningScannerId, setActiveScanningScannerId] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<{ sampleUrl: string; dpi: number; scannerName: string } | null>(null);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  // Add Printer Modal
  const [isAddPrinterOpen, setIsAddPrinterOpen] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterBrand, setNewPrinterBrand] = useState<'HP' | 'Epson' | 'Canon' | 'Brother'>('Brother');
  const [newPrinterModel, setNewPrinterModel] = useState('');
  const [newPrinterType, setNewPrinterType] = useState<'laser_bw' | 'photo_inkjet' | 'color_inkjet'>('laser_bw');

  // Add Counter Modal
  const [isAddCounterOpen, setIsAddCounterOpen] = useState(false);
  const [newCounterName, setNewCounterName] = useState('');
  const [newCounterOperator, setNewCounterOperator] = useState('');
  const [newCounterIp, setNewCounterIp] = useState('');
  const [newCounterPrinterId, setNewCounterPrinterId] = useState('printer_hp_laserjet');

  const pendingJobs = jobs.filter(
    j => j.status === 'queued' || j.status === 'approved' || j.status === 'routing' || j.status === 'printing' || j.status === 'failed'
  );

  const handleScanPrinters = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      const addedCount = await scanLocalPrinters();
      setScanMessage(
        addedCount > 0
          ? `সফল! উইন্ডোজ স্পুলার স্ক্যান সম্পন্ন। ${addedCount}টি নতুন ডিভাইস তালিকাভুক্ত হয়েছে।`
          : 'স্ক্যান সম্পন্ন — নতুন ডিভাইস পাওয়া যায়নি, সব স্পুলারই ইতিমধ্যে তালিকাভুক্ত।'
      );
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanMessage(null), 3500);
    }
  };

  const handleCreatePrinter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrinterName) return;

    addNewPrinter({
      name: newPrinterName,
      brand: newPrinterBrand,
      model: newPrinterModel || `${newPrinterBrand} Universal Spooler`,
      type: newPrinterType,
      status: 'online',
      supportedPaperSizes: newPrinterType === 'laser_bw' ? ['A4 (8.27x11.69 in)', 'Legal'] : ['A4 (8.27x11.69 in)', '4R (4x6 in)'],
      colorCapability: newPrinterType === 'laser_bw' ? 'bw_only' : 'color',
      inkLevels: { black: 100, cyan: 100, magenta: 100, yellow: 100 },
      paperCount: 200,
      description: 'দোকানদারের ম্যানুয়ালি যুক্তকৃত উইন্ডোজ প্রিন্টার',
    });

    setIsAddPrinterOpen(false);
    setNewPrinterName('');
    setNewPrinterModel('');
  };

  const handleCreateCounter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCounterName) return;

    // Never derive the ID from counters.length (deletions cause duplicates) —
    // scan for the first unused CTR-NN slot instead.
    const usedIds = new Set(counters.map(counter => counter.id));
    let nextIndex = 1;
    while (usedIds.has(`CTR-${String(nextIndex).padStart(2, '0')}`)) nextIndex += 1;
    addCounter({
      id: `CTR-${String(nextIndex).padStart(2, '0')}`,
      code: `CTR-${nextIndex}`,
      name: newCounterName,
      operator: newCounterOperator || 'কাউন্টার সহকারী',
      ipAddress: newCounterIp || `192.168.1.${110 + nextIndex}`,
      status: 'active',
      isMasterHost: false,
      assignedServices: ['doc_a4', 'nid_card'],
      defaultPrinterId: newCounterPrinterId,
    });

    setIsAddCounterOpen(false);
    setNewCounterName('');
    setNewCounterOperator('');
    setNewCounterIp('');
  };

  const handleTriggerRemoteScan = async (scannerId: string) => {
    const scanner = sharedScanners.find(s => s.id === scannerId);
    if (!scanner) return;

    setIsRemoteScanning(true);
    setActiveScanningScannerId(scannerId);
    setScanSuccessMessage(null);

    try {
      const res = await triggerNetworkScan(scannerId, activeCounterId);
      setScannedResult({
        sampleUrl: res.sampleUrl,
        dpi: res.dpi,
        scannerName: scanner.name,
      });
      setScanSuccessMessage(`সফল! ${scanner.name} থেকে ল্যান স্ক্যান সম্পন্ন (${res.dpi} DPI)।`);
    } finally {
      setIsRemoteScanning(false);
      setActiveScanningScannerId(null);
      setTimeout(() => setScanSuccessMessage(null), 4000);
    }
  };

  const handleImportScannedToQueue = () => {
    if (!scannedResult) return;
    const activeCounter = counters.find(c => c.id === activeCounterId) || counters[0];

    createCustomerJob({
      tokenCode: '',
      customerPhone: '01711-000000',
      customerName: 'ল্যান স্ক্যানার থেকে সরাসরি',
      serviceType: 'nid_card',
      serviceLabel: 'NID SCAN & PRINT',
      serviceLabelBn: 'এনআইডি স্ক্যান কপি (ল্যান)',
      paperSize: 'A4 (8.27x11.69 in)',
      paperFinish: 'normal',
      copies: 1,
      colorMode: 'color',
      priceBDT: 30,
      paymentMethod: 'counter_cash',
      paymentStatus: 'paid_counter',
      fileUrl: scannedResult.sampleUrl,
      fileName: `scanned_${Date.now().toString().slice(-4)}.jpg`,
      fileSize: '3.2 MB',
      counterId: activeCounter.id,
      counterName: activeCounter.name,
    });

    setScannedResult(null);
    setScanSuccessMessage('স্ক্যানকৃত ফাইল সফলভাবে কাউন্টার প্রিন্ট কিউতে যুক্ত হয়েছে!');
    setTimeout(() => setScanSuccessMessage(null), 3500);
  };

  const STUDIO_SERVICES_LIST: { id: ServiceType; label: string; desc: string; defaultType: string }[] = [
    {
      id: 'passport_photo',
      label: 'পাসপোর্ট ছবি প্রিন্ট (৪ বা ৮ কপি শিট)',
      desc: 'স্টুডিও কোয়ালিটি ল্যাব পাসপোর্ট ছবি ও ভেরিফিকেশন',
      defaultType: 'photo_inkjet',
    },
    {
      id: 'stamp_photo',
      label: 'স্ট্যাম্প সাইজ ছবি প্রিন্ট',
      desc: 'অফিসিয়াল স্ট্যাম্প ও অ্যাপ্লিকেশন ফরম ছবি',
      defaultType: 'photo_inkjet',
    },
    {
      id: 'nid_card',
      label: 'এনআইডি / স্মার্ট কার্ড কপি (ল্যামিনেট)',
      desc: 'জাতীয় পরিচয়পত্র ও স্মার্ট কার্ডের উভয় পিঠ প্রিন্ট',
      defaultType: 'laser_bw',
    },
    {
      id: 'photo_4r',
      label: '৪-আর ল্যাব ফটো প্রিন্ট (৪×৬ ইঞ্চি)',
      desc: 'হাই-গ্লসি ফটো পেপারে পারিবারিক ও অ্যালবাম প্রিন্ট',
      defaultType: 'photo_inkjet',
    },
    {
      id: 'doc_a4',
      label: 'A4 ডকুমেন্ট ও অনলাইন আবেদনপত্র',
      desc: 'পরীক্ষার প্রবেশপত্র, চালান, ফরম ও সাধারণ PDF ফাইল',
      defaultType: 'laser_bw',
    },
  ];

  return (
    <div className={`fluent-ui mx-auto p-2 sm:p-4 transition-all duration-200 ${isMaximized ? 'max-w-full' : 'max-w-5xl'}`}>
      {/* Real Windows 11/10 Application Frame */}
      <div
        className={`bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/95 overflow-hidden transition-all duration-200 ${
          isMinimized ? 'opacity-40 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
      >
        {/* Native Windows Window Titlebar */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              BP
            </div>
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span>ALIF SHOHOJ PRINT 2026</span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400 font-mono">[{shopProfile.code}]</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 text-[11px] font-normal">লোকাল প্রিন্ট সার্ভার এজেন্ট</span>
            </span>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
              title="Minimize to System Tray"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
              title={isMaximized ? 'Restore Down' : 'Maximize'}
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-rose-600 text-slate-400 hover:text-white rounded transition-colors"
              title="Close to Tray"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Native Windows Menu Bar */}
        <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap border-b border-slate-800 bg-slate-900/90 px-3 py-1 text-xs text-slate-300 select-none">
          <div className="relative shrink-0 cursor-pointer group hover:text-white py-0.5">
            <span>ফাইল (File)</span>
          </div>
          <div
            onClick={handleScanPrinters}
            className="flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap py-0.5 hover:text-emerald-400"
          >
            <span>প্রিন্টার স্ক্যান (Scan)</span>
          </div>
          <div
            onClick={() => setActiveWindowTab('services')}
            className="shrink-0 cursor-pointer whitespace-nowrap py-0.5 hover:text-emerald-400"
          >
            <span>সার্ভিস ম্যানেজার (Services)</span>
          </div>
          <div
            onClick={() => setActiveWindowTab('counters')}
            className="flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap py-0.5 hover:text-emerald-400"
          >
            <span>ল্যান কাউন্টার (Counters)</span>
          </div>
          <div
            onClick={() => setActiveWindowTab('server')}
            className="shrink-0 cursor-pointer whitespace-nowrap py-0.5 hover:text-emerald-400"
          >
            <span>লোকাল সার্ভার (Server)</span>
          </div>
          <div
            onClick={() => setIsExePackageModalOpen(true)}
            className="shrink-0 cursor-pointer whitespace-nowrap py-0.5 hover:text-emerald-400"
          >
            <span>সাহায্য ও ড্রাইভার (Help)</span>
          </div>
        </div>

        {/* Windows App View Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-slate-800 bg-slate-950/70 px-4 pt-3 text-xs">
          <button
            onClick={() => setActiveWindowTab('console')}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 font-semibold transition-colors ${
              activeWindowTab === 'console'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>কনসোল ড্যাশবোর্ড</span>
          </button>

          <button
            onClick={() => setActiveWindowTab('printers')}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 font-semibold transition-colors ${
              activeWindowTab === 'printers'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>সকল প্রিন্টার ({printers.length})</span>
          </button>

          <button
            onClick={() => setActiveWindowTab('services')}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 font-semibold transition-colors ${
              activeWindowTab === 'services'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>সার্ভিস চালুবন্ধ নিয়ন্ত্রণ</span>
          </button>

          <button
            onClick={() => setActiveWindowTab('counters')}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 font-semibold transition-colors ${
              activeWindowTab === 'counters'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>ল্যান কাউন্টার ও শেয়ারিং ({counters.length})</span>
          </button>

          <button
            onClick={() => setActiveWindowTab('server')}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 font-semibold transition-colors ${
              activeWindowTab === 'server'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>লোকাল সার্ভার স্ট্যাটাস</span>
          </button>
        </div>

        {/* TAB 1: Console / Main Agent Status */}
        {activeWindowTab === 'console' && (
          <div className="p-5 space-y-6">
            {/* Header Status Bar matching user specification */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                  <span className="text-sm font-bold text-emerald-400">🟢 Connected (অনলাইন)</span>
                  <span className="text-[11px] text-slate-500 font-mono">· WSS Latency: 32ms</span>
                </div>
                <div className="text-xs text-slate-300">
                  <span className="font-semibold">দোকান: {shopProfile.name}</span>
                  <span className="text-slate-500 mx-1.5">|</span>
                  <span className="text-slate-400">Shop Code: </span>
                  <span className="font-mono text-emerald-400 font-semibold">{shopProfile.code}</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-6 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">পেন্ডিং জবস (Pending Jobs)</span>
                  <span className="text-xl font-bold font-mono text-white tabular-nums">
                    {pendingJobsCount}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">আজকের প্রিন্ট (Today Printed)</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                    {todayPrintedCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Printers Fleet Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>কানেক্টেড প্রিন্টার সমূহ (Connected Printers)</span>
                </h3>
                <button
                  onClick={() => setActiveWindowTab('printers')}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>সকল প্রিন্টার ও কনফিগারেশন দেখুন</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {printers.slice(0, 3).map(printer => {
                  const isOnline = printer.status === 'online';
                  const caps = capabilitiesRegistry.getCapabilitiesForDevice(printer);
                  return (
                    <div
                      key={printer.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isOnline
                          ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/40 border-rose-950/50 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-white">{printer.name}</h4>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{printer.model}</span>
                        </div>
                        <button
                          onClick={() => togglePrinterStatus(printer.id)}
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                            isOnline
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          <Circle className={`w-2 h-2 ${isOnline ? 'fill-emerald-400' : 'fill-rose-400'}`} />
                          <span>{isOnline ? 'Online' : 'Offline'}</span>
                        </button>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{caps.protocol}</span>
                        <span>{Math.max(...caps.dpiOptions)} DPI</span>
                        <span className="text-slate-200">{printer.paperCount} শিট</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Pending Queue */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>লাইভ প্রিন্ট কিউ (Pending Spool Queue)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  অর্ডারে ক্লিক করে কার্ড ও প্রিভিউ দেখুন
                </span>
              </div>

              <div className="divide-y divide-slate-800 rounded-xl bg-slate-950/70 border border-slate-800 overflow-hidden">
                {pendingJobs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    কোনো পেন্ডিং অর্ডার নেই। নতুন অর্ডার এলে সরাসরি এখানে যুক্ত হবে।
                  </div>
                ) : (
                  pendingJobs.map(job => (
                    <div
                      key={job.id}
                      onClick={() => setActiveOrderCardJob(job)}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-900/60 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-sm text-emerald-400">
                          #{job.tokenCode}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{job.serviceLabelBn}</span>
                            <span className="text-[11px] text-slate-400">· {job.paperSize}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>প্রিন্টার: {job.targetPrinterName.split(' ')[0]}</span>
                            <span>·</span>
                            <span className="text-emerald-400">৳ {job.priceBDT}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setActiveOrderCardJob(job);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="কার্ড খুলুন"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dashboard Bottom Navigation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => setActiveView('shop_pos')}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <span>[ Open Dashboard ]</span>
              </button>

              <button
                onClick={() => setActiveWindowTab('printers')}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition-colors"
              >
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>[ Printer Settings ]</span>
              </button>

              <button
                onClick={() => setActiveWindowTab('services')}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition-colors"
              >
                <Settings className="w-4 h-4 text-emerald-400" />
                <span>[ Shop Settings ]</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: All Printers Management (কম্পিউটারে থাকা সকল প্রিন্টার) */}
        {activeWindowTab === 'printers' && (
          <div className="p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">কম্পিউটারে সংযুক্ত সকল প্রিন্টার ডিভাইস</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  উইন্ডোজ স্পুলারে থাকা যেকোনো প্রিন্টার সিলেক্ট করে টেস্ট প্রিন্ট বা সার্ভিস ম্যাপ করুন
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleScanPrinters}
                  disabled={isScanning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'স্ক্যান হচ্ছে…' : 'উইন্ডোজ প্রিন্টার স্ক্যান'}</span>
                </button>

                <button
                  onClick={() => setIsAddPrinterOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন প্রিন্টার যোগ করুন</span>
                </button>
              </div>
            </div>

            {scanMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{scanMessage}</span>
              </div>
            )}

            {/* List of All Printers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {printers.map(printer => {
                const isOnline = printer.status === 'online';
                const caps = capabilitiesRegistry.getCapabilitiesForDevice(printer);
                return (
                  <div
                    key={printer.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{printer.name}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
                            {caps.protocol}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 block mt-0.5">{printer.model}</span>
                      </div>

                      <button
                        onClick={() => togglePrinterStatus(printer.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          isOnline
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        <Circle className={`w-2 h-2 ${isOnline ? 'fill-emerald-400' : 'fill-rose-400'}`} />
                        <span>{isOnline ? 'Online' : 'Offline'}</span>
                      </button>
                    </div>

                    {/* Capabilities row */}
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>সাপোর্টেড পেপার:</span>
                        <span className="text-slate-200 font-mono">
                          {printer.supportedPaperSizes.join(', ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>ম্যাক্সিমাম রেজোলিউশন:</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {Math.max(...caps.dpiOptions)} DPI
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>বর্ডারলেস ফটো সাপোর্ট:</span>
                        <span className="text-slate-200">
                          {caps.borderlessSupported ? 'সক্ষম ✅' : 'না (মার্জিন আবশ্যক)'}
                        </span>
                      </div>
                    </div>

                    {/* Ink & Paper stats */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                      <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                        <span>পেপার ট্রে:</span>
                        <span className="font-mono text-white font-bold">{printer.paperCount} শিট</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                        <span>কালি লেভেল:</span>
                        <span className="font-mono text-emerald-400 font-bold">{printer.inkLevels.black}%</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => triggerTestPrint(printer.id)}
                          disabled={!isOnline}
                          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Test Print</span>
                        </button>
                        <button
                          onClick={() => refillPrinterPaper(printer.id)}
                          className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition-colors"
                        >
                          + পেপার রিফিল
                        </button>
                      </div>

                      {printers.length > 1 && (
                        <button
                          onClick={() => removePrinter(printer.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition-colors"
                          title="তালিকা থেকে সরান"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Service On/Off Manager (দোকানের মালিক সেটিং থেকে যে কোন সার্ভিস চালুবন্ধ করতে পারবে) */}
        {activeWindowTab === 'services' && (
          <div className="p-5 space-y-5">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">স্টুডিও সার্ভিস সক্রিয় / নিষ্ক্রিয়করণ ম্যানেজার</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                যেকোনো সার্ভিস সাময়িকভাবে বন্ধ করতে টগল করুন। বন্ধ থাকা সার্ভিস গ্রাহকের মোবাইল PWA-তে অর্ডার করা যাবে না।
              </p>
            </div>

            <div className="space-y-3">
              {STUDIO_SERVICES_LIST.map(service => {
                const studio = services.find(s => s.id === service.id);
                const isEnabled = studio ? studio.enabled : true;
                const isAutoApprove = studio ? studio.autoApprove : false;
                const assignedPrinterId = studio?.preferredPrinterId;
                return (
                  <div
                    key={service.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isEnabled
                        ? 'bg-slate-950 border-slate-800'
                        : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{service.label}</h4>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              isEnabled
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {isEnabled ? 'চালু আছে' : 'বন্ধ'}
                          </span>

                          {isEnabled && (
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                                isAutoApprove
                                  ? 'bg-amber-950/90 text-amber-300 border border-amber-700/80'
                                  : 'bg-slate-900 text-slate-300 border border-slate-700'
                              }`}
                            >
                              <Zap className={`w-3 h-3 ${isAutoApprove ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                              <span>{isAutoApprove ? 'অটো-অ্যাপ্রুভ (Auto-Approve)' : 'ম্যানুয়াল রিভিউ (Manual Review)'}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{service.desc}</p>
                      </div>

                      {/* Action Buttons: Toggle Status & Toggle Auto-Approve */}
                      <div className="flex items-center gap-2">
                        {/* Service-level Auto-Approve Toggle */}
                        <button
                          onClick={() => updateStudioService(service.id, { autoApprove: !isAutoApprove })}
                          disabled={!isEnabled}
                          title={
                            isAutoApprove
                              ? 'অটো-অ্যাপ্রুভ সক্রিয়: কাস্টমার অর্ডার করামাত্র সরাসরি প্রিন্টার স্পুলারে চলে যাবে।'
                              : 'ম্যানুয়াল মোড: দোকানদার কার্ডে Approve চাপলে তবেই প্রিন্ট হবে।'
                          }
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${
                            isAutoApprove
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'
                          }`}
                        >
                          <Zap className={`w-3.5 h-3.5 ${isAutoApprove ? 'text-amber-400' : 'text-slate-500'}`} />
                          <span>{isAutoApprove ? 'অটো-অ্যাপ্রুভ চালু ⚡' : 'অটো-অ্যাপ্রুভ বন্ধ'}</span>
                        </button>

                        {/* On/Off Toggle Button */}
                        <button
                          onClick={() => toggleStudioService(service.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isEnabled
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {isEnabled ? 'সার্ভিস চালু' : 'সার্ভিস বন্ধ'}
                        </button>
                      </div>
                    </div>

                    {/* Printer Assignment Dropdown for this service */}
                    <div className="mt-3 pt-3 border-t border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400">এই সার্ভিসের জন্য নির্ধারিত ডিফল্ট প্রিন্টার:</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={assignedPrinterId || ''}
                          onChange={e => updateStudioService(service.id, { preferredPrinterId: e.target.value })}
                          className="bg-slate-900 border border-slate-700 rounded-lg py-1 px-3 text-white text-xs"
                        >
                          {printers.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.status === 'online' ? '🟢 অনলাইন' : '🔴 অফলাইন'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {studio && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <label className="text-slate-400">
                          Paper type
                          <select
                            value={studio.preferences.paperType}
                            onChange={event => updateStudioService(service.id, {
                              preferences: { ...studio.preferences, paperType: event.target.value as PaperType },
                            })}
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-white"
                          >
                            <option value="plain">Plain</option>
                            <option value="glossy">Glossy</option>
                            <option value="matte">Matte</option>
                            <option value="laminated">Laminated</option>
                            <option value="heavy_cardstock">Heavy cardstock</option>
                          </select>
                        </label>
                        <label className="text-slate-400">
                          Quality
                          <select
                            value={studio.preferences.quality}
                            onChange={event => updateStudioService(service.id, {
                              preferences: { ...studio.preferences, quality: event.target.value as PrintQuality },
                            })}
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-white"
                          >
                            <option value="draft">Draft</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="ultra_fine">Ultra fine</option>
                          </select>
                        </label>
                        <label className="text-slate-400">
                          Default color
                          <select
                            value={studio.preferences.color}
                            onChange={event => updateStudioService(service.id, {
                              preferences: { ...studio.preferences, color: event.target.value as ColorMode },
                            })}
                            className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-white"
                          >
                            <option value="color">Color</option>
                            <option value="bw">Black &amp; white</option>
                          </select>
                        </label>
                        <p className="sm:col-span-3 text-[10px] text-amber-300">
                          Silent printing applies color, paper size and copies. Paper type, quality, DPI and borderless behavior depend on the installed Windows printer driver.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: LAN Counters & Shared Hardware Architecture (একই ওয়াইফাই/ল্যানে একাধিক কাউন্টার) */}
        {activeWindowTab === 'counters' && (
          <div className="p-5 space-y-6">
            {/* Top Bar with actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>দোকানের ওয়াইফাই/ল্যান কাউন্টার ও শেয়ার্ড হার্ডওয়্যার হাব</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                    Zero-Config LAN
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  একই WiFi/LAN-এ একাধিক কম্পিউটার কাউন্টার হিসেবে ব্যবহার করুন এবং মূল পিসির প্রিন্টার/স্ক্যানার লিঙ্ক করুন।
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddCounterOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন কাউন্টার যোগ করুন</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPosterCounter(null);
                    setIsPosterModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>কাউন্টার QR স্ট্যান্ড প্রিন্ট</span>
                </button>
              </div>
            </div>

            {/* Current PC Role & Terminal Switcher Banner */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">মূল প্রিন্ট ও স্ক্যান সার্ভার হোস্ট (Host Master PC)</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700 font-mono">
                        192.168.1.105:3000
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      সকল শারীরিক USB প্রিন্টার ও স্ক্যানার এই পিসিতে সংযুক্ত এবং ল্যানে শেয়ারকৃত।
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400">
                  <span className="text-slate-500 font-mono">ল্যান সাবনেট: 192.168.1.0/24</span>
                  <div className="text-emerald-400 font-medium">mDNS ব্রডকাস্ট সচল</div>
                </div>
              </div>

              {/* Active Counter Terminal Switcher */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium text-[11px]">বর্তমানে অপারেট করছেন:</span>
                {counters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCounterId(c.id)}
                    className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                      activeCounterId === c.id
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {c.isMasterHost ? <Monitor className="w-3 h-3 text-amber-300" /> : <Laptop className="w-3 h-3 text-slate-400" />}
                    <span>{c.code}: {c.name.split('-')[1]?.trim() || c.name}</span>
                    {activeCounterId === c.id && <span className="text-[10px] text-emerald-200">● অ্যাক্টিভ</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Counter Fleet List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ওয়াইফাই/ল্যান সংযুক্ত কাউন্টারসমূহ ({counters.length} টি পিসি)</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  প্রতিটি কাউন্টারের জন্য স্বতন্ত্র QR কোড
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {counters.map(counter => {
                  const linkedPrinter = printers.find(p => p.id === counter.defaultPrinterId);
                  const isCurrent = activeCounterId === counter.id;

                  return (
                    <div
                      key={counter.id}
                      className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-slate-900/90 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Counter Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">{counter.name}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              অপারেটর: <strong className="text-slate-200">{counter.operator}</strong>
                            </span>
                          </div>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 font-bold shrink-0">
                            {counter.code}
                          </span>
                        </div>

                        {/* Network & Hardware Link Badges */}
                        <div className="space-y-1 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-slate-400">LAN IP: {counter.ipAddress}</span>
                            <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                              2ms LAN
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                            <span className="text-slate-400">ডিফল্ট প্রিন্টার:</span>
                            <span className="text-white font-medium truncate max-w-[140px]">
                              {linkedPrinter?.name || 'HP LaserJet'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 font-mono">
                            <span className="text-slate-400">আজকের অর্ডার / আয়:</span>
                            <span className="text-emerald-400 font-bold">
                              {counter.todayOrdersCount} টি · ৳ {counter.todayEarningsBDT}
                            </span>
                          </div>
                        </div>

                        {/* Assigned Services Pills */}
                        <div className="flex flex-wrap gap-1">
                          {counter.assignedServices.map(srv => (
                            <span
                              key={srv}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono"
                            >
                              {srv === 'doc_a4' ? 'A4 ডক' : srv === 'nid_card' ? 'এনআইডি' : srv === 'passport_photo' ? 'পাসপোর্ট' : srv}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setSelectedPosterCounter(counter);
                            setIsPosterModalOpen(true);
                          }}
                          className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium py-1 px-2 rounded hover:bg-slate-800 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR স্ট্যান্ড</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {!isCurrent && (
                            <button
                              onClick={() => setActiveCounterId(counter.id)}
                              className="text-[11px] text-slate-300 hover:text-white py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                            >
                              সক্রিয় করুন
                            </button>
                          )}
                          {!counter.isMasterHost && (
                            <button
                              onClick={() => deleteCounter(counter.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                              title="কাউন্টার মুছুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shared Hardware Hub Section (মূল পিসির প্রিন্টার ও স্ক্যানার শেয়ার) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Box 1: Shared Network Printers */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      মূল সার্ভারে শেয়ার্ড প্রিন্টার স্পুলার
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Port 9100 / IPP Active</span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  দোকানের সকল কাউন্টার পিসি সরাসরি নিচের প্রিন্টারগুলোতে নেটওয়ার্কের মাধ্যমে প্রিন্ট পাঠায়।
                </p>

                <div className="space-y-2">
                  {printers.map(p => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <div>
                          <div className="font-semibold text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ড্রাইভার: {p.brand} {p.model} · পেপার: {p.paperCount} শিট
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                          ল্যান লিঙ্কড 🟢
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 2: Shared Network Flatbed Scanners (মূল পিসির স্ক্যানার শেয়ার) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Scan className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      মূল সার্ভারে শেয়ার্ড নেটওয়ার্ক স্ক্যানার
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">TWAIN/WIA over LAN</span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  যেকোনো কাউন্টার পিসি থেকে মূল সার্ভারের স্ক্যানার চালু করে সরাসরি এনআইডি ও ছবি ক্যাপচার করুন।
                </p>

                {/* Scan Feedback Banner */}
                {scanSuccessMessage && (
                  <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{scanSuccessMessage}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  {sharedScanners.map(scanner => {
                    const isScanningThis = isRemoteScanning && activeScanningScannerId === scanner.id;

                    return (
                      <div
                        key={scanner.id}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${scanner.status === 'ready' ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
                            <div>
                              <div className="font-semibold text-white">{scanner.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {scanner.connectedToHost} · Max {scanner.maxDpi} DPI
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleTriggerRemoteScan(scanner.id)}
                            disabled={isRemoteScanning}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isScanningThis
                                ? 'bg-amber-600 text-white animate-pulse'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            } disabled:opacity-50`}
                          >
                            <Scan className="w-3.5 h-3.5" />
                            <span>{isScanningThis ? 'স্ক্যান হচ্ছে…' : 'রিমোট স্ক্যান টেস্ট'}</span>
                          </button>
                        </div>

                        {/* Optical scanning light progress bar animation */}
                        {isScanningThis && (
                          <div className="pt-1 space-y-1">
                            <div className="text-[10px] text-amber-300 font-mono flex items-center justify-between">
                              <span>ফ্ল্যাটবেড অপটিক্যাল সেন্সর রিডিং...</span>
                              <span>600 DPI High-Speed</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 animate-pulse w-full"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Scanned Sample Result Modal / Card */}
                {scannedResult && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/50 space-y-2 text-xs animate-in zoom-in-95">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>স্ক্যান প্রিভিউ প্রস্তুত ({scannedResult.scannerName})</span>
                      </span>
                      <button
                        onClick={() => setScannedResult(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <img
                        src={scannedResult.sampleUrl}
                        alt="Scanned sample"
                        className="w-16 h-12 object-cover rounded border border-slate-700 shadow"
                      />
                      <div className="space-y-0.5 text-[11px] text-slate-300">
                        <div>রেজোলিউশন: <strong className="text-white">{scannedResult.dpi} DPI</strong></div>
                        <div className="text-slate-400">উৎস: মূল সার্ভার ফ্ল্যাটবেড স্ক্যানার</div>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-end gap-2">
                      <button
                        onClick={handleImportScannedToQueue}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>কাউন্টার প্রিন্ট কিউতে যোগ করুন</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Zero-Config LAN Instructions */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>ওয়াইফাই/ল্যানে একাধিক পিসি যুক্ত করার ৩-ধাপের নিয়ম:</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-semibold text-emerald-400">ধাপ ১: মূল সার্ভার চালু রাখুন</div>
                  <p className="text-slate-400">
                    মূল পিসিতে ALIF SHOHOJ PRINT ওপেন রাখুন (IP: {shopProfile.localServer.localIp})। প্রিন্টার ও স্ক্যানারের USB কেবল এই পিসিতে থাকবে।
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-semibold text-emerald-400">ধাপ ২: কাউন্টার পিসি থেকে ব্রাউজ করুন</div>
                  <p className="text-slate-400">
                    দোকানের অন্য পিসিগুলো একই ওয়াইফাইয়ে যুক্ত করে ব্রাউজারে খুলুন: <code>http://{shopProfile.localServer.localIp}:3000</code>
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="font-semibold text-emerald-400">ধাপ ৩: ডেস্কে QR স্ট্যান্ড লাগান</div>
                  <p className="text-slate-400">
                    প্রতিটি কাউন্টার টেবিলের জন্য আলাদা QR স্ট্যান্ড প্রিন্ট করে রাখুন। গ্রাহক যে ডেস্কে স্ক্যান করবে, অর্ডারটি সরাসরি সেই কাউন্টারে রুট হবে।
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Embedded Local Server Status (উইন্ডোজ এক্সসি ফাইলটি দিয়ে পুরো সিস্টেম বা সার্ভারটি চালাতে পারবে) */}
        {activeWindowTab === 'server' && (
          <div className="p-5 space-y-5">
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">এমবেডেড লোকাল ওয়েব ও প্রিন্ট স্পুলার সার্ভার</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ALIF SHOHOJ PRINT.exe নিজেই একটি স্বয়ংক্রিয় লোকাল সার্ভার হিসেবে চলে
                </p>
              </div>

              <button
                onClick={restartLocalServer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>সার্ভার রিস্টার্ট করুন</span>
              </button>
            </div>

            {/* Server Specs & Endpoints */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-mono">
                  সার্ভার স্ট্যাটাস
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      shopProfile.localServer.status === 'running'
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-base font-bold text-white capitalize">
                    {shopProfile.localServer.status === 'running' ? 'সক্রিয় (Running)' : 'রিস্টার্ট হচ্ছে…'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  আপটাইম: {Math.floor(shopProfile.localServer.uptimeSeconds / 3600)} ঘণ্টা{' '}
                  {Math.floor((shopProfile.localServer.uptimeSeconds % 3600) / 60)} মিনিট
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-mono">
                  লোকাল নেটওয়ার্ক আইপি ও পোর্ট
                </span>
                <span className="text-base font-bold font-mono text-emerald-400 block mt-1">
                  http://{shopProfile.localServer.localIp}:{shopProfile.localServer.port}
                </span>
                <span className="text-[11px] text-slate-500">দোকানের ওয়াই-ফাই রাউটারে ব্রডকাস্টেড</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-mono">
                  কানেক্টেড ক্লায়েন্ট
                </span>
                <span className="text-base font-bold font-mono text-white block mt-1">
                  {shopProfile.localServer.connectedClients} টি ডিভাইস (কাস্টমার ও কাউন্টার)
                </span>
                <span className="text-[11px] text-slate-500">লোকাল স্পুলিং বাফার অ্যাক্টিভ</span>
              </div>
            </div>

            {/* Offline Local Queue Spooler Info */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>অফলাইন মোড ও লোকাল ডিস্ক ক্যাশ (Offline Spool Guarantee)</span>
              </h4>
              <p className="text-slate-300 leading-relaxed">
                দোকানের ইন্টারনেট চলে গেলেও আপনার উইন্ডোজ পিসির লোকাল ডিরেক্টরি <code>./local_queue_cache/</code> এ সমস্ত জব সাময়িকভাবে জমা থাকে। প্রিন্টারগুলো অফলাইনেও প্রিন্ট চালিয়ে যায় এবং ইন্টারনেট ফিরে এলে সেন্ট্রাল ক্লাউডে সিঙ্ক হয়।
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Simulated Windows Taskbar with System Tray */}
      <div className="mt-3 p-2.5 bg-slate-950/90 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <div className="w-3.5 h-3.5 rounded bg-emerald-600 flex items-center justify-center text-[8px] font-bold text-white">
              BP
            </div>
            <span>Windows 11 Background Daemon Active</span>
          </div>
          {isMinimized && (
            <button
              onClick={() => setIsMinimized(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold"
            >
              <RefreshCw className="w-3 h-3" />
              <span>উইন্ডো রিস্টোর করুন</span>
            </button>
          )}
        </div>

        {/* Tray Icon with Red Badge */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setIsMinimized(false)}
            className="relative cursor-pointer p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
            title="ALIF SHOHOJ PRINT Agent in Tray"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            {pendingJobsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow tabular-nums">
                {pendingJobsCount}
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-slate-400">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Add Printer Modal Dialog */}
      {isAddPrinterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white">নতুন প্রিন্টার যোগ করুন</h3>
              <button
                onClick={() => setIsAddPrinterOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePrinter} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">প্রিন্টারের নাম</label>
                <input
                  type="text"
                  required
                  value={newPrinterName}
                  onChange={e => setNewPrinterName(e.target.value)}
                  placeholder="যেমন: Brother DCP-T720DW"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">ব্র্যান্ড</label>
                  <select
                    value={newPrinterBrand}
                    onChange={e => setNewPrinterBrand(e.target.value as 'HP' | 'Epson' | 'Canon' | 'Brother')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="HP">HP</option>
                    <option value="Epson">Epson</option>
                    <option value="Canon">Canon</option>
                    <option value="Brother">Brother</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">প্রিন্টার টাইপ</label>
                  <select
                    value={newPrinterType}
                    onChange={e => setNewPrinterType(e.target.value as 'laser_bw' | 'photo_inkjet' | 'color_inkjet')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="laser_bw">লেজার মনোক্রোম (Laser B&W)</option>
                    <option value="photo_inkjet">ফটো ইঙ্কজেট (Photo Inkjet)</option>
                    <option value="color_inkjet">কালার ইঙ্কট্যাঙ্ক (Color InkTank)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">মডেল বা ড্রাইভার স্ট্রিং</label>
                <input
                  type="text"
                  value={newPrinterModel}
                  onChange={e => setNewPrinterModel(e.target.value)}
                  placeholder="যেমন: Wireless Duplex All-in-One"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPrinterOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  প্রিন্টার যুক্ত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add LAN Counter PC Modal Dialog */}
      {isAddCounterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>নতুন ওয়াইফাই/ল্যান কাউন্টার পিসি যুক্ত করুন</span>
              </h3>
              <button
                onClick={() => setIsAddCounterOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCounter} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">কাউন্টারের নাম ও সার্ভিস টাইটেল</label>
                <input
                  type="text"
                  required
                  value={newCounterName}
                  onChange={e => setNewCounterName(e.target.value)}
                  placeholder="যেমন: কাউন্টার ৪ - দ্রুত ফটোকপি ও প্রিন্টিং"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">দায়িত্বরত অপারেটর / কর্মী</label>
                  <input
                    type="text"
                    required
                    value={newCounterOperator}
                    onChange={e => setNewCounterOperator(e.target.value)}
                    placeholder="যেমন: তানভীর আহমেদ"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">কাউন্টার পিসির লোকাল আইপি (LAN IP)</label>
                  <input
                    type="text"
                    value={newCounterIp}
                    onChange={e => setNewCounterIp(e.target.value)}
                    placeholder={`যেমন: 192.168.1.${110 + counters.length + 1}`}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">মূল সার্ভার থেকে লিঙ্কড ডিফল্ট প্রিন্টার</label>
                <select
                  value={newCounterPrinterId}
                  onChange={e => setNewCounterPrinterId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.brand} {p.model})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  এই কাউন্টারে আসা সাধারণ প্রিন্ট সরাসরি এই লিঙ্কড প্রিন্টারে স্পুল হবে।
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCounterOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  কাউন্টার সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
