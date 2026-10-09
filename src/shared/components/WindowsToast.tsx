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
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-surface-elevated/95 backdrop-blur-xl border border-accent/30 rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      {/* Windows 11 Toast Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-surface-hover/80 border-b border-border-primary/60 text-xs">
        <div className="flex items-center gap-2 text-text-secondary font-medium">
          <div className="w-4 h-4 rounded bg-accent flex items-center justify-center text-[10px] text-accent-text font-bold">
            AL
          </div>
          <span>ALIF SHOHOJ PRINT · Windows Agent</span>
          <Volume2 className="w-3.5 h-3.5 text-accent animate-pulse" />
        </div>
        <button
          onClick={dismissToast}
          className="text-text-tertiary hover:text-text-primary transition-colors p-0.5 rounded"
          title="বন্ধ করুন"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Toast Body */}
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-light border border-accent/30 flex items-center justify-center shrink-0">
            <Printer className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-text-primary truncate">{title}</h4>
              <span className="text-[11px] font-mono text-accent font-semibold tabular-nums">
                ৳ {job.priceBDT}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5 leading-snug">{message}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-text-tertiary">
              <span>প্রিন্টার: {job.targetPrinterName}</span>
              <span>·</span>
              <span className="text-success">
                {job.paymentStatus === 'paid_mfs' ? 'পেইড ✅' : 'কাউন্টার ক্যাশ'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Toast Action Buttons */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border-primary">
          <button
            onClick={handleOpenCard}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-xs font-medium text-text-secondary border border-border-primary transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-text-tertiary" />
            <span>দেখুন</span>
          </button>

          <button
            onClick={handleQuickApprove}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-accent hover:bg-accent-hover text-xs font-semibold text-accent-text shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};