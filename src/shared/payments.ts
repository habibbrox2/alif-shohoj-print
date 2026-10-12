/**
 * Counter cash (staff confirms the money at the counter) is the only payment
 * method the app settles today. bKash/Nagad stay recognized so an unverified
 * MFS request is rejected loudly instead of being recorded as paid.
 *
 * When a merchant MFS provider is integrated, add the settled method here and
 * extend the payment store with the provider reference it needs.
 */
export type PaymentMethod = 'counter_cash';
export type DeferredPaymentMethod = 'bkash' | 'nagad';
export type RequestedPaymentMethod = PaymentMethod | DeferredPaymentMethod;
export type PaymentStatus = 'pending' | 'confirmed' | 'failed';
export type PaymentCurrency = 'BDT';

export interface CreatePaymentInput {
  jobId: string;
  method: RequestedPaymentMethod;
  amountBdt: number;
  currency: PaymentCurrency;
  idempotencyKey: string;
}

export interface ConfirmCashPaymentInput {
  paymentTransactionId: string;
  confirmedBy: string;
}

export interface PaymentTransaction {
  id: string;
  jobId: string;
  method: PaymentMethod;
  amountBdt: number;
  currency: PaymentCurrency;
  status: PaymentStatus;
  idempotencyKey: string;
  confirmedBy: string | null;
  confirmedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  value === 'counter_cash';

export const isDeferredPaymentMethod = (value: unknown): value is DeferredPaymentMethod =>
  value === 'bkash' || value === 'nagad';

export const isPaymentAmountBdt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export const isPaymentIdentifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 200 &&
  value.trim() === value &&
  !/[\u0000-\u001f\u007f]/.test(value);
