// `.js` specifiers keep this module importable by both the Vite renderer and the
// NodeNext-compiled Electron services.
import type { JobStatus, PaymentStatus, PrintJob } from '../types.js';

/** Gateway route a counter PC polls for its own orders. */
export const COUNTER_FEED_PATH = '/api/counter-orders';
/** Header carrying the per-counter feed key; treated as a password everywhere. */
export const COUNTER_FEED_KEY_HEADER = 'x-counter-feed-key';
/** Feed keys are 32 random bytes in hex, the same shape as the WebSocket token. */
export const COUNTER_FEED_KEY_PATTERN = /^[0-9a-f]{64}$/;
/** Counter IDs come from the shop's counter list and are validated before any feed lookup. */
export const COUNTER_ID_PATTERN = /^CTR-[A-Z0-9-]{1,32}$/i;
export const COUNTER_FEED_MAX_ORDERS = 100;

/**
 * One order as the master PC publishes it to a counter PC.
 *
 * Deliberately narrow. The counter operator only needs what the customer asks
 * about at the desk, so customer identity, the uploaded document (`fileUrl`) and
 * the upload file name never leave the master PC — which is also the only
 * machine that prints. Adding a field here widens what a counter PC can read.
 */
export interface CounterFeedOrder {
  id: string;
  counterId: string;
  tokenCode: string;
  serviceType: string;
  serviceLabel: string;
  serviceLabelBn: string;
  paperSize: string;
  copies: number;
  status: JobStatus;
  paymentStatus: PaymentStatus;
  priceBDT: number;
  createdAt: number;
  completedAt?: number;
}

/**
 * The complete field list a counter PC may receive. The master gateway tests
 * assert against this, so adding a field to the feed is a visible decision.
 */
export const COUNTER_FEED_FIELDS: readonly string[] = [
  'id',
  'counterId',
  'tokenCode',
  'serviceType',
  'serviceLabel',
  'serviceLabelBn',
  'paperSize',
  'copies',
  'status',
  'paymentStatus',
  'priceBDT',
  'createdAt',
  'completedAt',
];

const JOB_STATUSES: readonly JobStatus[] = ['queued', 'approved', 'routing', 'printing', 'completed', 'rejected', 'failed'];
const PAYMENT_STATUSES: readonly PaymentStatus[] = ['unpaid', 'paid_counter', 'paid_mfs'];

/** Projects a stored master job onto the fields a counter PC may see. */
export const toCounterFeedOrder = (job: PrintJob): CounterFeedOrder | null => {
  if (!job.counterId) return null;
  const order: CounterFeedOrder = {
    id: job.id,
    counterId: job.counterId,
    tokenCode: job.tokenCode,
    serviceType: job.serviceType,
    serviceLabel: job.serviceLabel,
    serviceLabelBn: job.serviceLabelBn,
    paperSize: job.paperSize,
    copies: job.copies,
    status: job.status,
    paymentStatus: job.paymentStatus,
    priceBDT: job.priceBDT,
    createdAt: job.createdAt,
  };
  if (typeof job.completedAt === 'number' && Number.isFinite(job.completedAt)) {
    order.completedAt = job.completedAt;
  }
  return order;
};

const isNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maxLength;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isCounterFeedOrder = (value: unknown): value is CounterFeedOrder => {
  if (!value || typeof value !== 'object') return false;
  const order = value as Partial<CounterFeedOrder>;
  return isNonEmptyString(order.id, 128) &&
    isNonEmptyString(order.counterId, 40) &&
    isNonEmptyString(order.tokenCode, 32) &&
    isNonEmptyString(order.serviceType, 128) &&
    isNonEmptyString(order.serviceLabel, 160) &&
    isNonEmptyString(order.serviceLabelBn, 200) &&
    isNonEmptyString(order.paperSize, 64) &&
    Number.isInteger(order.copies) && (order.copies as number) > 0 && (order.copies as number) <= 100 &&
    JOB_STATUSES.includes(order.status as JobStatus) &&
    PAYMENT_STATUSES.includes(order.paymentStatus as PaymentStatus) &&
    isFiniteNumber(order.priceBDT) && order.priceBDT >= 0 &&
    isFiniteNumber(order.createdAt) &&
    (order.completedAt === undefined || isFiniteNumber(order.completedAt));
};

/** Orders older than this are dropped from a counter PC's in-memory feed. */
export const COUNTER_FEED_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Folds a freshly pulled page into the feed this counter PC already holds.
 * The master PC is authoritative, so a pulled row always replaces the copy of
 * the same order — including status changes that keep the same `createdAt`.
 */
export const mergeFeedOrders = (
  current: CounterFeedOrder[],
  incoming: CounterFeedOrder[],
  now: number = Date.now(),
): CounterFeedOrder[] => {
  const byId = new Map<string, CounterFeedOrder>();
  for (const order of current) byId.set(order.id, order);
  for (const order of incoming) byId.set(order.id, order);
  return [...byId.values()]
    .filter(order => order.createdAt >= now - COUNTER_FEED_RETENTION_MS)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, COUNTER_FEED_MAX_ORDERS);
};

/**
 * Validates an untrusted feed response from the master PC. Returns `null` for a
 * payload this app does not understand so the caller can report a protocol
 * error instead of quietly showing a half-read list.
 */
export const parseCounterFeedOrders = (payload: unknown): CounterFeedOrder[] | null => {
  if (!payload || typeof payload !== 'object') return null;
  const orders = (payload as { orders?: unknown }).orders;
  if (!Array.isArray(orders) || orders.length > COUNTER_FEED_MAX_ORDERS) return null;
  if (!orders.every(isCounterFeedOrder)) return null;
  return orders;
};
