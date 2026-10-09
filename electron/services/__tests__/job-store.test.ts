import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { JobStore } from '../job-store.js';
import { createTestJob } from './test-job.js';

test('persists queue records and treats duplicate IDs idempotently', () => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-store-'));
  const databasePath = join(directory, 'queue.sqlite');
  const store = new JobStore(databasePath);
  const job = createTestJob();

  try {
    const first = store.enqueue(job);
    const duplicate = store.enqueue({ ...job, serviceLabel: 'Changed duplicate' });

    assert.equal(first.status, 'queued');
    assert.equal(store.list().length, 1);
    assert.equal(duplicate.job.serviceLabel, 'Changed duplicate');
    assert.equal(store.markPrinting(job.id).attempts, 1);
    const completed = store.markCompleted(job.id);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.job.fileUrl, '');
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('recovers interrupted print attempts as queued with an explanation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-recovery-'));
  const databasePath = join(directory, 'queue.sqlite');
  const job = createTestJob();
  const firstStore = new JobStore(databasePath);
  firstStore.enqueue(job);
  firstStore.markPrinting(job.id);
  firstStore.close();

  const reopenedStore = new JobStore(databasePath);
  try {
    const recovered = reopenedStore.get(job.id);
    assert.equal(recovered?.status, 'queued');
    assert.match(recovered?.error || '', /interrupted print attempt/i);
  } finally {
    reopenedStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('removes rejected jobs permanently and resets failed jobs to queued on re-enqueue', () => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-remove-'));
  const databasePath = join(directory, 'queue.sqlite');
  const store = new JobStore(databasePath);
  const job = createTestJob();

  try {
    store.enqueue(job);
    store.remove(job.id);
    assert.equal(store.get(job.id), null);
    assert.equal(store.list().length, 0);

    // Removing twice is idempotent.
    store.remove(job.id);
    assert.equal(store.list().length, 0);

    // A failed job re-enqueued for retry returns to 'queued' with a clean error.
    const retry = { ...job, id: `${job.id}-retry` };
    store.enqueue(retry);
    store.markPrinting(retry.id);
    store.markFailed(retry.id, 'Spooler offline');
    assert.equal(store.get(retry.id)?.status, 'failed');
    const requeued = store.enqueue({ ...retry, serviceLabel: 'Retried' });
    assert.equal(requeued.status, 'queued');
    assert.equal(requeued.error, undefined);
    assert.equal(requeued.job.serviceLabel, 'Retried');
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
