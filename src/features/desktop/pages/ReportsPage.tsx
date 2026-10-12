import React, { useState } from 'react';
import { BarChart3, CalendarDays, Clock3, Printer, TriangleAlert } from 'lucide-react';
import { useStudio } from '../../../shared/context/StudioContext';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { buildReportSummary } from '../../../shared/services/reportMetrics';

type ReportPeriod = 'today' | 'thisMonth';

export const ReportsPage: React.FC = () => {
  const { t, language } = useI18n();
  const { jobs, desktopQueueError } = useStudio();
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const summary = buildReportSummary(jobs, new Date())[period];
  const numberFormat = new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en-BD');
  const dateLabel = new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-BD', {
    dateStyle: 'long',
  }).format(new Date());

  const metrics = [
    {
      id: 'printed',
      label: t('reports.printedJobs'),
      value: numberFormat.format(summary.printedJobs),
      icon: <Printer className="h-5 w-5" />,
      iconClassName: 'bg-brand-soft text-brand',
    },
    {
      id: 'queued',
      label: t('reports.inQueue'),
      value: numberFormat.format(summary.queuedJobs),
      icon: <Clock3 className="h-5 w-5" />,
      iconClassName: 'bg-warning-bg text-warning',
    },
    {
      id: 'earnings',
      label: t('reports.completedValue'),
      value: `৳ ${numberFormat.format(summary.earningsBDT)}`,
      icon: <BarChart3 className="h-5 w-5" />,
      iconClassName: 'bg-success-bg text-success',
    },
  ];

  const pageTitle = period === 'today' ? t('reports.todayHeading') : t('reports.monthHeading');
  const pageSubtitle = period === 'today' ? t('reports.todaySubtitle') : t('reports.monthSubtitle');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-secondary bg-surface px-5 py-3">
        <BarChart3 className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-bold text-text-primary">{t('nav.reports')}</h2>
      </header>

      <nav
        aria-label={t('reports.periodNavigation')}
        className="flex shrink-0 border-b border-border-secondary bg-surface px-5"
      >
        <ReportTab
          label={t('reports.today')}
          active={period === 'today'}
          onClick={() => setPeriod('today')}
        />
        <ReportTab
          label={t('reports.thisMonth')}
          active={period === 'thisMonth'}
          onClick={() => setPeriod('thisMonth')}
        />
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-text-primary">{pageTitle}</h1>
              <p className="mt-1 text-xs text-text-secondary">{pageSubtitle}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <CalendarDays className="h-3.5 w-3.5" />
              {dateLabel}
            </div>
          </div>

          {desktopQueueError ? (
            <section
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-error bg-error-bg p-4 text-error"
            >
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold">{t('reports.queueErrorTitle')}</h3>
                <p className="mt-1 text-xs leading-relaxed">{t('reports.queueError')}</p>
              </div>
            </section>
          ) : (
            <>
              {summary.printedJobs === 0 && summary.queuedJobs === 0 && (
                <p className="mb-4 rounded-lg border border-border-primary bg-surface px-4 py-3 text-xs text-text-secondary">
                  {t('reports.empty')}
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                {metrics.map(metric => (
                  <section
                    key={metric.id}
                    className="rounded-xl border border-border-primary bg-surface p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-text-secondary">{metric.label}</span>
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${metric.iconClassName}`}>
                        {metric.icon}
                      </span>
                    </div>
                    <p className="mt-3 text-3xl font-bold tabular-nums text-text-primary">{metric.value}</p>
                  </section>
                ))}
              </div>
            </>
          )}

          <p className="mt-4 rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2.5 text-[11px] leading-relaxed text-text-secondary">
            {t('reports.localHistoryNote')}
          </p>
        </div>
      </main>
    </div>
  );
};

interface ReportTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const ReportTab: React.FC<ReportTabProps> = ({ label, active, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
      active
        ? 'border-brand text-brand'
        : 'border-transparent text-text-secondary hover:text-text-primary'
    }`}
  >
    {label}
  </button>
);
