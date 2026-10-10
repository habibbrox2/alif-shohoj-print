import React from 'react';
import { useStudio } from '../context/StudioContext';
import { X, Check, Eye, Printer, Volume2 } from 'lucide-react';
import { BRAND } from '../config/brand';
import { useI18n } from '../i18n/I18nContext';

export const WindowsToast: React.FC = () => {
  const { activeToast, dismissToast, approveJob, setActiveOrderCardJob } = useStudio();
  const { t } = useI18n();

  if (!activeToast) return null;

  const { job, title, message } = activeToast;

  const handleOpenCard = () => {
    setActiveOrderCardJob(job);
    dismissToast();
  };

  const handleQuickApprove = () => {
    approveJob(job.id);
    dismissToast();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-accent/30 bg-surface-elevated/95 shadow-xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center justify-between border-b border-border-primary/60 bg-surface-hover/80 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2 font-medium text-text-secondary">
          <div className="flex h-4 w-4 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-text">
            {BRAND.logoLetter}
          </div>
          <span>{BRAND.productName} · {t('nav.status')}</span>
          <Volume2 className="h-3.5 w-3.5 animate-pulse text-accent" />
        </div>
        <button
          onClick={dismissToast}
          className="rounded p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
          title={t('order.cancel')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-light">
            <Printer className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h4 className="truncate text-sm font-bold text-text-primary">{title}</h4>
              <span className="text-[11px] font-mono font-semibold tabular-nums text-accent">
                ৳ {job.priceBDT}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-snug text-text-secondary">{message}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-text-tertiary">
              <span>{job.targetPrinterName}</span>
              <span>·</span>
              <span className="text-success">
                {job.paymentStatus === 'paid_mfs' ? t('order.paid') : t('order.counterCash')}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border-primary pt-2.5">
          <button
            onClick={handleOpenCard}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-primary bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            <Eye className="h-3.5 w-3.5 text-text-tertiary" />
            <span>{t('order.previewOpen')}</span>
          </button>

          <button
            onClick={handleQuickApprove}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-text shadow-sm transition-colors hover:bg-accent-hover"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{t('order.approve')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};