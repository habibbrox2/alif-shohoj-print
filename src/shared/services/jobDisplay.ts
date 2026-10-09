import type { TranslationKey } from '../i18n/strings';
import type { JobStatus, PrintJob } from '../types';

/**
 * Identity documents must never expose their real upload file name in the
 * operator UI, so NID / smart-card / passport jobs fall back to their service
 * label while ordinary documents keep their file name.
 */
const IDENTITY_SERVICE_PATTERN = /nid|smart[_\s-]?card|national[_\s-]?id|passport/i;

export const isIdentityDocument = (job: PrintJob): boolean =>
  IDENTITY_SERVICE_PATTERN.test(job.serviceType) || IDENTITY_SERVICE_PATTERN.test(job.fileName);

/** PDF jobs cannot be previewed as an image, so the UI shows a document state. */
export const isPdfJob = (job: PrintJob): boolean =>
  job.fileUrl.startsWith('data:application/pdf') || /\.pdf(?:$|[?#])/i.test(job.fileName);

export const jobDisplayName = (job: PrintJob, identityLabel: string): string => {
  if (isIdentityDocument(job)) return job.serviceLabel || identityLabel;
  return job.fileName || job.serviceLabel || identityLabel;
};

export type JobStatusTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

/**
 * Label key for a job status. All pre-print states read as "Pending" to the
 * operator, who only cares whether the order still needs attention.
 */
export const jobStatusLabelKey = (status: JobStatus): TranslationKey => {
  switch (status) {
    case 'completed':
      return 'job.status.printed';
    case 'failed':
      return 'job.status.failed';
    case 'printing':
      return 'job.status.printing';
    case 'rejected':
      return 'job.status.rejected';
    default:
      return 'job.status.pending';
  }
};

export const jobStatusTone = (status: JobStatus): JobStatusTone => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'rejected':
      return 'neutral';
    case 'printing':
      return 'info';
    default:
      return 'warning';
  }
};

/** `10:24 AM` — the reference design shows a short 12-hour time. */
export const formatJobTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

export const startOfToday = (now: number = Date.now()): number => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const startOfMonth = (now: number = Date.now()): number => {
  const date = new Date(now);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
