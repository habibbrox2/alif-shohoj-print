import React, { useMemo, useState } from 'react';
import { Clock, Filter, LayoutList, CalendarDays, Printer } from 'lucide-react';
import { useI18n } from '../../../shared/i18n/I18nContext';
import type { TranslationKey } from '../../../shared/i18n/strings';
import type { DesktopPage } from '../navigation';
import type { JobStatusFilter, DateRangeFilter, PrinterFilter } from './JobsPageTypes';

interface JobFilters {
  status: JobStatusFilter;
  printer: PrinterFilter;
  dateRange: DateRangeFilter;
}

/** Placeholder page for the Jobs tab. The real print job list arrives in a later
 * step, but this page already owns the three filters the design calls for so the
 * desktop shell can route to Jobs without breaking the workflow.
 */
export const JobsPage: React.FC<{ onNavigate: (page: DesktopPage) => void }> = ({ onNavigate }) => {
  const { t } = useI18n();
  const [filters, setFilters] = useState<JobFilters>({
    status: 'all',
    printer: 'all',
    dateRange: 'today',
  });



  const statusOptions: { value: JobStatusFilter; label: TranslationKey }[] = [
    { value: 'all', label: 'dashboard.allCounters' },
    { value: 'pending', label: 'status.pending' },
    { value: 'printing', label: 'job.status.printing' },
    { value: 'completed', label: 'job.status.printed' },
    { value: 'failed', label: 'job.status.failed' },
    { value: 'rejected', label: 'job.status.rejected' },
  ];

  const printerOptions = [
    { value: 'all' as const, label: t('status.viewAllPrinters') },
    { value: 'assigned' as const, label: t('status.printers') },
  ];

  const dateRangeOptions: { value: DateRangeFilter; label: TranslationKey }[] = [
    { value: 'today', label: 'status.today' },
    { value: 'thisWeek', label: 'upcoming.dateRange.thisWeek' },
    { value: 'thisMonth', label: 'status.thisMonth' },
    { value: 'all', label: 'dashboard.allCounters' },
  ];

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count += 1;
    if (filters.printer !== 'all') count += 1;
    if (filters.dateRange !== 'today') count += 1;
    return count;
  }, [filters.status, filters.printer, filters.dateRange]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-secondary bg-surface px-4 py-2">
        <Clock className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-bold text-text-primary">{t('nav.jobs')}</h2>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-text-tertiary">
          <Filter className="h-3.5 w-3.5" />
          {activeFilterCount > 0 ? ` filters applied (${activeFilterCount})` : 'no active filters'}
        </span>
      </div>

      <FilterPanel
        disabled={false}
        statusOptions={statusOptions}
        statusValue={filters.status}
        onStatusChange={value => setFilters(f => ({ ...f, status: value }))}
        dateRangeOptions={dateRangeOptions}
        dateRangeValue={filters.dateRange}
        onDateRangeChange={value => setFilters(f => ({ ...f, dateRange: value }))}
        printerOptions={printerOptions}
        printerValue={filters.printer}
        onPrinterChange={value => setFilters(f => ({ ...f, printer: value }))}
        onClearFilters={() => setFilters({ status: 'all', printer: 'all', dateRange: 'today' })}
      />

      <div className="flex-1 overflow-y-auto p-4">
        <EmptyJobList filters={filters} />
      </div>
    </div>
  );
};

interface FilterPanelProps {
  disabled: boolean;
  statusOptions: { value: JobStatusFilter; label: TranslationKey }[];
  statusValue: JobStatusFilter;
  onStatusChange: (value: JobStatusFilter) => void;
  dateRangeOptions: { value: DateRangeFilter; label: TranslationKey }[];
  dateRangeValue: DateRangeFilter;
  onDateRangeChange: (value: DateRangeFilter) => void;
  printerOptions: { value: PrinterFilter; label: string }[];
  printerValue: PrinterFilter;
  onPrinterChange: (value: PrinterFilter) => void;
  onClearFilters: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  disabled,
  statusOptions,
  statusValue,
  onStatusChange,
  dateRangeOptions,
  dateRangeValue,
  onDateRangeChange,
  printerOptions,
  printerValue,
  onPrinterChange,
  onClearFilters
}) => {
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-secondary bg-surface px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-text-tertiary" id="job-status-label">{t('status.table.status')}</span>
        <div className="inline-flex rounded-lg border border-border-primary bg-surface-elevated py-1 shadow-sm" role="group" aria-labelledby="job-status-label">
          {statusOptions.map(option => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onStatusChange(option.value)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                statusValue === option.value
                  ? 'bg-brand text-on-brand'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              } ${disabled ? 'opacity-50' : ''}`}
              aria-pressed={statusValue === option.value}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-text-tertiary" id="job-printer-label">{t('status.table.printer')}</span>
        <div className="inline-flex rounded-lg border border-border-primary bg-surface-elevated py-1 shadow-sm" role="group" aria-labelledby="job-printer-label">
          {printerOptions.map(option => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onPrinterChange(option.value)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                printerValue === option.value
                  ? 'bg-brand text-on-brand'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              } ${disabled ? 'opacity-50' : ''}`}
              aria-pressed={printerValue === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-text-tertiary" id="job-date-range-label">{t('status.table.time')}</span>
        <div className="inline-flex rounded-lg border border-border-primary bg-surface-elevated py-1 shadow-sm" role="group" aria-labelledby="job-date-range-label">
          {dateRangeOptions.map(option => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onDateRangeChange(option.value)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                dateRangeValue === option.value
                  ? 'bg-brand text-on-brand'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              } ${disabled ? 'opacity-50' : ''}`}
              aria-pressed={dateRangeValue === option.value}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onClearFilters}
        className={`text-[11px] font-semibold transition-colors ${
          !disabled ? 'text-brand hover:text-brand-hover' : 'text-text-tertiary opacity-50'
        }`}
        aria-label="Clear all filters"
      >
        Clear filters
      </button>
    </div>
  );
};

/** Placeholder list when the real Jobs data is not present. */
const EmptyJobList: React.FC<{ filters: JobFilters }> = ({ filters }) => {
  const { t } = useI18n();
  const { status, printer, dateRange } = filters;

  const emptyMessage = useMemo(() => {
    const parts: string[] = [];
    if (status !== 'all') parts.push(t(status as unknown as TranslationKey));
    if (printer !== 'all') parts.push(printer === 'assigned' ? t('status.printers') : t('status.table.printer'));
    if (dateRange !== 'today') parts.push(t(dateRange as unknown as TranslationKey));
    return parts;
  }, [status, printer, dateRange, t]);

  return (
    <div className="m-auto rounded-xl border border-border-primary bg-surface px-4 py-6 text-center text-xs text-text-secondary shadow-sm">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
        <LayoutList className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-text-primary">{t('upcoming.title')}</p>
      <p className="mt-1 max-w-sm text-text-secondary">
        {t('upcoming.jobs')}
      </p>
      {emptyMessage.length > 0 && (
        <p className="mt-3 text-[11px] text-brand">
          Showing: {emptyMessage.join(' · ')}
        </p>
      )}
      <p className="mt-3 font-mono text-[11px] text-text-tertiary">Step 6 — filter UI live, data source TBD</p>
    </div>
  );
};

