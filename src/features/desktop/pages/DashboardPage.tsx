import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { Check, Clock, Edit3, FileText, ImageOff, Printer, Trash2, X } from 'lucide-react';
import { useStudio } from '../../../shared/context/StudioContext';
import { useI18n } from '../../../shared/i18n/I18nContext';
import type { TranslationKey } from '../../../shared/i18n/strings';
import {
  isIdentityDocument,
  isPdfJob,
  jobDisplayName,
  jobStatusLabelKey,
  jobStatusTone
} from '../../../shared/services/jobDisplay';
import type { JobStatusTone } from '../../../shared/services/jobDisplay';
import type { PrintJob, RejectReason } from '../../../shared/types';

const REJECT_REASONS: RejectReason[] = [
  'blurry_photo',
  'corrupted_file',
  'invalid_size',
  'printer_unavailable',
  'other'
];

const STATUS_DOT_CLASS: Record<JobStatusTone, string> = {
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-text-tertiary'
};

/** Orders that still need the shopkeeper's attention (not finished, not rejected). */
const isOpenOrder = (job: PrintJob): boolean => job.status !== 'completed' && job.status !== 'rejected';

type PreviewState = 'loading' | 'ready' | 'error';

/**
 * Thumbnail area of an order card. Instead of an empty black box it always shows
 * one of: the loading skeleton, the image, or a readable failure/removed state.
 * Identity documents never render their upload file name.
 */
