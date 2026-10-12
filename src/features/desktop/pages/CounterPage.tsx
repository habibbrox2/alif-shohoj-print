import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { CircleAlert, Clock, Download, Loader, QrCode, RadioTower, ShieldCheck, Store, Wifi, WifiOff } from 'lucide-react';
import { useI18n } from '../../../shared/i18n/I18nContext';
import type { TranslationKey } from '../../../shared/i18n/strings';
import { useStudio, type CounterConnectionState, type CounterFeedState } from '../../../shared/context/StudioContext';
import { mergeCounterInbox, summarizeCounterOrders, type CounterInboxOrder } from '../../../shared/services/counterInbox';
import { COUNTER_FEED_KEY_PATTERN } from '../../../shared/services/counterFeed';
import { formatJobTime, jobStatusLabelKey, jobStatusTone } from '../../../shared/services/jobDisplay';
import type { JobStatusTone } from '../../../shared/services/jobDisplay';
import type { PaymentStatus } from '../../../shared/types';
import { BRAND } from '../../../shared/config/brand';

const TONE_CLASSES: Record<JobStatusTone, string> = {
  success: 'bg-success-bg text-success',
  error: 'bg-error-bg text-error',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-brand-soft text-brand',
  neutral: 'bg-bg-secondary text-text-tertiary',
};

const CONNECTION_LABELS: Record<CounterConnectionState, TranslationKey> = {
  connected: 'counter.connection.connected',
  disconnected: 'counter.connection.disconnected',
  unknown: 'counter.connection.unknown',
};

const FEED_LABELS: Record<CounterFeedState, TranslationKey> = {
  live: 'counter.feed.live',
  syncing: 'counter.feed.syncing',
  error: 'counter.feed.error',
  unconfigured: 'counter.feed.unconfigured',
};

const FEED_TONE_CLASSES: Record<CounterFeedState, string> = {
  live: 'bg-success-bg text-success',
  syncing: 'bg-brand-soft text-brand',
  error: 'bg-error-bg text-error',
  unconfigured: 'bg-bg-secondary text-text-tertiary',
};

const paymentLabelKey = (paymentStatus: PaymentStatus): 'order.paid' | 'order.paidMfs' | 'order.counterCash' => {
  if (paymentStatus === 'paid_mfs') return 'order.paidMfs';
  if (paymentStatus === 'paid_counter') return 'order.paid';
  return 'order.counterCash';
};

/**
 * Counter PC inbox: who this counter is, whether the master PC is reachable, the
 * pairing key that turns on the live order feed, and the orders this counter may
 * see. Counter PCs never render the master tabs (printers, reports, POS
 * revenue, settings).
 */
