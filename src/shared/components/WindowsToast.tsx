import React from 'react';
import { useStudio } from '../context/StudioContext';
import { X, Check, Eye, Printer, Volume2 } from 'lucide-react';

export const WindowsToast: React.FC = () => {
  const { activeToast, dismissToast, approveJob, setActiveOrderCardJob } = useStudio();

  if (!activeToast) return null;

  const { job, title, message } = activeToast;

  const handleOpenCard = () => {
    setActiveOrderCardJob(job);
    dismissToast();
  };

  const handleQuickApprove = () => {
    approveJob(job.id);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-slate-900/95 backdrop-blur-xl border border-emerald-500/50 rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      {/* Windows 11 Toast Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-800/80 border-b border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <div className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center text-[10px] text-white font-bold">
            AL
          </div>
          <span>ALIF SHOHOJ PRINT · Windows Agent</span>
          <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        </div>
        <button
          onClick={dismissToast}
          className="text-slate-400 hover:text-white transition-colors p-0.5 rounded"
          title="বন্ধ করুন"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Toast Body */}
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Printer className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white truncate">{title}</h4>
              <span className="text-[11px] font-mono text-emerald-400 font-semibold tabular-nums">
                ৳ {job.priceBDT}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">{message}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span>প্রিন্টার: {job.targetPrinterName.split(' ')[0]}</span>
              <span>·</span>
              <span className="text-emerald-400">
                {job.paymentStatus === 'paid_mfs' ? 'পেইড ✅' : 'কাউন্টার ক্যাশ'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Toast Action Buttons */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-800">
          <button
            onClick={handleOpenCard}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span>দেখুন</span>
          </button>

          <button
            onClick={handleQuickApprove}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
