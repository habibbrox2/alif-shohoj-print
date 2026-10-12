import React from 'react';
import { useStudio } from '../context/StudioContext';
import { X, Check, Eye, Printer, Volume2 } from 'lucide-react';
import { BRAND } from '../config/brand';
import { useI18n } from '../i18n/I18nContext';

export const WindowsToast: React.FC = () => {
  const { activeToast, dismissToast, approveJob, setActiveOrderCardJob, openOrderInStudio, setActiveView } = useStudio();
  const { t } = useI18n();

  if (!activeToast) return null;

  const { job } = activeToast;
  const orderSummary = t('toast.newOrder', {
    tokenCode: job.tokenCode,
    service: job.serviceLabelBn || t('job.nidPhoto'),
    paperSize: job.paperSize,
    copies: job.copies
  });
  const paymentLabel = job.paymentStatus === 'unpaid'
    ? t('order.counterCash')
    : t('order.paid');

  const handleOpenCard = () => {
    setActiveOrderCardJob(job);
    dismissToast();
  };

  const handleQuickApprove = () => {
    approveJob(job.id);
    dismissToast();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-border-primary bg-surface-elevated/95 shadow-xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center justify-between border-b border-border-primary/60 bg-surface-hover/80 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2 font-medium text-text-secondary">
          <div className="flex h-4 w-4 items-center justify-center rounded bg-brand text-[10px] font-bold text-on-brand">
            {BRAND.logoLetter}
          </div>
          <span>{BRAND.productName}</span>
          <Volume2 className="h-3.5 w-3.5 animate-pulse text-brand" />
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand-soft">
            <Printer className="h-5 w-5 text-brand" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold leading-snug text-text-primary">{orderSummary}</h4>
              <span className="shrink-0 text-[11px] font-mono font-semibold tabular-nums text-brand">
                ৳ {job.priceBDT}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-text-tertiary">
              <span>{job.targetPrinterName}</span>
              <span>·</span>
              <span className={job.paymentStatus === 'unpaid' ? 'text-warning' : 'text-success'}>{paymentLabel}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border-primary pt-2.5">
          <button
            onClick={handleOpenCard}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-primary bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            <Eye className="h-3.5 w-3.5 text-text-tertiary" />
            <span>{t('toast.view')}</span>
          </button>

          <button
            onClick={() => {
              openOrderInStudio(job);
              setActiveView('studio');
              dismissToast();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-primary bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            <span>{t('order.edit')}</span>
          </button>

          <button
            onClick={handleQuickApprove}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{t('order.approve')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};