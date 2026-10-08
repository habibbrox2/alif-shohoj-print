import React, { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../shared/context/StudioContext';
import { ShopCounter } from '../../shared/types';
import QRCode from 'qrcode';
import { X, Printer, Download, Sparkles, Volume2, ShieldCheck, Laptop, Monitor, Layers, Check } from 'lucide-react';

export const CounterPosterModal: React.FC = () => {
  const {
    isPosterModalOpen,
    setIsPosterModalOpen,
    shopProfile,
    counters,
    selectedPosterCounter,
    setSelectedPosterCounter,
    printers,
  } = useStudio();

  // Active tab: specific counter ID or 'all'
  const [activeTab, setActiveTab] = useState<string>('CTR-01');
  const singleCanvasRef = useRef<HTMLCanvasElement>(null);

  // References for all counters grid
  const allCanvasesRef = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    if (selectedPosterCounter) {
      setActiveTab(selectedPosterCounter.id);
    }
  }, [selectedPosterCounter]);

  // Generate QR for single active counter
  useEffect(() => {
    if (isPosterModalOpen && activeTab !== 'all' && singleCanvasRef.current) {
      const currentCounter = counters.find(c => c.id === activeTab) || counters[0];
      const qrTargetUrl = `${window.location.origin}/?shop=${shopProfile.code}&counter=${currentCounter.code}`;
      QRCode.toCanvas(singleCanvasRef.current, qrTargetUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    }
  }, [isPosterModalOpen, activeTab, shopProfile.code, counters]);

  // Generate QRs for all counters sheet
  useEffect(() => {
    if (isPosterModalOpen && activeTab === 'all') {
      counters.forEach(counter => {
        const canvas = allCanvasesRef.current[counter.id];
        if (canvas) {
          const qrTargetUrl = `${window.location.origin}/?shop=${shopProfile.code}&counter=${counter.code}`;
          QRCode.toCanvas(canvas, qrTargetUrl, {
            width: 130,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
        }
      });
    }
  }, [isPosterModalOpen, activeTab, shopProfile.code, counters]);

  if (!isPosterModalOpen) return null;

  const currentCounter = counters.find(c => c.id === activeTab) || counters[0];
  const linkedPrinter = printers.find(p => p.id === currentCounter.defaultPrinterId);

  const handlePrintPoster = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 border-b border-slate-700">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>কাউন্টার QR স্ট্যান্ড পোস্টার প্রিন্ট</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                Multi-Counter LAN
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              প্রতিটি কাউন্টার কম্পিউটারের জন্য আলাদা ডেডিকেটেড QR কোড
            </p>
          </div>
          <button
            onClick={() => {
              setIsPosterModalOpen(false);
              setSelectedPosterCounter(null);
            }}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter Tab Selector */}
        <div className="bg-slate-850 px-5 py-2.5 border-b border-slate-700/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">কাউন্টার নির্বাচন:</span>
          {counters.map(counter => (
            <button
              key={counter.id}
              onClick={() => setActiveTab(counter.id)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === counter.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              {counter.isMasterHost ? <Monitor className="w-3 h-3 text-amber-300" /> : <Laptop className="w-3 h-3" />}
              <span>{counter.code}: {counter.name.split('-')[1]?.trim() || counter.name}</span>
            </button>
          ))}
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>সব কাউন্টার একসাথে (A4 শিট)</span>
          </button>
        </div>

        {/* Printable Stand Body (Light themed for crisp paper printing) */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-950 flex justify-center">
          {activeTab !== 'all' ? (
            /* Single Counter Poster Stand */
            <div className="w-full max-w-sm bg-white text-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 text-center space-y-4 print:p-8 print:m-0 print:border-none print:shadow-none print:w-full">
              {/* Shop Brand & Counter Header */}
              <div className="space-y-1 border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase font-mono block">
                  ALIF SHOHOJ PRINT · LAN NETWORK COUNTER
                </span>
                <h2 className="text-lg font-black text-slate-900 leading-tight">
                  {shopProfile.nameBn}
                </h2>
                <p className="text-xs text-slate-500 font-medium">{shopProfile.name}</p>

                {/* Counter Identity Badge */}
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs shadow-xs">
                  <span>{currentCounter.name}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                  <span>অপারেটর: {currentCounter.operator}</span>
                  <span>·</span>
                  <span>IP: {currentCounter.ipAddress}</span>
                </div>
              </div>

              {/* Dedicated QR Code Container */}
              <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-500/50 inline-block shadow-sm">
                <canvas ref={singleCanvasRef} className="rounded-lg mx-auto" />
                <div className="mt-2 text-xs font-bold text-emerald-900">
                  {currentCounter.code} স্ক্যান করে সরাসরি ফাইল পাঠান
                </div>
                <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                  {window.location.origin}/?shop={shopProfile.code}&counter={currentCounter.code}
                </div>
              </div>

              {/* Step instructions in Bengali */}
              <div className="text-left space-y-2 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    ১
                  </span>
                  <span>মোবাইল ক্যামেরা দিয়ে এই কাউন্টারের QR কোড স্ক্যান করুন।</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    ২
                  </span>
                  <span>ছবি, এনআইডি বা ডকুমেন্ট আপলোড করে কপি ও সাইজ পছন্দ করুন।</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    ৩
                  </span>
                  <span>টোকেন কোডটি <strong>{currentCounter.operator}</strong>-কে দেখিয়ে প্রিন্ট বুঝে নিন।</span>
                </div>
              </div>

              {/* Shared Hardware & Routing Notice */}
              <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-left text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>শেয়ার্ড নেটওয়ার্ক প্রিন্টার ও স্ক্যানার:</span>
                </div>
                <p className="text-[10px] text-slate-600">
                  এই কাউন্টার থেকে সরাসরি মূল সার্ভারে লিঙ্কড <strong>{linkedPrinter?.name || 'High-Speed Spooler'}</strong> ও ফ্ল্যাটবেড স্ক্যানার দিয়ে প্রিন্ট/স্ক্যান সম্পন্ন হবে।
                </p>
              </div>

              {/* Voice & Privacy features */}
              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 pt-1">
                <span className="flex items-center gap-1 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  বাংলা ভয়েস গাইড
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ১৫ মিনিটে অটো-ডিলিট
                </span>
              </div>
            </div>
          ) : (
            /* Multi-Counter 3-in-1 Printable A4 Sheet */
            <div className="w-full bg-white text-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 space-y-5 print:p-4 print:m-0 print:border-none print:shadow-none">
              <div className="text-center border-b border-slate-250 pb-3">
                <span className="text-[11px] font-bold text-emerald-700 font-mono uppercase">
                  ALIF SHOHOJ PRINT · ALL COUNTERS PRINT SHEET
                </span>
                <h2 className="text-lg font-black text-slate-900">{shopProfile.nameBn}</h2>
                <p className="text-xs text-slate-500">
                  এক শিটে সব কাউন্টারের QR স্ট্যান্ড · কেটে প্রতিটি ডেস্কে লাগিয়ে দিন
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {counters.map(counter => {
                  const printer = printers.find(p => p.id === counter.defaultPrinterId);
                  return (
                    <div
                      key={counter.id}
                      className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center text-center space-y-2 relative"
                    >
                      <div className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                        {counter.code}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{counter.name}</h4>
                      <p className="text-[10px] text-slate-500">অপারেটর: {counter.operator}</p>

                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <canvas
                          ref={el => {
                            allCanvasesRef.current[counter.id] = el;
                          }}
                          className="mx-auto"
                        />
                      </div>

                      <div className="text-[10px] font-bold text-emerald-800">
                        ক্যামেরা দিয়ে স্ক্যান করুন
                      </div>

                      <div className="text-[9px] text-slate-500 bg-white p-1.5 rounded border border-slate-200 w-full text-left space-y-0.5">
                        <div className="font-semibold text-slate-700">ডিফল্ট প্রিন্টার:</div>
                        <div className="truncate">{printer?.name || 'Epson / HP'}</div>
                        <div className="text-slate-400">IP: {counter.ipAddress}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-center text-[11px] text-slate-500 border-t border-slate-200 pt-2">
                বিল পরিশোধ: ক্যাশ · বিকাশ · নগদ · মূল সার্ভার শেয়ার্ড ড্রাইভার যুক্ত
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {activeTab === 'all'
              ? 'সব কাউন্টার ৩-ইন-১ শিট প্রিন্ট'
              : `${currentCounter.name} স্ট্যান্ড প্রিন্ট`}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsPosterModalOpen(false);
                setSelectedPosterCounter(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors"
            >
              বন্ধ করুন
            </button>
            <button
              onClick={handlePrintPoster}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন (Print Poster)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