const JobPreview: FC<{ job: PrintJob }> = ({ job }) => {
  const { t } = useI18n();
  const [state, setState] = useState<PreviewState>('loading');
  const isPdf = isPdfJob(job);

  const hint = (centered: boolean) => (
    <span
      className={`pointer-events-none absolute inset-x-0 flex justify-center ${
        centered ? 'inset-y-0 items-center' : 'bottom-2'
      }`}
    >
      <span className="rounded-lg border border-border-primary bg-surface-elevated/95 px-2.5 py-1 text-[11px] font-semibold text-text-primary shadow-sm">
        {t('order.previewOpen')}
      </span>
    </span>
  );

  if (!job.fileUrl) {
    return (
      <div className="relative flex h-40 flex-col items-center justify-center gap-2 bg-bg-secondary pb-9 text-text-tertiary">
        <ImageOff className="h-6 w-6" />
        <span className="text-xs">{t('order.previewRemoved')}</span>
        {hint(false)}
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="relative flex h-40 flex-col items-center justify-center gap-2 bg-bg-secondary pb-9 text-text-secondary">
        <FileText className="h-7 w-7 text-text-tertiary" />
        <span className="text-xs font-semibold">{t('order.previewPdf')}</span>
        <span className="max-w-[80%] truncate text-[11px] text-text-tertiary">
          {isIdentityDocument(job) ? t('job.nidPhoto') : job.fileName}
        </span>
        {hint(false)}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="relative flex h-40 flex-col items-center justify-center gap-2 bg-error-bg pb-9 text-text-secondary">
        <ImageOff className="h-6 w-6 text-error" />
        <span className="text-xs">{t('order.previewError')}</span>
        {hint(false)}
      </div>
    );
  }

  return (
    <div className="relative h-40 overflow-hidden bg-bg-secondary">
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-text-tertiary">
          {t('order.previewLoading')}
        </div>
      )}
      <img
        src={job.fileUrl}
        alt={isIdentityDocument(job) ? t('job.nidPhoto') : job.fileName}
        referrerPolicy="no-referrer"
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
        className={`h-full w-full object-cover transition-opacity ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        style={{
          transform: `rotate(${job.cropSettings?.rotation || 0}deg)`,
          filter: `brightness(${job.cropSettings?.brightness || 100}%) contrast(${job.cropSettings?.contrast || 100}%)`
        }}
      />
      {hint(true)}
    </div>
  );
};

const formatTimeAgo = (timestamp: number, now: number, t: ReturnType<typeof useI18n>['t']): string => {
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return t('order.timeAgo.now');
  if (minutes < 60) return t('order.timeAgo.minutes', { count: minutes });
  return t('order.timeAgo.hours', { count: Math.floor(minutes / 60) });
};

/**
 * Order inbox from the design reference. Every order is a card (not a table row)
 * with its live printer assignment, price and payment state, a preview with real
 * loading/error states, and the Reject / Edit / Approve actions.
 *
 * Reject and Edit route into the existing order dialog (reason is mandatory in
 * its reject step) so the approval, audit-log and desktop-queue logic stays in
 * exactly one place.
 */
export const DashboardPage: FC = () => {
  const { t } = useI18n();
  const {
    jobs,
    counters,
    desktopQueueError,
    approveJob,
    rejectJob,
    openOrderCard
  } = useStudio();

  const [selectedCounterId, setSelectedCounterId] = useState<string>('all');
  const [now, setNow] = useState(() => Date.now());
  const [rejectTarget, setRejectTarget] = useState<PrintJob | null>(null);
  const approvingIdsRef = useRef<Set<string>>(new Set());

  // Keeps the "2 min ago" labels honest while the inbox stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const openOrders = useMemo(() => jobs.filter(isOpenOrder), [jobs]);

  const visibleOrders = useMemo(
    () =>
      [...openOrders]
        .filter(job => selectedCounterId === 'all' || job.counterId === selectedCounterId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [openOrders, selectedCounterId]
  );

  const handleApprove = (job: PrintJob) => {
    if (approvingIdsRef.current.has(job.id)) return;
    approvingIdsRef.current.add(job.id);
    approveJob(job.id);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-sm font-bold text-text-primary">{t('dashboard.title')}</h1>
            <p className="mt-0.5 text-xs text-text-secondary">{t('dashboard.subtitle')}</p>
          </div>
          <span className="text-[11px] font-semibold text-text-tertiary">
            {t('dashboard.openOrders', { count: openOrders.length })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-text-tertiary">{t('dashboard.counterFilter')}</span>
          <button
            type="button"
            onClick={() => setSelectedCounterId('all')}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              selectedCounterId === 'all'
                ? 'bg-brand text-on-brand'
                : 'border border-border-primary bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {t('dashboard.allCounters', { count: openOrders.length })}
          </button>
          {counters.map(counter => {
            const count = openOrders.filter(job => job.counterId === counter.id).length;
            const isSelected = selectedCounterId === counter.id;
            return (
              <button
                key={counter.id}
                type="button"
                onClick={() => setSelectedCounterId(counter.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-brand text-on-brand'
                    : 'border border-border-primary bg-surface text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <span>{counter.code}: {counter.name.split('-')[1]?.trim() || counter.name}</span>
                {!counter.isMasterHost && (
                  <span className={`text-[10px] ${counter.isOnline ? 'text-success' : 'text-error'}`}>
                    {counter.isOnline ? t('printer.online') : t('printer.offline')}
                  </span>
                )}
                <span className="rounded-full bg-bg-secondary px-1.5 font-mono text-[10px] tabular-nums text-text-secondary">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {desktopQueueError && (
          <p role="alert" className="rounded-lg border border-error bg-error-bg px-3 py-2 text-xs text-error">
            {t('dashboard.queueError')}
          </p>
        )}

        {visibleOrders.length === 0 ? (
          <p className="rounded-xl border border-border-primary bg-surface px-4 py-6 text-center text-xs text-text-secondary shadow-sm">
            {t('dashboard.empty')}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleOrders.map(job => (
              <OrderInboxCard
                key={job.id}
                job={job}
                now={now}
                onPreview={() => openOrderCard(job, 'preview')}
                onEdit={() => openOrderCard(job, 'edit')}
                onReject={() => setRejectTarget(job)}
                onApprove={() => handleApprove(job)}
              />
            ))}
          </div>
        )}
      </div>

      {rejectTarget && (
        <RejectOrderDialog
          job={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason, note) => {
            rejectJob(rejectTarget.id, reason, note);
            setRejectTarget(null);
          }}
        />
      )}
    </div>
  );
};

interface OrderInboxCardProps {
  job: PrintJob;
  now: number;
  onPreview: () => void;
  onEdit: () => void;
  onReject: () => void;
  onApprove: () => void;
}

const OrderInboxCard: FC<OrderInboxCardProps> = ({ job, now, onPreview, onEdit, onReject, onApprove }) => {
  const { t } = useI18n();
  const tone = jobStatusTone(job.status);
  const canDecide = job.status === 'queued' || job.status === 'failed';

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border-primary bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-lg font-bold text-text-primary">#{job.tokenCode}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
            <Clock className="h-3.5 w-3.5" />
            {formatTimeAgo(job.createdAt, now, t)}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-lg font-bold tabular-nums text-brand">৳ {job.priceBDT}</span>
          <div className="text-[11px] text-text-secondary">
            {job.paymentStatus === 'paid_mfs' ? t('order.paidMfs') : t('order.counterCash')}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="truncate text-sm font-semibold text-text-primary">{job.serviceLabelBn}</h3>
        <p className="text-xs text-text-secondary">
          {job.paperSize} × {job.copies}
          {' · '}
          {job.colorMode === 'color' ? t('order.color') : t('order.bw')}
          {job.gridCount ? ` · (${job.gridCount}-in-1)` : ''}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-text-secondary">
          <Printer className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <span className="truncate">{t('order.printerAuto', { name: job.targetPrinterName })}</span>
          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[tone]}`} />
          <span className="shrink-0 text-[11px] text-text-tertiary">{t(jobStatusLabelKey(job.status))}</span>
        </p>
        <p className="text-[11px] text-text-tertiary">
          {job.counterId || 'CTR-1'} · {jobDisplayName(job, t('job.nidPhoto'))}
        </p>
        {job.printError && (
          <p role="alert" className="text-[11px] text-error">{job.printError}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onPreview}
        aria-label={t('order.previewOpen')}
        className="overflow-hidden rounded-lg border border-border-secondary transition-colors hover:border-brand"
      >
        <JobPreview key={`${job.id}-${job.fileUrl}`} job={job} />
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReject}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-primary bg-surface px-3 py-2 text-xs font-semibold text-error transition-colors hover:bg-error-bg"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('order.reject')}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-primary bg-surface px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
        >
          <Edit3 className="h-3.5 w-3.5" />
          {t('order.edit')}
        </button>
        {canDecide && (
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            <Check className="h-3.5 w-3.5" />
            {job.status === 'failed' ? t('job.retry') : t('order.approve')}
          </button>
        )}
      </div>
    </article>
  );
};

