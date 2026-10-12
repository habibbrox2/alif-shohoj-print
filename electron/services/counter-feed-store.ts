import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { COUNTER_ID_PATTERN, COUNTER_FEED_KEY_PATTERN } from '../../src/shared/services/counterFeed.js';

const KEY_BYTES = 32;
const FILE_NAME = 'counter-feed-keys.json';
const FILE_VERSION = 1;

interface CounterFeedFile {
  version: number;
  keys: Record<string, string>;
}

export class CounterFeedStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CounterFeedStoreError';
  }
}

/**
 * Per-counter feed keys on the master PC. Each counter PC pairs with one key
 * that lets it read only its own orders, so pairing one counter never grants
 * access to another counter's orders.
 *
 * The keys are stored in plaintext in a `0600` file inside Electron's user-data
 * directory, matching the existing WebSocket token: the shopkeeper has to be
 * able to read a key out and type it on the counter PC, and Windows account
 * ACLs protect the file. Treat every key like a password.
 */
export class CounterFeedStore {
  private readonly filePath: string;
  private keys: Record<string, string>;

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, FILE_NAME);
    this.keys = this.load();
  }

  getKey(counterId: string): string | null {
    if (!COUNTER_ID_PATTERN.test(counterId)) return null;
    return this.keys[counterId] ?? null;
  }

  /** Creates the key on first use so a counter without pairing stays unreadable. */
  getOrCreateKey(counterId: string): string {
    return this.getKey(counterId) ?? this.rotateKey(counterId);
  }

  /** Issues a fresh key; the previous key for this counter stops working immediately. */
  rotateKey(counterId: string): string {
    if (!COUNTER_ID_PATTERN.test(counterId)) {
      throw new CounterFeedStoreError('A valid counter ID is required to create a feed key.');
    }
    const key = randomBytes(KEY_BYTES).toString('hex');
    this.keys = { ...this.keys, [counterId]: key };
    this.persist();
    return key;
  }

  revokeKey(counterId: string): void {
    if (!COUNTER_ID_PATTERN.test(counterId)) return;
    if (!(counterId in this.keys)) return;
    const next = { ...this.keys };
    delete next[counterId];
    this.keys = next;
    this.persist();
  }

  verify(counterId: string, candidate: unknown): boolean {
    const expected = this.getKey(counterId);
    if (!expected) return false;
    if (typeof candidate !== 'string' || !COUNTER_FEED_KEY_PATTERN.test(candidate)) return false;
    const candidateBuffer = Buffer.from(candidate);
    const expectedBuffer = Buffer.from(expected);
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  }

  private load(): Record<string, string> {
    if (!existsSync(this.filePath)) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, 'utf8'));
    } catch {
      throw new CounterFeedStoreError('The saved counter feed keys are not valid JSON.');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new CounterFeedStoreError('The saved counter feed keys are not an object.');
    }
    const file = parsed as Partial<CounterFeedFile>;
    if (file.version !== FILE_VERSION || !file.keys || typeof file.keys !== 'object') {
      throw new CounterFeedStoreError('The saved counter feed keys do not match the supported format.');
    }
    const keys: Record<string, string> = {};
    for (const [counterId, key] of Object.entries(file.keys)) {
      if (COUNTER_ID_PATTERN.test(counterId) && typeof key === 'string' && COUNTER_FEED_KEY_PATTERN.test(key)) {
        keys[counterId] = key;
      }
    }
    return keys;
  }

  private persist(): void {
    const file: CounterFeedFile = { version: FILE_VERSION, keys: this.keys };
    mkdirSync(dirname(this.filePath), { recursive: true });
    // Write-then-rename so a crash can never leave a truncated key file behind.
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(file, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
  }
}
