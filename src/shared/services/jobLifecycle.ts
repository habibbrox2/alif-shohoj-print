import type { PrintJob, RejectReason } from '../types';

/**
 * Pure job-state transitions extracted from `StudioContext` (audit improvements
 * #6 and #7): the lifecycle rules are now plain functions that can be unit
 * tested without mounting React, and the provider only wires them into state.
 */

/** Shopkeeper approves a pending order. */
export const approveJobTransition = (job: PrintJob, now: number): PrintJob => ({
  ...job,
  status: 'approved',
  auditLogs: [
    ...job.auditLogs,
    {
      id: `log_${now}_approve`,
      timestamp: now,
      actor: 'shopkeeper',
      action: 'order_approved',
      details: 'Manual approval by shopkeeper',
    },
  ],
});

/** Shopkeeper rejects an order; it keeps a short retention window. */
export const rejectJobTransition = (
  job: PrintJob,
  reason: RejectReason,
  note: string | undefined,
  now: number
): PrintJob => ({
  ...job,
  status: 'rejected',
  rejectReason: reason,
  rejectNote: note,
  autoDeleteCountdownSeconds: 120, // Shortened retention on reject
  auditLogs: [
    ...job.auditLogs,
    {
      id: `log_${now}_reject`,
      timestamp: now,
      actor: 'shopkeeper',
      action: 'order_rejected',
      details: `Rejected due to ${reason}. ${note || ''}`,
    },
  ],
});

/**
 * One tick of the 1 s retention countdown (BUG-006).
 *
 * Only jobs that are actually eligible for deletion (completed/rejected) tick —
 * pending orders never show a dead "00:00 auto-delete" countdown. Returns the
 * input array untouched when nothing eligible is present so the ticker causes
 * no re-render on ticks that change nothing.
 */
export const tickJobRetention = (jobs: PrintJob[]): PrintJob[] => {
  let changed = false;
  const next = jobs.map(job => {
    if (job.status !== 'completed' && job.status !== 'rejected') return job;
    const nextTime = job.autoDeleteCountdownSeconds - 1;
    if (nextTime >= job.autoDeleteCountdownSeconds) return job;
    changed = true;
    return {
      ...job,
      autoDeleteCountdownSeconds: nextTime > 0 ? nextTime : 0,
    };
  });
  if (!changed) return jobs;
  return next.filter(job => {
    // If countdown hits 0 and status is completed or rejected, auto-delete from memory
    if (job.autoDeleteCountdownSeconds <= 1 && (job.status === 'completed' || job.status === 'rejected')) {
      return false;
    }
    return true;
  });
};

/**
 * Jobs that completed during this session and have not been counted into the
 * counter stats yet (BUG-007). `completedAt < since` skips jobs rehydrated from
 * the desktop queue so persisted stats are never double-counted across restarts.
 */
export const collectNewlyCompleted = (
  jobs: PrintJob[],
  alreadyCounted: ReadonlySet<string>,
  since: number
): PrintJob[] =>
  jobs.filter(job =>
    job.status === 'completed' &&
    typeof job.completedAt === 'number' &&
    job.completedAt >= since &&
    !alreadyCounted.has(job.id)
  );
