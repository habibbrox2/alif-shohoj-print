import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { CreatePaymentInput, DeferredPaymentMethod } from '../../../src/shared/payments.js';
import {
  PaymentIdempotencyError,
  PaymentStore,
  PaymentTransitionError,
  PaymentValidationError,
} from '../payment-store.js';
import { PaymentService } from '../payment-service.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));

const withStore = async (
  run: (store: PaymentStore, databasePath: string) => Promise<void> | void
): Promise<void> => {
  const directory = mkdtempSync(join(testDirectory, '.payment-service-test-'));
  const databasePath = join(directory, 'payments.sqlite');
  const store = new PaymentStore(databasePath);
  try {
    await run(store, databasePath);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
};

const paymentInput = (overrides: Partial<CreatePaymentInput> = {}): CreatePaymentInput => ({
  jobId: 'job-1',
  method: 'counter_cash',
  amountBdt: 250,
  currency: 'BDT',
  idempotencyKey: 'payment-job-1',
  ...overrides,
});

test('rejects fractional, non-positive, and non-BDT payment amounts', async () => {
  await withStore(async store => {
    const service = new PaymentService(store);
    assert.throws(() => service.createPayment(paymentInput({ amountBdt: 1.5 })), PaymentValidationError);
    assert.throws(() => service.createPayment(paymentInput({ amountBdt: 0 })), PaymentValidationError);
    assert.throws(
      () => service.createPayment(paymentInput({ currency: 'USD' as 'BDT' })),
      PaymentValidationError
    );
    assert.throws(() => service.createPayment(paymentInput({ jobId: '  ' })), PaymentValidationError);
    assert.throws(
      () => service.createPayment(paymentInput({ idempotencyKey: 'key\n1' })),
      PaymentValidationError
    );
    assert.equal(store.getPaymentByIdempotencyKey('payment-job-1'), null);
  });
});

test('rejects the deferred bKash/Nagad methods instead of recording them as paid', async () => {
  await withStore(async store => {
    const service = new PaymentService(store);
    for (const method of ['bkash', 'nagad'] as DeferredPaymentMethod[]) {
      assert.throws(
        () => service.createPayment(paymentInput({ method })),
        (error: unknown) =>
          error instanceof PaymentValidationError && /future version/.test(error.message)
      );
    }
    assert.equal(store.getPaymentByIdempotencyKey('payment-job-1'), null);
  });
});

test('records a pending counter-cash payment and deduplicates it by idempotency key', async () => {
  await withStore(async (store, databasePath) => {
    const service = new PaymentService(store);
    const input = paymentInput();
    const first = service.createPayment(input);
    const repeated = service.createPayment(input);

    assert.equal(first.id, repeated.id);
    assert.equal(first.status, 'pending');
    assert.equal(first.method, 'counter_cash');
    assert.equal(first.currency, 'BDT');
    assert.equal(first.confirmedBy, null);
    assert.equal(first.confirmedAt, null);
    assert.equal(store.getPaymentByIdempotencyKey(input.idempotencyKey)?.id, first.id);

    const reopened = new PaymentStore(databasePath);
    try {
      assert.deepEqual(reopened.getPayment(first.id), first);
    } finally {
      reopened.close();
    }

    assert.throws(
      () => service.createPayment(paymentInput({ amountBdt: 251 })),
      PaymentIdempotencyError
    );
  });
});

test('only staff confirmation moves a counter-cash payment to confirmed', async () => {
  await withStore(async store => {
    const service = new PaymentService(store);
    const payment = service.createPayment(paymentInput());

    assert.equal(service.getPayment(payment.id)?.status, 'pending');
    const confirmed = service.confirmCashPayment({
      paymentTransactionId: payment.id,
      confirmedBy: 'staff-counter-1',
    });

    assert.equal(confirmed.status, 'confirmed');
    assert.equal(confirmed.confirmedBy, 'staff-counter-1');
    assert.ok(confirmed.confirmedAt);
    assert.equal(confirmed.amountBdt, payment.amountBdt);
    assert.equal(store.getLatestConfirmedPaymentForJob(payment.jobId)?.id, payment.id);

    const repeated = service.confirmCashPayment({
      paymentTransactionId: payment.id,
      confirmedBy: 'staff-counter-1',
    });
    assert.deepEqual(repeated, confirmed);

    assert.throws(
      () => service.confirmCashPayment({ paymentTransactionId: payment.id, confirmedBy: 'staff-counter-2' }),
      PaymentTransitionError
    );
    assert.throws(() => service.failPayment(payment.id), PaymentTransitionError);
  });
});

test('rejects invalid staff identifiers and failed-payment confirmations', async () => {
  await withStore(async store => {
    const service = new PaymentService(store);
    const payment = service.createPayment(paymentInput());

    for (const confirmedBy of ['', ' staff-1', 'staff\u0000']) {
      assert.throws(
        () => service.confirmCashPayment({ paymentTransactionId: payment.id, confirmedBy }),
        PaymentValidationError
      );
    }
    assert.equal(service.getPayment(payment.id)?.status, 'pending');

    const failed = service.failPayment(payment.id);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.confirmedBy, null);
    assert.equal(service.failPayment(payment.id).status, 'failed');
    assert.throws(
      () => service.confirmCashPayment({ paymentTransactionId: payment.id, confirmedBy: 'staff-1' }),
      PaymentTransitionError
    );
    assert.throws(() => service.failPayment('missing-payment'), /was not found/);
  });
});

test('rejects a payment database written by an incompatible schema version', async () => {
  const directory = mkdtempSync(join(testDirectory, '.payment-service-test-'));
  const databasePath = join(directory, 'payments.sqlite');
  const store = new PaymentStore(databasePath);
  store.close();

  const database = new Database(databasePath);
  database.prepare('UPDATE payment_store_meta SET schema_version = 99 WHERE id = 1').run();
  database.close();

  try {
    assert.throws(() => new PaymentStore(databasePath), /Unsupported payment database schema version/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
