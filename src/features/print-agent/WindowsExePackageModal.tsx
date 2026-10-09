import React, { useState } from 'react';
import { useStudio } from '../../shared/context/StudioContext';
import { driverRegistry } from '../printers/drivers/PrinterDriverRegistry';
import { capabilitiesRegistry, STANDARD_PAPER_SPECS } from '../printers/drivers/PrinterCapabilitiesRegistry';
import { WINDOWS_AGENT_SOURCE, BATCH_RUNNER_SCRIPT, AGENT_PACKAGE_JSON } from './services/mockAgentGenerator';
import {
  X,
  Download,
  Copy,
  Check,
  Cpu,
  Layers,
  Code2,
  Terminal,
  Printer,
  FileCode,
  ShieldCheck,
  Gauge,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const WindowsExePackageModal: React.FC = () => {
  const { isExePackageModalOpen, setIsExePackageModalOpen, printers, jobs } = useStudio();
  const [activeTab, setActiveTab] = useState<'capabilities_registry' | 'driver_layer' | 'agent_code' | 'bat_script' | 'package_json'>('capabilities_registry');
  const [copied, setCopied] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(printers[0]?.id || '');

  // Dynamic capability tester state
  const [testPaperSize, setTestPaperSize] = useState<string>('4R (4x6 in)');
  const [testColorMode, setTestColorMode] = useState<'color' | 'bw'>('color');

  if (!isExePackageModalOpen) return null;

  const currentPrinter = printers.find(p => p.id === selectedPrinterId) || printers[0];
  const activeDriver = currentPrinter ? driverRegistry.resolveDriver(currentPrinter) : null;
  const currentCapabilities = currentPrinter ? capabilitiesRegistry.getCapabilitiesForDevice(currentPrinter) : null;
  const sampleJob = jobs[0];
  const rawCommands = currentPrinter && sampleJob ? driverRegistry.getRawCommands(sampleJob, currentPrinter) : [];

  // Live validation test result
  const testValidation = currentPrinter
    ? capabilitiesRegistry.validateJobSupport(currentPrinter, testPaperSize, testColorMode)
    : { supported: false, reason: 'No printer selected', optimalDpi: 600 };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="fluent-ui relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
              EXE
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">ALIF SHOHOJ PRINT Windows Agent & Driver Layer</h3>
              <p className="text-[11px] text-slate-400">Driver Abstraction Layer & PrinterCapabilitiesRegistry</p>
            </div>
          </div>
          <button
            onClick={() => setIsExePackageModalOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 bg-slate-950/80 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('capabilities_registry')}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'capabilities_registry'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Capabilities Registry (Dynamic Query)</span>
          </button>

          <button
            onClick={() => setActiveTab('driver_layer')}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'driver_layer'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Driver Layer & Spool Bytecode</span>
          </button>

          <button
            onClick={() => setActiveTab('agent_code')}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'agent_code'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>AlifShohojPrintAgent.js</span>
          </button>

          <button
            onClick={() => setActiveTab('bat_script')}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'bat_script'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>start-agent.bat</span>
          </button>

          <button
            onClick={() => setActiveTab('package_json')}
            className={`pb-2 px-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'package_json'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>package.json</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 font-sans space-y-4">
          {/* TAB 1: Capabilities Registry */}
          {activeTab === 'capabilities_registry' && currentCapabilities && (
            <div className="space-y-4 text-xs">
              {/* Device Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <label className="text-[11px] text-slate-400 block">কানেক্টেড ডিভাইস নির্বাচন করুন:</label>
                  <select
                    value={selectedPrinterId}
                    onChange={e => setSelectedPrinterId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-white text-xs font-semibold mt-1"
                  >
                    {printers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.brand} · {p.status === 'online' ? '🟢 Online' : '🔴 Offline'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                    Driver & Protocol
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {currentCapabilities.driverId} ({currentCapabilities.protocol})
                  </span>
                </div>
              </div>

              {/* 3 Core Capability Columns: Paper Sizes, Color Modes, DPI Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Paper Sizes */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-white">সমর্থিত পেপার সাইজ ({currentCapabilities.supportedPaperSizes.length})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {currentCapabilities.borderlessSupported ? 'Borderless ✅' : 'Margins Only'}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {currentCapabilities.supportedPaperSizes.map(paper => (
                      <div key={paper.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80">
                        <div className="flex items-center justify-between font-semibold text-slate-200">
                          <span>{paper.id}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {paper.widthMm}×{paper.heightMm} mm
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                          <span>{paper.nameBn}</span>
                          <span>{paper.minWeightGsm}-{paper.maxWeightGsm} gsm</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Color Modes */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-white">কালার ইঞ্জিন ও প্রোফাইল</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {currentCapabilities.colorModes.length} Modes
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {currentCapabilities.colorModes.map(c => (
                      <div key={c.mode} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between font-semibold text-slate-200">
                          <span className="uppercase text-emerald-400 font-mono">{c.mode}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.bitsPerPixel}-bit</span>
                        </div>
                        <p className="text-[10px] text-slate-300">{c.name}</p>
                        <div className="text-[9px] font-mono text-slate-500 truncate" title={c.iccProfileName}>
                          ICC: {c.iccProfileName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. DPI & Hardware Speeds */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-white">DPI ও স্পিড রেটিং</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Max {Math.max(...currentCapabilities.dpiOptions)} DPI
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {currentCapabilities.dpiOptions.map(dpi => (
                        <span
                          key={dpi}
                          className={`px-2 py-1 rounded text-[11px] font-mono font-bold ${
                            dpi === currentCapabilities.photoDpi
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : 'bg-slate-900 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {dpi} DPI {dpi === currentCapabilities.photoDpi ? '★' : ''}
                        </span>
                      ))}
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>মনো ড্রাফট স্পিড:</span>
                        <span className="font-mono text-white font-bold">
                          {currentCapabilities.hardwareSpeedPPM.monoDraft} PPM
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>কালার রেগুলার স্পিড:</span>
                        <span className="font-mono text-white font-bold">
                          {currentCapabilities.hardwareSpeedPPM.colorNormal} PPM
                        </span>
                      </div>
                      {currentCapabilities.hardwareSpeedPPM.photoHighResSecondsPerPrint > 0 && (
                        <div className="flex items-center justify-between text-slate-400">
                          <span>4R হাই-রেজ ফটো:</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {currentCapabilities.hardwareSpeedPPM.photoHighResSecondsPerPrint} সেকেন্ড/প্রিন্ট
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Dynamic Job Support Validator */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-sm">ডায়নামিক ক্যাপাবিলিটি ভ্যালিডেশন টেস্ট</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    সিলেক্টেড ডিভাইসে কোনো জব চালানো যাবে কি না টেস্ট করুন
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">পেপার সাইজ বেছে নিন:</label>
                    <select
                      value={testPaperSize}
                      onChange={e => setTestPaperSize(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                    >
                      {Object.keys(STANDARD_PAPER_SPECS).map(key => (
                        <option key={key} value={key}>
                          {key} ({STANDARD_PAPER_SPECS[key].nameBn})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">কালার মোড:</label>
                    <select
                      value={testColorMode}
                      onChange={e => setTestColorMode(e.target.value as 'color' | 'bw')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                    >
                      <option value="color">কালার (Color)</option>
                      <option value="bw">সাদা-কালো (Monochrome B&W)</option>
                    </select>
                  </div>
                </div>

                {/* Validation Output */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    testValidation.supported
                      ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-700/60 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testValidation.supported ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold text-sm block">
                        {testValidation.supported ? 'সফল: ডিভাইসটি জব প্রসেস করতে সক্ষম' : 'অসমর্থিত: ক্যাপাবিলিটি লিমিটেশন'}
                      </span>
                      <span className="text-[11px] opacity-90">
                        {testValidation.supported
                          ? `ডায়নামিক অপটিমাল রেজোলিউশন: ${testValidation.optimalDpi} DPI অটোমেটিকভাবে নির্ধারিত হয়েছে।`
                          : testValidation.reason}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Driver Abstraction Layer Inspector */}
          {activeTab === 'driver_layer' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <Layers className="w-4 h-4" />
                  <span>Standardized IPrinterDriver Adapter Pattern</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  The ALIF SHOHOJ PRINT Agent uses a unified driver abstraction layer. Rather than writing custom vendor code in the business logic, all printer interactions flow through the <code>IPrinterDriver</code> interface. This standardizes protocol negotiation, status polling, and raster generation across Epson ESC/P-R, HP PCL 6, Canon BJNP, and generic Windows GDI spoolers.
                </p>
              </div>

              {/* Driver Adapter Matrix */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-300">সিস্টেমে রেজিস্টার্ড ড্রাইভার অ্যাডাপ্টার সমূহ:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {driverRegistry.getAvailableDrivers().map(drv => (
                    <div key={drv.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{drv.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                          {drv.protocol}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Vendor: <span className="text-slate-300 font-semibold">{drv.vendor}</span> · Protocol: <code>{drv.protocol}</code>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Driver Command Inspector */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">লাইভ ড্রাইভার কমান্ড ও প্রোটোকল ইন্সপেক্টর:</span>
                  <select
                    value={selectedPrinterId}
                    onChange={e => setSelectedPrinterId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg py-1 px-2 text-white text-xs"
                  >
                    {printers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {activeDriver && (
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-slate-400">অ্যাসাইনকৃত ড্রাইভার: </span>
                      <span className="font-bold text-emerald-400">{activeDriver.name}</span>
                    </div>
                    <span className="font-mono text-slate-400">{activeDriver.protocol}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400">
                    স্পুলারে প্রেরিত রিয়েল ড্রাইভার কমান্ড স্ট্রিম:
                  </span>
                  <div className="p-3 rounded-lg bg-black border border-slate-800 font-mono text-[11px] text-emerald-400 space-y-1 max-h-40 overflow-y-auto">
                    {rawCommands.map((cmd, idx) => (
                      <div key={idx} className="leading-snug">
                        <span className="text-slate-600 select-none mr-2">{String(idx + 1).padStart(2, '0')}:</span>
                        {cmd}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AlifShohojPrintAgent.js */}
          {activeTab === 'agent_code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">AlifShohojPrintAgent.js · 140 lines</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(WINDOWS_AGENT_SOURCE)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                  </button>
                  <button
                    onClick={() => downloadFile('AlifShohojPrintAgent.js', WINDOWS_AGENT_SOURCE)}
                    className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ডাউনলোড</span>
                  </button>
                </div>
              </div>

              <pre className="p-3.5 bg-black border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto max-h-[380px] overflow-y-auto">
                {WINDOWS_AGENT_SOURCE}
              </pre>
            </div>
          )}

          {/* TAB 4: start-agent.bat */}
          {activeTab === 'bat_script' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">start-agent.bat · Windows Startup Script</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(BATCH_RUNNER_SCRIPT)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                  </button>
                  <button
                    onClick={() => downloadFile('start-agent.bat', BATCH_RUNNER_SCRIPT)}
                    className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ডাউনলোড</span>
                  </button>
                </div>
              </div>

              <pre className="p-3.5 bg-black border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto max-h-[380px] overflow-y-auto">
                {BATCH_RUNNER_SCRIPT}
              </pre>
            </div>
          )}

          {/* TAB 5: package.json */}
          {activeTab === 'package_json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">package.json</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(AGENT_PACKAGE_JSON)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                  </button>
                  <button
                    onClick={() => downloadFile('package.json', AGENT_PACKAGE_JSON)}
                    className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ডাউনলোড</span>
                  </button>
                </div>
              </div>

              <pre className="p-3.5 bg-black border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto max-h-[380px] overflow-y-auto">
                {AGENT_PACKAGE_JSON}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Windows 10, 11 (64-bit) সাপোর্টেড · ডায়নামিক ক্যাপাবিলিটি কুয়েরি একটিভ</span>
          </div>
          <button
            onClick={() => setIsExePackageModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
