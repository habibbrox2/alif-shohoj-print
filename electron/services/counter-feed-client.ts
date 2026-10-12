import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  COUNTER_FEED_KEY_HEADER,
  COUNTER_FEED_KEY_PATTERN,
  COUNTER_FEED_PATH,
  COUNTER_ID_PATTERN,
  parseCounterFeedOrders,
  type CounterFeedOrder,
} from '../../src/shared/services/counterFeed.js';

const FILE_NAME = 'counter-feed.secret';
const FILE_VERSION = 1;
const MAX_RESPONSE_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Encrypts the stored key at rest. Electron's `safeStorage` (DPAPI on Windows)
 * is injected from the main process; without it the key falls back to a plain
 * `0600` file, which the UI reports as unprotected.
 */
export interface CounterFeedCodec {
  encrypt(value: string): string;
  decrypt(value: string): string;
}

interface CounterFeedSecretFile {
  version: number;
  protected: boolean;
  value: string;
}

export class CounterFeedSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CounterFeedSecretError';
  }
}

/**
 * Holds this counter PC's feed key. The renderer can set and clear the key but
 * can never read it back, so the secret stays in the main process and is never
 * written to renderer storage, logs or the DOM.
 */
export class CounterFeedSecretStore {
  private readonly filePath: string;

  constructor(
    userDataPath: string,
    private readonly codec?: CounterFeedCodec,
  ) {
    this.filePath = join(userDataPath, FILE_NAME);
  }

  has(): boolean {
    return this.readSecret() !== null;
  }

  /** True when the key is stored under OS encryption rather than a plain file. */
  isProtected(): boolean {
    if (!this.codec) return false;
    const secret = this.readSecret();
    return secret !== null && secret.protected;
  }

  set(key: string): void {
    if (typeof key !== 'string' || !COUNTER_FEED_KEY_PATTERN.test(key.trim())) {
      throw new CounterFeedSecretError('The counter feed key must be 64 hexadecimal characters.');
    }
    const normalized = key.trim().toLowerCase();
    const file: CounterFeedSecretFile = this.codec
      ? { version: FILE_VERSION, protected: true, value: this.codec.encrypt(normalized) }
      : { version: FILE_VERSION, protected: false, value: normalized };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(file)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
  }

  clear(): void {
    if (existsSync(this.filePath)) rmSync(this.filePath, { force: true });
  }

  /** Returns the key for main-process use only; never forward this to the renderer. */
  read(): string | null {
    const secret = this.readSecret();
    return secret?.key ?? null;
  }

  private readSecret(): { key: string; protected: boolean } | null {
    if (!existsSync(this.filePath)) return null;
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<CounterFeedSecretFile>;
      if (parsed.version !== FILE_VERSION || typeof parsed.value !== 'string') return null;
      const key = parsed.protected === true ? this.codec?.decrypt(parsed.value) : parsed.value;
      if (typeof key !== 'string' || !COUNTER_FEED_KEY_PATTERN.test(key)) return null;
      return { key, protected: parsed.protected === true };
    } catch {
      return null;
    }
  }
}

export type CounterFeedPullFailure = 'unauthorized' | 'unreachable' | 'invalid-response';

export type CounterFeedPullResult =
  | { ok: true; orders: CounterFeedOrder[]; serverTime: number }
  | { ok: false; reason: CounterFeedPullFailure; error: string };

export interface CounterFeedPullOptions {
  masterUrl: string;
  counterId: string;
  key: string;
  since?: number;
  /** Development-only escape hatch, matching the packaged-HTTPS rule for heartbeats. */
  allowInsecureHttp?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Reads this counter's own orders from the master PC. Called in the main
 * process so the feed key never enters the renderer.
 */
export const pullCounterFeed = async (options: CounterFeedPullOptions): Promise<CounterFeedPullResult> => {
  if (!COUNTER_ID_PATTERN.test(options.counterId)) {
    return { ok: false, reason: 'invalid-response', error: 'This PC has no valid counter ID configured.' };
  }
  if (!COUNTER_FEED_KEY_PATTERN.test(options.key)) {
    return { ok: false, reason: 'unauthorized', error: 'No counter feed key is configured on this PC.' };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(COUNTER_FEED_PATH, options.masterUrl);
  } catch {
    return { ok: false, reason: 'unreachable', error: 'The master PC URL is invalid.' };
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    return { ok: false, reason: 'unreachable', error: 'The master PC URL must not contain credentials or query parameters.' };
  }
  if (endpoint.protocol !== 'https:' && !(options.allowInsecureHttp === true && endpoint.protocol === 'http:')) {
    return { ok: false, reason: 'unreachable', error: 'The counter order feed requires HTTPS on installed Windows PCs.' };
  }
  endpoint.searchParams.set('counterId', options.counterId);
  if (typeof options.since === 'number' && Number.isFinite(options.since) && options.since > 0) {
    endpoint.searchParams.set('since', String(Math.floor(options.since)));
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { [COUNTER_FEED_KEY_HEADER]: options.key },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'unreachable', error: 'The master PC did not answer the order feed request.' };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'unauthorized', error: 'The master PC rejected this counter feed key.' };
  }
  if (response.status === 429) {
    return { ok: false, reason: 'unreachable', error: 'The master PC is temporarily refusing feed requests.' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'unreachable', error: `The master PC answered the feed request with status ${response.status}.` };
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return { ok: false, reason: 'unreachable', error: 'The master PC order feed could not be read.' };
  }
  if (text.length > MAX_RESPONSE_BYTES) {
    return { ok: false, reason: 'invalid-response', error: 'The master PC order feed was larger than expected.' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid-response', error: 'The master PC order feed was not valid JSON.' };
  }
  const orders = parseCounterFeedOrders(payload);
  if (!orders) {
    return { ok: false, reason: 'invalid-response', error: 'The master PC order feed did not match the expected format.' };
  }
  const serverTime = Number((payload as { serverTime?: unknown }).serverTime);
  return {
    ok: true,
    orders: orders.filter(order => order.counterId === options.counterId),
    serverTime: Number.isFinite(serverTime) ? serverTime : Date.now(),
  };
};
