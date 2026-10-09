import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChartColumn,
  Circle,
  Clock,
  EllipsisVertical,
  LayoutDashboard,
  Printer,
  Radio,
  RotateCw,
  Settings as SettingsIcon,
  Store
} from 'lucide-react';
import { useStudio } from '../../../shared/context/StudioContext';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { BRAND } from '../../../shared/config/brand';
import {
  formatJobTime,
  jobDisplayName,
  jobStatusLabelKey,
  jobStatusTone,
  startOfMonth,
  startOfToday
} from '../../../shared/services/jobDisplay';
import type { PrinterDevice } from '../../../shared/types';
import type { DesktopPage } from '../navigation';

const RECENT_JOB_LIMIT = 5;
const PRINTER_PREVIEW_LIMIT = 3;

const STATUS_TONE_CLASS: Record<ReturnType<typeof jobStatusTone>, string> = {
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-text-tertiary'
};

interface StatusPageProps {
  onNavigate: (page: DesktopPage) => void;
  onOpenPrinterSettings: () => void;
}

/**
 * Main status window from the design reference: connection + shop identity and
 * the printer fleet on the left, job overview and the recent-jobs table on the
 * right, action buttons at the bottom. All numbers come from the live studio
 * state and the desktop print queue — nothing here is mocked.
 */
