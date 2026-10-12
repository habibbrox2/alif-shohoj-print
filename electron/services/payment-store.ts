import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  isPaymentAmountBdt,
  isPaymentIdentifier,
  isPaymentMethod,
  type PaymentCurrency,
  type PaymentStatus,
  type PaymentTransaction,
} from '../../src/shared/payments.js';

const PAYMENT_SCHEMA_VERSION = 1;

interface PaymentRow {
  id: string;
  job_id: string;
  method: string;
  amount_bdt: number;
  currency: string;
  status: string;
  idempotency_key: string;
  confirmed_by: string | null;
  confirmed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface NewPaymentRecord {
  jobId: string;
  method: PaymentTransaction['method'];
  amountBdt: number;
  currency: PaymentCurrency;
  idempotencyKey: string;
}

export class PaymentStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentStoreError';
  }
}

export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

export class PaymentTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentTransitionError';
  }
}

export class PaymentIdempotencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentIdempotencyError';
  }
}

export class PaymentStore {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);

    try {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('secure_delete = ON');
      this.migrate();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  reservePayment(input: NewPaymentRecord): { payment: PaymentTransaction; created: boolean } {
    validateNewPayment(input);
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO payment_transactions (
        id, job_id, method, amount_bdt, currency, status,
        idempotency_key, confirmed_by, confirmed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?, ?)
    `).run(
      randomUUID(),
      input.jobId,
      input.method,
      input.amountBdt,
      input.currency,
      input.idempotencyKey,
      now,
      now
    );

    const payment = this.getPaymentByIdempotencyKey(input.idempotencyKey);
    if (!payment) throw new PaymentStoreError('Payment transaction was not persisted.');
    if (!samePaymentRequest(payment, input)) {
      throw new PaymentIdempotencyError('The payment idempotency key is already used for a different request.');
    }
    return { payment, created: result.changes === 1 };
  }

  getPayment(id: string): PaymentTransaction | null {
    const row = this.db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(id) as PaymentRow | undefined;
    return row ? this.toPayment(row) : null;
  }

  getPaymentByIdempotencyKey(idempotencyKey: string): PaymentTransaction | null {
    const row = this.db.prepare('SELECT * FROM payment_transactions WHERE idempotency_key = ?')
      .get(idempotencyKey) as PaymentRow | undefined;
    return row ? this.toPayment(row) : null;
  }

  getLatestConfirmedPaymentForJob(jobId: string): PaymentTransaction | null {
    const row = this.db.prepare(`
      SELECT * FROM payment_transactions
      WHERE job_id = ? AND status = 'confirmed'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(jobId) as PaymentRow | undefined;
    return row ? this.toPayment(row) : null;
  }

  confirmPayment(id: string, confirmedBy: string): PaymentTransaction {
    assertIdentifier(id, 'Payment transaction ID');
    if (!isPaymentIdentifier(confirmedBy)) {
      throw new PaymentValidationError('The confirming staff identifier is invalid.');
    }

    const transaction = this.db.transaction(() => {
      const payment = this.requirePayment(id);
      if (payment.status !== 'pending') {
        if (payment.status === 'confirmed' && payment.confirmedBy === confirmedBy) return payment;
        throw new PaymentTransitionError(`Payment cannot be confirmed from ${payment.status} state.`);
      }

      const now = Date.now();
      const update = this.db.prepare(`
        UPDATE payment_transactions
        SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(confirmedBy, now, now, id);
      if (update.changes !== 1) throw new PaymentTransitionError('Payment is no longer pending.');
      return this.requirePayment(id);
    });
    return transaction.immediate();
  }

  failPayment(id: string): PaymentTransaction {
    assertIdentifier(id, 'Payment transaction ID');

    const transaction = this.db.transaction(() => {
      const payment = this.requirePayment(id);
      if (payment.status === 'failed') return payment;
      if (payment.status !== 'pending') {
        throw new PaymentTransitionError(`Payment cannot fail from ${payment.status} state.`);
      }

      const update = this.db.prepare(`
        UPDATE payment_transactions
        SET status = 'failed', updated_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(Date.now(), id);
      if (update.changes !== 1) throw new PaymentTransitionError('Payment is no longer pending.');
      return this.requirePayment(id);
    });
    return transaction.immediate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payment_store_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schema_version INTEGER NOT NULL
      );
    `);

    const versionRow = this.db.prepare('SELECT schema_version FROM payment_store_meta WHERE id = 1')
      .get() as { schema_version: number } | undefined;
    const version = versionRow?.schema_version ?? 0;
    if (!Number.isInteger(version) || version < 0 || version > PAYMENT_SCHEMA_VERSION) {
      throw new PaymentStoreError(`Unsupported payment database schema version: ${version}.`);
    }
    if (version === PAYMENT_SCHEMA_VERSION) return;

    const migrateToVersionOne = this.db.transaction(() => {
      this.db.exec(`
        CREATE TABLE payment_transactions (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          method TEXT NOT NULL CHECK (method = 'counter_cash'),
          amount_bdt INTEGER NOT NULL CHECK (amount_bdt > 0),
          currency TEXT NOT NULL CHECK (currency = 'BDT'),
          status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
          idempotency_key TEXT NOT NULL UNIQUE,
          confirmed_by TEXT,
          confirmed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          CHECK (
            (status = 'confirmed' AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
            OR (status <> 'confirmed' AND confirmed_by IS NULL AND confirmed_at IS NULL)
          )
        );
        CREATE INDEX idx_payment_transactions_job_status
          ON payment_transactions(job_id, status, created_at);
      `);
      this.db.prepare(`
        INSERT INTO payment_store_meta (id, schema_version)
        VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version
      `).run(PAYMENT_SCHEMA_VERSION);
    });
    migrateToVersionOne.immediate();
  }

  private requirePayment(id: string): PaymentTransaction {
    const payment = this.getPayment(id);
    if (!payment) throw new PaymentStoreError('Payment transaction was not found.');
    return payment;
  }

  private toPayment(row: PaymentRow): PaymentTransaction {
    if (
      !isPaymentIdentifier(row.id) ||
      !isPaymentIdentifier(row.job_id) ||
      !isPaymentMethod(row.method) ||
      !isPaymentAmountBdt(row.amount_bdt) ||
      row.currency !== 'BDT' ||
      !isPaymentStatus(row.status) ||
      !isPaymentIdentifier(row.idempotency_key) ||
      !isConfirmationState(row) ||
      !isTimestamp(row.created_at) ||
      !isTimestamp(row.updated_at)
    ) throw new PaymentStoreError('Persisted payment transaction is invalid.');

    return {
      id: row.id,
      jobId: row.job_id,
      method: row.method,
      amountBdt: row.amount_bdt,
      currency: 'BDT',
      status: row.status,
      idempotencyKey: row.idempotency_key,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

const validateNewPayment = (input: NewPaymentRecord): void => {
  assertIdentifier(input.jobId, 'Job ID');
  assertIdentifier(input.idempotencyKey, 'Payment idempotency key');
  if (!isPaymentMethod(input.method)) throw new PaymentValidationError('A supported payment method is required.');
  if (!isPaymentAmountBdt(input.amountBdt)) {
    throw new PaymentValidationError('Payment amount must be a positive whole BDT amount.');
  }
  if (input.currency !== 'BDT') throw new PaymentValidationError('Only BDT payments are supported.');
};

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (!isPaymentIdentifier(value)) throw new PaymentValidationError(`${label} is invalid.`);
}

const samePaymentRequest = (payment: PaymentTransaction, input: NewPaymentRecord): boolean =>
  payment.jobId === input.jobId &&
  payment.method === input.method &&
  payment.amountBdt === input.amountBdt &&
  payment.currency === input.currency;

const isPaymentStatus = (value: string): value is PaymentStatus =>
  value === 'pending' || value === 'confirmed' || value === 'failed';

const isConfirmationState = (row: PaymentRow): boolean =>
  row.status === 'confirmed'
    ? isPaymentIdentifier(row.confirmed_by) && isTimestamp(row.confirmed_at)
    : row.confirmed_by === null && row.confirmed_at === null;

const isTimestamp = (value: number | null): value is number =>
  value !== null && Number.isSafeInteger(value) && value >= 0;
