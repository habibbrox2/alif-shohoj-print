import type { CounterFeedOrder } from './counterFeed';
import type { JobStatus, PaymentStatus, PrintJob } from '../types';

export const COUNTER_INBOX_LIMIT = 100;

/**
 * Rows of the counter inbox. A counter PC shows rows from two places: the
 * orders it happens to hold locally, and the live feed published by the master
 * PC. Both collapse into this display shape, which is all the operator needs.
 */
export interface CounterInboxOrder {
  id: string;
  counterId: string;
  tokenCode: string;
  serviceLabel: string;
  serviceLabelBn: string;
  status: JobStatus;
  paymentStatus: PaymentStatus;
  priceBDT: number;
  createdAt: number;
  source: 'local' | 'master';
}

/**
 * Orders that belong to one counter, newest first. A counter operator only ever
 * sees their own counter's orders, so this is the single place that decides what
 * the counter inbox may list.
 */
export const counterOrders = (jobs: PrintJob[], counterId: string): PrintJob[] => {
  if (!counterId) return [];
  return jobs
    .filter(job => job.counterId === counterId)
    .sort((left, right) => right.createdAt - left.createdAt);
};

export const toCounterInboxOrder = (job: PrintJob): CounterInboxOrder => ({
  id: job.id,
  counterId: job.counterId ?? '',
  tokenCode: job.tokenCode,
  serviceLabel: job.serviceLabel,
  serviceLabelBn: job.serviceLabelBn,
  status: job.status,
  paymentStatus: job.paymentStatus,
  priceBDT: job.priceBDT,
  createdAt: job.createdAt,
  source: 'local',
});

const fromFeedOrder = (order: CounterFeedOrder): CounterInboxOrder => ({
  id: order.id,
  counterId: order.counterId,
  tokenCode: order.tokenCode,
  serviceLabel: order.serviceLabel,
  serviceLabelBn: order.serviceLabelBn,
  status: order.status,
  paymentStatus: order.paymentStatus,
  priceBDT: order.priceBDT,
  createdAt: order.createdAt,
  source: 'master',
});

/**
 * Combines this PC's local rows with the master feed. The master PC owns the
 * print lifecycle, so when both sides know an order the master row wins: it is
 * never a stale copy. Local rows without a feed counterpart are kept, because
 * the counter PC may still hold an order the master has since deleted.
 */
export const mergeCounterInbox = (
  jobs: PrintJob[],
  feedOrders: CounterFeedOrder[],
  counterId: string,
): CounterInboxOrder[] => {
  if (!counterId) return [];
  const feedRows = feedOrders.filter(order => order.counterId === counterId);
  const feedIds = new Set(feedRows.map(order => order.id));
  const localRows = counterOrders(jobs, counterId)
    .filter(job => !feedIds.has(job.id))
    .map(toCounterInboxOrder);
  return [...feedRows.map(fromFeedOrder), ...localRows]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, COUNTER_INBOX_LIMIT);
};

export interface CounterOrderSummary {
  active: number;
  printed: number;
  rejected: number;
}

/** Counts for the counter inbox header; failed jobs stay visible under active. */
export const summarizeCounterOrders = (orders: { status: JobStatus }[]): CounterOrderSummary => {
  let active = 0;
  let printed = 0;
  let rejected = 0;
  for (const order of orders) {
    if (order.status === 'completed') printed += 1;
    else if (order.status === 'rejected') rejected += 1;
    else active += 1;
  }
  return { active, printed, rejected };
};