export const StatusPage: React.FC<StatusPageProps> = ({ onNavigate, onOpenPrinterSettings }) => {
  const { t } = useI18n();
  const {
    shopProfile,
    printers,
    jobs,
    pendingJobsCount,
    todayPrintedCount,
    desktopQueueError,
    togglePrinterStatus,
    triggerTestPrint,
    scanLocalPrinters
  } = useStudio();

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [openPrinterMenuId, setOpenPrinterMenuId] = useState<string | null>(null);

  const thisMonthCount = useMemo(
    () => jobs.filter(job => job.status === 'completed' && startOfMonth() <= (job.completedAt ?? job.createdAt)).length,
    [jobs]
  );

  const todayCount = useMemo(
    () => jobs.filter(job => job.status === 'completed' && startOfToday() <= (job.completedAt ?? job.createdAt)).length,
    [jobs]
  );

  const recentJobs = useMemo(
    () => [...jobs].sort((a, b) => b.createdAt - a.createdAt).slice(0, RECENT_JOB_LIMIT),
    [jobs]
  );

  const refreshPrinters = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      await scanLocalPrinters();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsScanning(false);
    }
  };

  const statCards = [
    {
      key: 'pending',
      label: t('status.pending'),
      value: pendingJobsCount,
      icon: <Clock className="h-4 w-4" />,
      iconClass: 'bg-info-bg text-info',
      linkLabel: t('status.viewJobs'),
      target: 'dashboard' as DesktopPage
    },
    {
      key: 'today',
      label: t('status.today'),
      value: todayCount,
      icon: <CalendarDays className="h-4 w-4" />,
      iconClass: 'bg-success-bg text-success',
      linkLabel: t('status.viewReport'),
      target: 'reports' as DesktopPage
    },
    {
      key: 'month',
      label: t('status.thisMonth'),
      value: thisMonthCount,
      icon: <ChartColumn className="h-4 w-4" />,
      iconClass: 'bg-brand-soft text-brand',
      linkLabel: t('status.viewReport'),
      target: 'reports' as DesktopPage
    }
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-5 p-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Left column: connection, shop identity, printer fleet */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
              <Radio className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary">{t('status.connected')}</p>
              <p className="truncate text-xs text-text-secondary">
                {t('status.connectedDetail', { product: BRAND.productName })}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-border-primary bg-surface p-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Store className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text-primary">{shopProfile.name}</p>
                <span className="mt-1 inline-block rounded bg-brand px-2 py-0.5 font-mono text-[11px] font-semibold text-on-brand">
                  {shopProfile.code}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border-secondary pt-2.5 text-xs text-text-secondary">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{t('status.subscription')}</span>
              <span className="font-semibold text-brand">{t('status.subscriptionActive')}</span>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                {t('status.printers', { count: printers.length })}
              </h2>
              <button
                type="button"
                onClick={refreshPrinters}
                disabled={isScanning}
                aria-label={t('shell.help.printers')}
                title={t('shell.help.printers')}
                className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-brand disabled:opacity-50"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border-primary bg-surface shadow-sm">
              {printers.length === 0 ? (
                <p className="px-3.5 py-4 text-xs text-text-secondary">{t('status.printersEmpty')}</p>
              ) : (
                printers.slice(0, PRINTER_PREVIEW_LIMIT).map(printer => (
                  <PrinterRow
                    key={printer.id}
                    printer={printer}
                    isMenuOpen={openPrinterMenuId === printer.id}
                    onToggleMenu={() => setOpenPrinterMenuId(openPrinterMenuId === printer.id ? null : printer.id)}
                    onTestPrint={() => {
                      setOpenPrinterMenuId(null);
                      triggerTestPrint(printer.id);
                    }}
                    onToggleStatus={() => {
                      setOpenPrinterMenuId(null);
                      togglePrinterStatus(printer.id);
                    }}
                    onOpenSettings={() => {
                      setOpenPrinterMenuId(null);
                      onOpenPrinterSettings();
                    }}
                  />
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('printers')}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand transition-colors hover:text-brand-hover"
            >
              {t('status.viewAllPrinters')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            {scanError && <p role="alert" className="mt-2 text-[11px] text-error">{scanError}</p>}
          </section>
        </div>

        {/* Right column: overview, recent jobs, actions */}
        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {t('status.overview')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {statCards.map(card => (
                <div key={card.key} className="rounded-xl border border-border-primary bg-surface p-3.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${card.iconClass}`}>
                      {card.icon}
                    </span>
                    <span className="text-xs font-medium text-text-secondary">{card.label}</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">{card.value}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate(card.target)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand transition-colors hover:text-brand-hover"
                  >
                    {card.linkLabel}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                {t('status.recentJobs')}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('jobs')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand transition-colors hover:text-brand-hover"
              >
                {t('status.viewAllJobs')}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border-primary bg-surface shadow-sm">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border-secondary text-[11px] uppercase tracking-wide text-text-tertiary">
                    <th scope="col" className="px-3.5 py-2 font-semibold">{t('status.table.jobName')}</th>
                    <th scope="col" className="px-3.5 py-2 font-semibold">{t('status.table.printer')}</th>
                    <th scope="col" className="px-3.5 py-2 font-semibold">{t('status.table.status')}</th>
                    <th scope="col" className="px-3.5 py-2 font-semibold">{t('status.table.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3.5 py-4 text-xs text-text-secondary">
                        {desktopQueueError ? t('status.jobsError') : t('status.jobsEmpty')}
                      </td>
                    </tr>
                  ) : (
                    recentJobs.map(job => (
                      <tr key={job.id} className="border-b border-border-secondary last:border-0">
                        <td className="max-w-[220px] truncate px-3.5 py-2 text-xs text-text-primary">
                          {jobDisplayName(job, t('job.nidPhoto'))}
                        </td>
                        <td className="px-3.5 py-2 text-xs text-text-secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 text-text-tertiary" />
                            <span className="max-w-[180px] truncate">{job.targetPrinterName}</span>
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-xs text-text-secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${STATUS_TONE_CLASS[jobStatusTone(job.status)]}`} />
                            {t(jobStatusLabelKey(job.status))}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2 text-xs tabular-nums text-text-secondary">
                          {formatJobTime(job.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {t('status.openDashboard')}
            </button>
            <button
              type="button"
              onClick={onOpenPrinterSettings}
              className="inline-flex items-center gap-2 rounded-lg border border-border-primary bg-surface px-4 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
            >
              <Printer className="h-3.5 w-3.5" />
              {t('status.printerSettings')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="inline-flex items-center gap-2 rounded-lg border border-border-primary bg-surface px-4 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              {t('status.shop')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PrinterRowProps {
  printer: PrinterDevice;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onTestPrint: () => void;
  onToggleStatus: () => void;
  onOpenSettings: () => void;
}

const PrinterRow: React.FC<PrinterRowProps> = ({
  printer,
  isMenuOpen,
  onToggleMenu,
  onTestPrint,
  onToggleStatus,
  onOpenSettings
}) => {
  const { t } = useI18n();
  const isOnline = printer.status === 'online';

  return (
    <div className="flex items-center gap-3 border-b border-border-secondary px-3.5 py-2.5 last:border-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
        <Printer className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-text-primary">{printer.name}</p>
        <p className="truncate text-[11px] text-text-tertiary">{printer.model}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-text-secondary">
        <Circle className={`h-2 w-2 ${isOnline ? 'fill-success text-success' : 'fill-text-tertiary text-text-tertiary'}`} />
        {isOnline ? t('printer.online') : t('printer.offline')}
      </span>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label={t('printer.menu')}
          aria-expanded={isMenuOpen}
          className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
        {isMenuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border-primary bg-surface-elevated py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={onTestPrint}
              className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
            >
              {t('printer.menu.testPrint')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onToggleStatus}
              className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
            >
              {isOnline ? t('printer.menu.setOffline') : t('printer.menu.setOnline')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onOpenSettings}
              className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
            >
              {t('printer.menu.viewPrinters')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
