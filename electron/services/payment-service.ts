import {
  isDeferredPaymentMethod,
  isPaymentAmountBdt,
  isPaymentIdentifier,
  isPaymentMethod,
  type ConfirmCashPaymentInput,
  type CreatePaymentInput,
  type PaymentMethod,
  type PaymentTransaction,
  type RequestedPaymentMethod,
} from '../../src/shared/payments.js';
import { PaymentStore, PaymentValidationError } from './payment-store.js';

/**
 * Cash-counter payment policy. No provider adapter exists yet: a payment stays
 * pending until staff confirm the cash was collected, and the deferred
 * bKash/Nagad methods are rejected instead of being recorded as paid.
 */
export class PaymentService {
  constructor(private readonly store: PaymentStore) {}

  createPayment(input: CreatePaymentInput): PaymentTransaction {
    validateCreateInput(input);
    const { payment } = this.store.reservePayment({
      jobId: input.jobId,
      method: supportedMethod(input.method),
      amountBdt: input.amountBdt,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    });
    return payment;
  }

  confirmCashPayment(input: ConfirmCashPaymentInput): PaymentTransaction {
    if (!input || typeof input !== 'object') {
      throw new PaymentValidationError('Cash confirmation request is required.');
    }
    return this.store.confirmPayment(input.paymentTransactionId, input.confirmedBy);
  }

  failPayment(paymentTransactionId: string): PaymentTransaction {
    if (!isPaymentIdentifier(paymentTransactionId)) {
      throw new PaymentValidationError('Payment transaction ID is invalid.');
    }
    return this.store.failPayment(paymentTransactionId);
  }

  getPayment(paymentTransactionId: string): PaymentTransaction | null {
    return this.store.getPayment(paymentTransactionId);
  }
}

const validateCreateInput = (input: CreatePaymentInput): void => {
  if (!input || typeof input !== 'object') throw new PaymentValidationError('Payment request is required.');
  if (!isPaymentIdentifier(input.jobId)) throw new PaymentValidationError('Job ID is invalid.');
  if (!isPaymentIdentifier(input.idempotencyKey)) {
    throw new PaymentValidationError('Payment idempotency key is invalid.');
  }
  supportedMethod(input.method);
  if (!isPaymentAmountBdt(input.amountBdt)) {
    throw new PaymentValidationError('Payment amount must be a positive whole BDT amount.');
  }
  if (input.currency !== 'BDT') throw new PaymentValidationError('Only BDT payments are supported.');
};

const supportedMethod = (method: RequestedPaymentMethod): PaymentMethod => {
  if (isPaymentMethod(method)) return method;
  if (isDeferredPaymentMethod(method)) {
    throw new PaymentValidationError('bKash/Nagad payments will be available in a future version.');
  }
  throw new PaymentValidationError('A supported payment method is required.');
};
