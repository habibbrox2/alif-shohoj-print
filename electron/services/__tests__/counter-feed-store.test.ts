import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CounterFeedStore, CounterFeedStoreError } from '../counter-feed-store.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));

const withStore = <T>(run: (directory: string, store: CounterFeedStore) => T): T => {
  const directory = mkdtempSync(join(testDirectory, '.counter-feed-'));
  try {
    return run(directory, new CounterFeedStore(directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test('a counter feed key is issued once, persisted, and reloaded unchanged', () => {
  withStore((directory, store) => {
    assert.equal(store.getKey('CTR-02'), null, 'a counter without pairing must have no key');

    const key = store.rotateKey('CTR-02');
    assert.match(key, /^[0-9a-f]{64}$/);
    assert.equal(store.getKey('CTR-02'), key);
    assert.equal(store.getOrCreateKey('CTR-02'), key, 'the existing key must be reused, not replaced');

    const reopened = new CounterFeedStore(directory);
    assert.equal(reopened.getKey('CTR-02'), key);
    assert.equal(reopened.verify('CTR-02', key), true);
  });
});

test('a counter feed key only verifies for its own counter', () => {
  withStore((_directory, store) => {
    const key = store.getOrCreateKey('CTR-02');
    store.getOrCreateKey('CTR-03');

    assert.equal(store.verify('CTR-02', key), true);
    assert.equal(store.verify('CTR-03', key), false, 'one counter key must not open another counter');
    assert.equal(store.verify('CTR-02', key.toUpperCase()), false, 'keys are lowercase hex only');
    assert.equal(store.verify('CTR-02', `${key}0`), false, 'a longer candidate is not the key');
    assert.equal(store.verify('CTR-02', key.slice(0, 32)), false);
    assert.equal(store.verify('CTR-02', undefined), false);
    assert.equal(store.verify('CTR-02', ''), false);
    assert.equal(store.verify('not-a-counter', key), false);
    assert.equal(store.verify('CTR-99', key), false, 'an unpaired counter must never verify');
  });
});

test('rotating a counter feed key invalidates the previous one immediately', () => {
  withStore((_directory, store) => {
    const first = store.getOrCreateKey('CTR-02');
    const second = store.rotateKey('CTR-02');

    assert.notEqual(second, first);
    assert.equal(store.verify('CTR-02', first), false);
    assert.equal(store.verify('CTR-02', second), true);
  });
});

test('revoking a counter feed key removes access without touching other counters', () => {
  withStore((directory, store) => {
    const revoked = store.getOrCreateKey('CTR-02');
    const kept = store.getOrCreateKey('CTR-03');

    store.revokeKey('CTR-02');
    assert.equal(store.getKey('CTR-02'), null);
    assert.equal(store.verify('CTR-02', revoked), false);
    assert.equal(store.verify('CTR-03', kept), true);

    // Revoking an unknown or malformed counter is a no-op, never a crash.
    store.revokeKey('CTR-77');
    store.revokeKey('../../etc/passwd');
    assert.equal(new CounterFeedStore(directory).verify('CTR-03', kept), true);
  });
});

test('the key file is readable only by this account and rejects unknown counter IDs', () => {
  withStore((directory, store) => {
    store.getOrCreateKey('CTR-02');
    assert.throws(() => store.rotateKey('not a counter'), CounterFeedStoreError);
    if (process.platform !== 'win32') {
      const mode = statSync(join(directory, 'counter-feed-keys.json')).mode & 0o777;
      assert.equal(mode, 0o600);
    }
  });
});

test('a damaged key file is reported instead of silently dropping every pairing', () => {
  const directory = mkdtempSync(join(testDirectory, '.counter-feed-broken-'));
  try {
    writeFileSync(join(directory, 'counter-feed-keys.json'), '{ not json', 'utf8');
    assert.throws(() => new CounterFeedStore(directory), CounterFeedStoreError);
    writeFileSync(join(directory, 'counter-feed-keys.json'), JSON.stringify({ version: 99, keys: {} }), 'utf8');
    assert.throws(() => new CounterFeedStore(directory), CounterFeedStoreError);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('only well-formed keys survive an edited key file', () => {
  const directory = mkdtempSync(join(testDirectory, '.counter-feed-edited-'));
  try {
    writeFileSync(join(directory, 'counter-feed-keys.json'), JSON.stringify({
      version: 1,
      keys: {
        'CTR-02': 'a'.repeat(64),
        'CTR-03': 'too-short',
        '../escape': 'b'.repeat(64),
      },
    }), 'utf8');
    const store = new CounterFeedStore(directory);
    assert.equal(store.verify('CTR-02', 'a'.repeat(64)), true);
    assert.equal(store.getKey('CTR-03'), null);
    assert.equal(store.getKey('../escape'), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the on-disk key file never contains anything but counter keys', () => {
  withStore((directory, store) => {
    const key = store.getOrCreateKey('CTR-02');
    const contents = JSON.parse(readFileSync(join(directory, 'counter-feed-keys.json'), 'utf8')) as {
      version: number;
      keys: Record<string, string>;
    };
    assert.equal(contents.version, 1);
    assert.deepEqual(Object.keys(contents.keys), ['CTR-02']);
    assert.equal(contents.keys['CTR-02'], key);
  });
});