export const CounterPage: React.FC = () => {
  const { t } = useI18n();
  const {
    shopProfile,
    installationConfig,
    counters,
    jobs,
    counterConnection,
    feedOrders,
    counterFeed,
    refreshCounterFeed,
    saveCounterFeedKey,
    clearCounterFeedKey,
  } = useStudio();

  const counterId = installationConfig?.mode === 'counter' ? installationConfig.counterId : '';
  const counter = counters.find(entry => entry.id === counterId) ?? null;
  const orders = useMemo(() => mergeCounterInbox(jobs, feedOrders, counterId), [jobs, feedOrders, counterId]);
  const summary = useMemo(() => summarizeCounterOrders(orders), [orders]);

  const [keyDraft, setKeyDraft] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [isKeySaving, setIsKeySaving] = useState(false);
  const canPair = Boolean(window.alifShohojPrintDesktop);
  const isPaired = counterFeed.state !== 'unconfigured';
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrTargetUrl, setQrTargetUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const masterUrl = installationConfig?.masterUrl ?? '';

  // The customer app selects this counter from `?counter=`, matched by counter ID
  // or code, so the ID this PC was configured with is enough. The QR always points
  // at the master gateway's customer app, because that is the PC customers can
  // reach — and it keeps the same `/resources/pwa.html` entry as the printed poster.
  useEffect(() => {
    if (!masterUrl || !counterId) {
      setQrDataUrl(null);
      setQrTargetUrl(null);
      setQrError(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const target = new URL(masterUrl);
        target.pathname = '/resources/pwa.html';
        target.search = '';
        target.hash = '';
        target.searchParams.set('counter', counterId);
        target.searchParams.set('view', 'customer_pwa');
        const url = target.toString();
        const dataUrl = await QRCode.toDataURL(url, {
          width: 512,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        if (!active) return;
        setQrTargetUrl(url);
        setQrDataUrl(dataUrl);
        setQrError(null);
      } catch (error) {
        if (!active) return;
        setQrDataUrl(null);
        setQrError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => { active = false; };
  }, [masterUrl, counterId]);

  const handleDownloadQr = (): void => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `alif-shohoj-print-${counterId || 'counter'}-qr.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const connectionLabel = t(CONNECTION_LABELS[counterConnection]);
  const connectionTone = counterConnection === 'connected'
    ? 'text-success'
    : counterConnection === 'disconnected'
      ? 'text-error'
      : 'text-text-tertiary';

  const handleSaveKey = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const key = keyDraft.trim();
    if (!COUNTER_FEED_KEY_PATTERN.test(key.toLowerCase())) {
      setKeyError(t('counter.feed.keyInvalid'));
      return;
    }
    setIsKeySaving(true);
    try {
      await saveCounterFeedKey(key.toLowerCase());
      setKeyDraft('');
      setKeyError(null);
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsKeySaving(false);
    }
  };

  const handleUnpair = async (): Promise<void> => {
    try {
      await clearCounterFeedKey();
      setKeyDraft('');
      setKeyError(null);
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg-secondary">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-primary bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-text-primary">
                {counter?.name ?? counterId ?? t('nav.counterInbox')}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
                <span className="font-mono font-semibold">{counter?.code ?? counterId}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {t('status.connectedDetail', { product: BRAND.productName })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${FEED_TONE_CLASSES[counterFeed.state]}`}>
              {t(FEED_LABELS[counterFeed.state])}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-surface px-3.5 py-2 text-xs font-semibold text-text-primary">
              {counterConnection === 'connected' ? (
                <Wifi className={`h-3.5 w-3.5 ${connectionTone}`} />
              ) : counterConnection === 'disconnected' ? (
                <WifiOff className={`h-3.5 w-3.5 ${connectionTone}`} />
              ) : (
                <Loader className={`h-3.5 w-3.5 ${connectionTone}`} />
              )}
              <span className={connectionTone} role="status">{connectionLabel}</span>
            </span>
          </div>
        </header>

        <div className="space-y-5">
          <section className="rounded-xl border border-border-primary bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-text-primary">{t('counter.subtitle')}</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('counter.operator')}: <span className="font-semibold text-text-primary">{counter?.operator || '—'}</span>
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('counter.masterPc')}: <span className="font-mono text-text-primary">{masterUrl || '—'}</span>
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-text-secondary">
                {t('counter.activeOrders', { count: summary.active })}
              </span>
              <span className="rounded-full bg-success-bg px-2.5 py-1 text-success">
                {t('counter.printedOrders', { count: summary.printed })}
              </span>
              <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-text-tertiary">
                {t('counter.rejectedOrders', { count: summary.rejected })}
              </span>
            </div>
          </section>

          <section className="rounded-xl border border-border-primary bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <QrCode className="h-3.5 w-3.5 text-brand" />
              <h3 className="text-xs font-bold text-text-primary">{t('counter.qr.title')}</h3>
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-surface px-3 py-1.5 text-[11px] font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {t('counter.qr.download')}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={t('counter.qr.title')}
                  width={148}
                  height={148}
                  className="rounded-lg border border-border-secondary bg-white p-1.5"
                />
              ) : (
                <div className="flex h-[148px] w-[148px] items-center justify-center rounded-lg border border-dashed border-border-primary text-[11px] text-text-tertiary">
                  {qrError ? t('counter.qr.failed') : t('counter.qr.unavailable')}
                </div>
              )}
              <div className="min-w-[12rem] flex-1 text-[11px] text-text-secondary">
                <p>{t('counter.qr.hint')}</p>
                {qrTargetUrl && <p className="mt-2 break-all font-mono text-[10px] text-text-tertiary">{qrTargetUrl}</p>}
                {qrError && <p role="alert" className="mt-2 text-[11px] text-error">{qrError}</p>}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border-primary bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <RadioTower className="h-3.5 w-3.5 text-brand" />
              <h3 className="text-xs font-bold text-text-primary">{t('counter.feed.title')}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${FEED_TONE_CLASSES[counterFeed.state]}`}>
                {t(FEED_LABELS[counterFeed.state])}
              </span>
              {counterFeed.lastSyncedAt !== null && (
                <span className="text-[11px] text-text-secondary">
                  {t('counter.feed.lastSynced', { time: formatJobTime(counterFeed.lastSyncedAt) })}
                </span>
              )}
              <button
                type="button"
                onClick={() => void refreshCounterFeed()}
                disabled={!isPaired || !canPair}
                className="ml-auto rounded-lg border border-border-primary bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('counter.feed.syncNow')}
              </button>
            </div>

            {counterFeed.error && (
              <p role="alert" className="mt-2 rounded-lg bg-error-bg px-3 py-2 text-[11px] text-error">
                {counterFeed.error}
              </p>
            )}

            <p className="mt-2 text-[11px] text-text-secondary">{t('counter.feed.keyHint')}</p>
            {isPaired && (
              <p className="mt-1 text-[11px] text-text-tertiary">
                {counterFeed.keyProtected ? t('counter.feed.keyProtected') : t('counter.feed.keyUnprotected')}
              </p>
            )}

            <form onSubmit={event => void handleSaveKey(event)} className="mt-3 flex flex-wrap items-end gap-2">
              <label className="min-w-[14rem] flex-1">
                <span className="block text-[11px] font-semibold text-text-secondary">{t('counter.feed.keyLabel')}</span>
                <input
                  type="password"
                  value={keyDraft}
                  onChange={event => setKeyDraft(event.target.value)}
                  placeholder={t('counter.feed.keyPlaceholder')}
                  aria-label={t('counter.feed.keyLabel')}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 w-full rounded-lg border border-border-primary bg-surface p-2 font-mono text-xs text-text-primary"
                />
              </label>
              <button
                type="submit"
                disabled={isKeySaving || !canPair}
                className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('counter.feed.saveKey')}
              </button>
              {isPaired && (
                <button
                  type="button"
                  onClick={() => void handleUnpair()}
                  className="rounded-lg border border-border-primary bg-surface px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                >
                  {t('counter.feed.unpair')}
                </button>
              )}
            </form>

            {keyError && <p role="alert" className="mt-2 text-[11px] text-error">{keyError}</p>}
            {!canPair && <p className="mt-2 text-[11px] text-text-tertiary">{t('counter.feed.desktopOnly')}</p>}
          </section>

          <section className="overflow-hidden rounded-xl border border-border-primary bg-surface">
            <div className="flex items-center gap-2 border-b border-border-secondary px-4 py-2.5">
              <Clock className="h-3.5 w-3.5 text-brand" />
              <h3 className="text-xs font-bold text-text-primary">
                {t('counter.ordersCount', { count: orders.length })}
              </h3>
            </div>
            {orders.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-text-secondary">{t('counter.empty')}</p>
            ) : (
              <ul>
                {orders.map(order => (
                  <CounterOrderRow key={order.id} order={order} />
                ))}
              </ul>
            )}
          </section>

          <p className="flex items-start gap-2 rounded-lg border border-border-primary bg-surface px-3 py-2.5 text-[11px] text-text-secondary">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            {t('counter.feedNote')}
          </p>
          <p className="flex items-start gap-2 rounded-lg border border-border-secondary bg-surface px-3 py-2.5 text-[11px] text-text-tertiary">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            {t('counter.lockNote')}
          </p>
        </div>
      </div>
    </div>
  );
};

const CounterOrderRow: React.FC<{ order: CounterInboxOrder }> = ({ order }) => {
  const { t } = useI18n();
  const tone = jobStatusTone(order.status);
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border-secondary px-4 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-text-primary">
          #{order.tokenCode} · {order.serviceLabelBn}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-text-secondary">
          <span className="truncate">{order.serviceLabel}</span>
          <span>· {formatJobTime(order.createdAt)}</span>
          <span>· {t(paymentLabelKey(order.paymentStatus))}</span>
          <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-text-tertiary">
            {t(order.source === 'master' ? 'counter.source.master' : 'counter.source.local')}
          </span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${TONE_CLASSES[tone]}`}>
          {t(jobStatusLabelKey(order.status))}
        </span>
        <p className="mt-1 font-mono text-xs font-semibold text-text-primary tabular-nums">৳{order.priceBDT}</p>
      </div>
    </li>
  );
};
