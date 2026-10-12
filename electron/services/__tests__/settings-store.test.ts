import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DEFAULT_APP_SETTINGS,
  isAppSettings,
  type AppSettings,
} from '../../../src/shared/settings.js';
import { SettingsStore, SettingsStoreError, SettingsValidationError } from '../settings-store.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));

const makeDatabasePath = (): { databasePath: string; directory: string } => {
  const directory = mkdtempSync(join(testDirectory, '.settings-store-test-'));
  return { databasePath: join(directory, 'settings.sqlite'), directory };
};

test('migrates an unversioned database and returns validated default settings', () => {
  const { databasePath, directory } = makeDatabasePath();
  const store = new SettingsStore(databasePath);

  try {
    assert.deepEqual(store.get(), DEFAULT_APP_SETTINGS);
    assert.equal(isAppSettings(store.get()), true);

    const database = new Database(databasePath, { readonly: true });
    try {
      assert.equal(database.pragma('user_version', { simple: true }), 1);
    } finally {
      database.close();
    }
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects database schema versions newer than the store supports', () => {
  const { databasePath, directory } = makeDatabasePath();
  const database = new Database(databasePath);
  database.pragma('user_version = 99');
  database.close();

  try {
    assert.throws(() => new SettingsStore(databasePath), SettingsStoreError);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('saves and returns a valid settings object', () => {
  const { databasePath, directory } = makeDatabasePath();
  const store = new SettingsStore(databasePath);
  const settings: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    orderLimits: { ...DEFAULT_APP_SETTINGS.orderLimits, maxPendingOrders: 35 },
    previewWatermarkEnabled: true,
  };

  try {
    assert.deepEqual(store.save(settings), settings);
    assert.deepEqual(store.get(), settings);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects incomplete and out-of-range settings without changing saved values', () => {
  const { databasePath, directory } = makeDatabasePath();
  const store = new SettingsStore(databasePath);

  try {
    const incomplete = { ...DEFAULT_APP_SETTINGS } as Partial<AppSettings>;
    delete incomplete.printer;
    const invalid = {
      ...DEFAULT_APP_SETTINGS,
      orderLimits: { ...DEFAULT_APP_SETTINGS.orderLimits, maxCopies: 0 },
    };

    assert.equal(isAppSettings(incomplete), false);
    assert.equal(isAppSettings(invalid), false);
    assert.throws(() => store.save(incomplete as AppSettings), SettingsValidationError);
    assert.throws(() => store.save(invalid), SettingsValidationError);
    assert.deepEqual(store.get(), DEFAULT_APP_SETTINGS);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('settings persist after closing and reopening the database', () => {
  const { databasePath, directory } = makeDatabasePath();
  const firstStore = new SettingsStore(databasePath);
  const settings: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    retention: { completedMinutes: 30, rejectedMinutes: 5 },
  };
  firstStore.save(settings);
  firstStore.close();

  const reopenedStore = new SettingsStore(databasePath);
  try {
    assert.deepEqual(reopenedStore.get(), settings);
  } finally {
    reopenedStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
