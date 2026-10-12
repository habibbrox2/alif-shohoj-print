import type { PrintJob } from '../types';

export interface ReportPeriodSummary {
  printedJobs: number;
  queuedJobs: number;
  earningsBDT: number;
}

export interface ReportSummary {
  today: ReportPeriodSummary;
  thisMonth: ReportPeriodSummary;
}

const IN_QUEUE_STATUSES: ReadonlySet<PrintJob['status']> = new Set([
  'queued',
  'approved',
  'routing',
  'printing',
  'failed',
]);

const isWithinPeriod = (timestamp: number | undefined, start: number, end: number): boolean =>
  typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= start && timestamp < end;

const summarizePeriod = (jobs: readonly PrintJob[], start: number, end: number): ReportPeriodSummary => {
  const summary: ReportPeriodSummary = { printedJobs: 0, queuedJobs: 0, earningsBDT: 0 };

  for (const job of jobs) {
    if (job.status === 'completed' && isWithinPeriod(job.completedAt, start, end)) {
      summary.printedJobs += 1;
      summary.earningsBDT += job.priceBDT;
    } else if (IN_QUEUE_STATUSES.has(job.status) && isWithinPeriod(job.createdAt, start, end)) {
      summary.queuedJobs += 1;
    }
  }

  return summary;
};

export const buildReportSummary = (jobs: readonly PrintJob[], now: Date): ReportSummary => {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  return {
    today: summarizePeriod(jobs, todayStart, tomorrowStart),
    thisMonth: summarizePeriod(jobs, monthStart, nextMonthStart),
  };
};
