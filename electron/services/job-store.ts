import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PrintJob } from '../../src/shared/types.js';
import type { DesktopQueueJob, DesktopQueueStatus } from '../../src/shared/desktop-api.js';

interface QueueRow {
  id: string;
  payload_json: string;
  status: DesktopQueueStatus;
  attempts: number;
  created_at: number;
  updated_at: number;
  error: string | null;
}

export class JobStore {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('secure_delete = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS print_queue (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'printing', 'completed', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_print_queue_status_created
        ON print_queue(status, created_at);
    `);
    this.db.prepare(`
      UPDATE print_queue
      SET status = 'queued', updated_at = ?, error = 'Recovered after an interrupted print attempt.'
      WHERE status = 'printing'
    `).run(Date.now());
  }

  enqueue(job: PrintJob): DesktopQueueJob {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO print_queue (id, payload_json, status, attempts, created_at, updated_at, error)
      VALUES (@id, @payload, 'queued', 0, @now, @now, NULL)
      ON CONFLICT(id) DO UPDATE SET
        payload_json = excluded.payload_json,
        status = 'queued',
        error = NULL,
        updated_at = excluded.updated_at
      WHERE print_queue.status IN ('queued', 'failed')
    `).run({ id: job.id, payload: JSON.stringify(job), now });
    const saved = this.get(job.id);
    if (!saved) throw new Error(`Queue insert did not persist job ${job.id}.`);
    return saved;
  }

  get(id: string): DesktopQueueJob | null {
    const row = this.db.prepare('SELECT * FROM print_queue WHERE id = ?').get(id) as QueueRow | undefined;
    return row ? this.toQueueJob(row) : null;
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM print_queue WHERE id = ?').run(id);
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  list(): DesktopQueueJob[] {
    const rows = this.db.prepare('SELECT * FROM print_queue ORDER BY created_at DESC').all() as QueueRow[];
    return rows.map(row => this.toQueueJob(row));
  }

  markPrinting(id: string): DesktopQueueJob {
    this.updateStatus(id, 'printing', null, true);
    return this.requireJob(id);
  }

  markCompleted(id: string): DesktopQueueJob {
    const job = this.requireJob(id);
    const sanitizedJob = { ...job.job, fileUrl: '' };
    const result = this.db.prepare(`
      UPDATE print_queue
      SET payload_json = ?, status = 'completed', error = NULL, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(sanitizedJob), Date.now(), id);
    if (result.changes === 0) throw new Error(`Print queue job ${id} was not found.`);
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    return this.requireJob(id);
  }

  markFailed(id: string, error: string): DesktopQueueJob {
    this.updateStatus(id, 'failed', error);
    return this.requireJob(id);
  }

  close(): void {
    this.db.close();
  }

  private updateStatus(id: string, status: DesktopQueueStatus, error: string | null, incrementAttempts = false): void {
    const result = this.db.prepare(`
      UPDATE print_queue
      SET status = ?, error = ?, attempts = attempts + ?, updated_at = ?
      WHERE id = ?
    `).run(status, error, incrementAttempts ? 1 : 0, Date.now(), id);
    if (result.changes === 0) throw new Error(`Print queue job ${id} was not found.`);
  }

  private requireJob(id: string): DesktopQueueJob {
    const job = this.get(id);
    if (!job) throw new Error(`Print queue job ${id} was not found after updating its state.`);
    return job;
  }

  private toQueueJob(row: QueueRow): DesktopQueueJob {
    return {
      job: JSON.parse(row.payload_json) as PrintJob,
      status: row.status,
      attempts: row.attempts,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.error ? { error: row.error } : {}),
    };
  }
}
