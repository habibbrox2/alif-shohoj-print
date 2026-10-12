import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_APP_SETTINGS, isAppSettings, type AppSettings } from '../../src/shared/settings.js';

const CURRENT_SCHEMA_VERSION = 1;

interface SettingsRow {
  settings_json: string;
}

export class SettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsValidationError';
  }
}

export class SettingsStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsStoreError';
  }
}

export class SettingsStore {
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

  get(): AppSettings {
    const row = this.db.prepare('SELECT settings_json FROM app_settings WHERE id = 1').get() as SettingsRow | undefined;
    if (!row) throw new SettingsStoreError('Persisted application settings are missing.');

    let value: unknown;
    try {
      value = JSON.parse(row.settings_json) as unknown;
    } catch {
      throw new SettingsStoreError('Persisted application settings contain invalid JSON.');
    }
    if (!isAppSettings(value)) {
      throw new SettingsStoreError('Persisted application settings do not match the supported settings schema.');
    }
    return value;
  }

  save(settings: AppSettings): AppSettings {
    if (!isAppSettings(settings)) {
      throw new SettingsValidationError('A complete, valid application settings object is required.');
    }

    const settingsJson = JSON.stringify(settings);
    const result = this.db.prepare('UPDATE app_settings SET settings_json = ? WHERE id = 1').run(settingsJson);
    if (result.changes !== 1) {
      throw new SettingsStoreError('Application settings were not persisted.');
    }
    return JSON.parse(settingsJson) as AppSettings;
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    const version = Number(this.db.pragma('user_version', { simple: true }));
    if (!Number.isInteger(version) || version < 0 || version > CURRENT_SCHEMA_VERSION) {
      throw new SettingsStoreError(`Unsupported settings database schema version: ${version}.`);
    }

    if (version === 0) {
      const migrateToVersionOne = this.db.transaction(() => {
        this.db.exec(`
          CREATE TABLE app_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            settings_json TEXT NOT NULL
          );
        `);
        this.db.prepare('INSERT INTO app_settings (id, settings_json) VALUES (1, ?)').run(
          JSON.stringify(DEFAULT_APP_SETTINGS)
        );
        this.db.exec('PRAGMA user_version = 1;');
      });
      migrateToVersionOne.immediate();
    }
  }
}
