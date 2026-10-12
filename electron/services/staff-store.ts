import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export type StaffRole = 'owner' | 'manager' | 'operator';

export interface StaffUser {
  id: string;
  role: StaffRole;
  enabled: boolean;
  createdAt: number;
}

interface StaffUserRow {
  id: string;
  role: StaffRole;
  enabled: number;
  created_at: number;
}

interface StaffCredentialRow extends StaffUserRow {
  pin_hash: string;
}

export class StaffStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffStoreError';
  }
}

export class StaffStore {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);

    try {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('secure_delete = ON');
      this.migrate();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  isBootstrapped(): boolean {
    const row = this.db.prepare('SELECT 1 FROM staff_users LIMIT 1').get();
    return row !== undefined;
  }

  bootstrapOwner(pinHash: string): StaffUser {
    this.validatePinHash(pinHash);
    const insert = this.db.prepare(`
      INSERT INTO staff_users (id, role, enabled, pin_hash, created_at)
      VALUES (?, 'owner', 1, ?, ?)
    `);
    const create = this.db.transaction(() => {
      if (this.isBootstrapped()) {
        throw new StaffStoreError('Staff accounts have already been bootstrapped.');
      }
      const id = randomUUID();
      const createdAt = Date.now();
      insert.run(id, pinHash, createdAt);
      return { id, role: 'owner' as const, enabled: true, createdAt };
    });
    return create.immediate();
  }

  createUser(
    pin: string,
    pinHash: string,
    role: StaffRole,
    verifyPin: (pin: string, hash: string) => boolean,
  ): StaffUser {
    this.validatePinHash(pinHash);
    this.validateRole(role);
    const insert = this.db.prepare(`
      INSERT INTO staff_users (id, role, enabled, pin_hash, created_at)
      VALUES (?, ?, 1, ?, ?)
    `);
    const create = this.db.transaction(() => {
      const credentials = this.db.prepare('SELECT pin_hash FROM staff_users').all() as Array<{ pin_hash: string }>;
      if (credentials.some(({ pin_hash }) => verifyPin(pin, pin_hash))) {
        throw new StaffStoreError('That PIN is already assigned to a staff account.');
      }
      const user: StaffUser = {
        id: randomUUID(),
        role,
        enabled: true,
        createdAt: Date.now(),
      };
      insert.run(user.id, user.role, pinHash, user.createdAt);
      return user;
    });
    return create.immediate();
  }

  listUsers(): StaffUser[] {
    const rows = this.db.prepare(`
      SELECT id, role, enabled, created_at
      FROM staff_users
      ORDER BY created_at, id
    `).all() as StaffUserRow[];
    return rows.map((row) => this.toUser(row));
  }

  findUsersByPin(pin: string, verifyPin: (pin: string, hash: string) => boolean): StaffUser[] {
    const rows = this.db.prepare(`
      SELECT id, role, enabled, pin_hash, created_at
      FROM staff_users
    `).all() as StaffCredentialRow[];
    return rows.flatMap((row) => verifyPin(pin, row.pin_hash) ? [this.toUser(row)] : []);
  }

  setRole(userId: string, role: StaffRole): StaffUser {
    this.validateRole(role);
    const update = this.db.transaction(() => {
      const existing = this.getUser(userId);
      if (!existing) throw new StaffStoreError('Staff account was not found.');
      if (existing.enabled && existing.role === 'owner' && role !== 'owner') {
        this.requireAnotherEnabledOwner(userId);
      }
      this.db.prepare('UPDATE staff_users SET role = ? WHERE id = ?').run(role, userId);
      return { ...existing, role };
    });
    return update.immediate();
  }

  setEnabled(userId: string, enabled: boolean): StaffUser {
    if (typeof enabled !== 'boolean') throw new StaffStoreError('A valid enabled state is required.');
    const update = this.db.transaction(() => {
      const existing = this.getUser(userId);
      if (!existing) throw new StaffStoreError('Staff account was not found.');
      if (!enabled && existing.enabled && existing.role === 'owner') {
        this.requireAnotherEnabledOwner(userId);
      }
      this.db.prepare('UPDATE staff_users SET enabled = ? WHERE id = ?').run(Number(enabled), userId);
      return { ...existing, enabled };
    });
    return update.immediate();
  }

  getUser(userId: string): StaffUser | undefined {
    const row = this.db.prepare(`
      SELECT id, role, enabled, created_at
      FROM staff_users
      WHERE id = ?
    `).get(userId) as StaffUserRow | undefined;
    return row ? this.toUser(row) : undefined;
  }

  close(): void {
    this.db.close();
  }

  private requireAnotherEnabledOwner(excludedUserId: string): void {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM staff_users
      WHERE role = 'owner' AND enabled = 1 AND id != ?
    `).get(excludedUserId) as { count: number };
    if (row.count === 0) {
      throw new StaffStoreError('The last enabled Owner account cannot be disabled or demoted.');
    }
  }

  private toUser(row: StaffUserRow): StaffUser {
    return {
      id: row.id,
      role: row.role,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
    };
  }

  private validateRole(role: StaffRole): void {
    if (role !== 'owner' && role !== 'manager' && role !== 'operator') {
      throw new StaffStoreError('A valid staff role is required.');
    }
  }

  private validatePinHash(pinHash: string): void {
    if (typeof pinHash !== 'string' || pinHash.length < 1 || pinHash.length > 256) {
      throw new StaffStoreError('A valid PIN hash is required.');
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS staff_schema (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL
      );
    `);
    const versionRow = this.db.prepare('SELECT version FROM staff_schema WHERE id = 1').get() as
      | { version: number }
      | undefined;
    const version = versionRow?.version ?? 0;
    if (!Number.isInteger(version) || version < 0 || version > 1) {
      throw new StaffStoreError(`Unsupported staff database schema version: ${version}.`);
    }

    if (version === 0) {
      const migrateToVersionOne = this.db.transaction(() => {
        this.db.exec(`
          CREATE TABLE staff_users (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'operator')),
            enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
            pin_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );
          CREATE INDEX staff_users_enabled_role ON staff_users (enabled, role);
          INSERT INTO staff_schema (id, version) VALUES (1, 1);
        `);
      });
      migrateToVersionOne.immediate();
    }
  }
}