const REJECT_REASON_LABEL: Record<RejectReason, TranslationKey> = {
  blurry_photo: 'order.rejectReason.blurry_photo',
  corrupted_file: 'order.rejectReason.corrupted_file',
  invalid_size: 'order.rejectReason.invalid_size',
  printer_unavailable: 'order.rejectReason.printer_unavailable',
  other: 'order.rejectReason.other'
};

interface RejectOrderDialogProps {
  job: PrintJob;
  onClose: () => void;
  onConfirm: (reason: RejectReason, note?: string) => void;
}

/**
 * Reject confirmation with a mandatory reason. No reason is preselected and the
 * confirm button stays disabled until the shopkeeper picks one, so an order can
 * never be sent back to the customer without an explanation.
 */
const RejectOrderDialog: FC<RejectOrderDialogProps> = ({ job, onClose, onConfirm }) => {
  const { t } = useI18n();
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('order.reject.title')}
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border-primary bg-surface-elevated text-text-primary shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-secondary px-4 py-3">
          <h3 className="text-sm font-bold">
            {t('order.reject.title')} · #{job.tokenCode}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('order.cancel')}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2 text-[11px] text-text-secondary">
            {t('order.reject.hint')}
          </p>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-xs font-semibold text-text-primary">
              {t('order.reject.reasonLabel')}
            </legend>
            {REJECT_REASONS.map(option => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  reason === option
                    ? 'border-error bg-error-bg text-text-primary'
                    : 'border-border-secondary bg-surface hover:bg-surface-hover'
                }`}
              >
                <input
                  type="radio"
                  name="dashboardRejectReason"
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  className="accent-error"
                />
                <span>{t(REJECT_REASON_LABEL[option])}</span>
              </label>
            ))}
          </fieldset>

          <div>
            <label htmlFor="dashboard-reject-note" className="mb-1 block text-xs text-text-secondary">
              {t('order.reject.noteLabel')}
            </label>
            <textarea
              id="dashboard-reject-note"
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border-primary bg-surface p-2 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-secondary px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-primary bg-surface px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            {t('order.cancel')}
          </button>
          <button
            type="button"
            onClick={() => reason && onConfirm(reason, note.trim() || undefined)}
            disabled={!reason}
            className="rounded-lg bg-error px-3 py-2 text-xs font-semibold text-on-brand transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('order.reject.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
