import React, { memo } from 'react';
import { BarChart3, CalendarDays, FileText, TrendingUp, Users } from 'lucide-react';
import { useI18n } from '../../../shared/i18n/I18nContext';
import type { TranslationKey } from '../../../shared/i18n/strings';

type ReportTabKey = 'today' | 'thisMonth';

interface ReportTabButtonProps {
  activeKey: ReportTabKey;
  labelKey: TranslationKey;
}

/** Placeholder page for the Reports tab. The real Today / This Month reporting
 * lands in a later step, but the two summary tabs and the report header already
 * exist so the shell can route here without a dead page.
 */
export const ReportsPage: React.FC = () => {
  const { t } = useI18n();

  const today = (value: number, suffix: string) => (
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-bold tabular-nums text-text-primary">{value}</span>
      <span className="text-[13px] font-semibold text-text-secondary">{suffix}</span>
    </div>
  );

  const todayStats = [
    { label: t('upcoming.reports.today.printed'), icon: <CalendarDays className="h-4 w-4" />, valueRow: today(0, 'jobs') },
    { label: t('upcoming.reports.today.inQueue'), icon: <FileText className="h-4 w-4" />, valueRow: today(0, 'jobs') },
    { label: t('upcoming.reports.today.earnings'), icon: <Users className="h-4 w-4" />, valueRow: today(0, '৳') },
  ];

  const thisMonthStats = [
    { label: t('upcoming.reports.month.printed'), icon: <TrendingUp className="h-4 w-4" />, valueRow: today(0, 'jobs') },
    { label: t('upcoming.reports.month.earnings'), icon: <BarChart3 className="h-4 w-4" />, valueRow: today(0, '৳') },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-secondary bg-surface px-4 py-2">
        <BarChart3 className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-bold text-text-primary">{t('nav.reports')}</h2>
        <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">
          {t('upcoming.title')}
        </span>
      </div>

      <div className="flex shrink-0 border-b border-border-secondary bg-surface">
        <ReportTabButton activeKey="today" labelKey="upcoming.reports.today.heading" />
        <ReportTabButton activeKey="thisMonth" labelKey="upcoming.reports.thisMonth.heading" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-5xl gap-4">
          <section className="rounded-xl border border-border-primary bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">{t('upcoming.reports.today.heading')}</h3>
                <p className="mt-0.5 text-[11px] text-text-secondary">{t('upcoming.reports.today.sub')}</p>
              </div>
              <div className="h-8 w-8 shrink-0 rounded-full bg-success-bg text-success flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {todayStats.map(stat => (
                <div key={stat.label} className="flex items-center gap-3 rounded-lg bg-bg-secondary px-3 py-2.5 text-sm">
                  <span className="shrink-0 rounded-full bg-surface text-text-secondary flex items-center justify-center p-1">
                    {stat.icon}
                  </span>
                  <span className="text-xs text-text-secondary">{stat.label}</span>
                  <div className="ml-auto">{stat.valueRow}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border-primary bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">{t('upcoming.reports.thisMonth.heading')}</h3>
                <p className="mt-0.5 text-[11px] text-text-secondary">{t('upcoming.reports.thisMonth.sub')}</p>
              </div>
              <div className="h-8 w-8 shrink-0 rounded-full bg-brand-soft text-brand flex items-center justify-center">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {thisMonthStats.map(stat => (
                <div key={stat.label} className="flex items-center gap-3 rounded-lg bg-bg-secondary px-3 py-2.5 text-sm">
                  <span className="shrink-0 rounded-full bg-surface text-text-secondary flex items-center justify-center p-1">
                    {stat.icon}
                  </span>
                  <span className="text-xs text-text-secondary">{stat.label}</span>
                  <div className="ml-auto">{stat.valueRow}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const ReportTabButton: React.FC<ReportTabButtonProps> = memo(({ activeKey, labelKey }) => {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`flex-1 border-b-2 px-4 py-2 text-left text-xs font-semibold transition-colors ${
        activeKey === 'today'
          ? 'border-brand text-brand'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      {t(labelKey)}
    </button>
  );
});

ReportTabButton.displayName = 'ReportTabButton';
