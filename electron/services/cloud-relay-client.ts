import { WebSocket, type RawData } from 'ws';
import { isPrintJob } from './job-websocket.js';
import type { PrintJob } from '../../src/shared/types.js';

export type CloudRelayStatus = 'connecting' | 'authenticated' | 'reconnecting';

export interface CloudRelayClientOptions {
  /** Cloud endpoint, e.g. `https://relay.example.com/ws`. `deviceid` is appended by the client. */
  relayUrl: string;
  deviceId: string;
  token: string;
  onOrder: (job: PrintJob) => void;
  onStatusChange?: (status: CloudRelayStatus) => void;
  onError?: (error: Error) => void;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  reconnectDelayMs?: number;
  reconnect?: boolean;
  /** Packaged builds must keep `wss:`; only local testing may opt into plain `ws:`. */
  allowInsecure?: boolean;
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 30_000;
const DEFAULT_RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const AUTH_TIMEOUT_MS = 15_000;
const MAX_MESSAGE_BYTES = 56 * 1024 * 1024;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{16,512}$/;

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

export const isValidRelayDeviceId = (deviceId: string): boolean => DEVICE_ID_PATTERN.test(deviceId);

export const isValidRelayToken = (token: string): boolean => TOKEN_PATTERN.test(token);

export const buildRelayWebSocketUrl = (relayUrl: string, deviceId: string, allowInsecure = false): string => {
  const url = new URL(relayUrl);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') {
    if (!allowInsecure) throw new Error('The cloud relay requires HTTPS; plain HTTP is only allowed for local testing.');
    url.protocol = 'ws:';
  } else if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
    throw new Error('The cloud relay URL must use http or https.');
  }
  // Authentication happens in the `auth` message, never in the URL, so any
  // credential already stored on the relay URL is dropped instead of leaked.
  url.search = '';
  url.searchParams.set('deviceid', deviceId);
  return url.toString();
};

const parseMessage = (raw: RawData): Record<string, unknown> | null => {
  const buffer = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  if (buffer.length === 0 || buffer.length > MAX_MESSAGE_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
};

export class CloudRelayClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private authTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private lastActivityAt = 0;
  private status: CloudRelayStatus | null = null;

  constructor(private readonly options: CloudRelayClientOptions) {}

  connect(): void {
    this.shouldReconnect = true;
    this.open();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearTimers();
    const socket = this.ws;
    this.ws = null;
    if (socket) {
      socket.removeAllListeners();
      // A socket closed mid-handshake rejects the pending connection; swallow
      // that expected error so an intentional shutdown never surfaces one.
      socket.on('error', () => undefined);
      socket.close();
    }
    this.status = null;
  }

  getStatus(): CloudRelayStatus | null {
    return this.status;
  }

  private setStatus(status: CloudRelayStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatusChange?.(status);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.authTimer) clearTimeout(this.authTimer);
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.authTimer = null;
  }

  private open(): void {
    const { deviceId, token, allowInsecure } = this.options;
    if (!isValidRelayDeviceId(deviceId)) {
      this.options.onError?.(new Error('The device ID is not a valid identifier.'));
      return;
    }
    if (!isValidRelayToken(token)) {
      this.options.onError?.(new Error('The device token is not valid.'));
      return;
    }

    let wsUrl: string;
    try {
      wsUrl = buildRelayWebSocketUrl(this.options.relayUrl, deviceId, allowInsecure);
    } catch (error) {
      this.options.onError?.(toError(error));
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      this.ws = new WebSocket(wsUrl, { maxPayload: MAX_MESSAGE_BYTES });
    } catch (error) {
      this.options.onError?.(toError(error));
      this.scheduleReconnect();
      return;
    }

    this.lastActivityAt = Date.now();

    this.ws.on('open', () => {
      this.ws?.send(JSON.stringify({ type: 'auth', deviceId, token }));
      // The relay must acknowledge the credentials before the link counts as live.
      this.authTimer = setTimeout(() => {
        this.options.onError?.(new Error('The cloud relay did not accept the device credentials.'));
        this.ws?.terminate();
      }, AUTH_TIMEOUT_MS);
      this.heartbeatTimer = setInterval(() => this.heartbeatTick(), this.options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS);
    });

    this.ws.on('message', raw => this.handleMessage(raw));

    this.ws.on('close', () => {
      this.stopTimersForActiveSocket();
      if (this.shouldReconnect) this.scheduleReconnect();
    });

    this.ws.on('error', error => {
      this.options.onError?.(toError(error));
    });
  }

  private stopTimersForActiveSocket(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.authTimer) clearTimeout(this.authTimer);
    this.heartbeatTimer = null;
    this.authTimer = null;
  }

  private heartbeatTick(): void {
    const timeout = this.options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
    if (Date.now() - this.lastActivityAt > timeout) {
      this.options.onError?.(new Error('The cloud relay stopped responding; reconnecting.'));
      this.ws?.terminate();
      return;
    }
    this.ws?.send(JSON.stringify({ type: 'ping', at: Date.now() }));
  }

  private handleMessage(raw: RawData): void {
    this.lastActivityAt = Date.now();
    const message = parseMessage(raw);
    if (!message) {
      this.options.onError?.(new Error('The cloud relay sent a message that could not be read.'));
      return;
    }

    const type = typeof message.type === 'string' ? message.type : '';
    if (type === 'authenticated') {
      if (this.authTimer) {
        clearTimeout(this.authTimer);
        this.authTimer = null;
      }
      this.reconnectAttempts = 0;
      this.setStatus('authenticated');
      return;
    }
    if (type === 'pong' || type === 'ping') return;
    if (type === 'error') {
      this.options.onError?.(new Error(typeof message.error === 'string' ? message.error : 'The cloud relay reported an error.'));
      return;
    }
    if (type === 'NEW_ORDER') {
      // The relay is outside our trust boundary: an accepted connection is not
      // proof that a payload is well formed, so it goes through the same
      // validator the local gateway applies to customer orders.
      if (!isPrintJob(message.job)) {
        this.options.onError?.(new Error('The cloud relay sent an invalid order payload.'));
        return;
      }
      this.options.onOrder(message.job);
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    const base = this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    const delay = Math.min(base * Math.pow(1.7, this.reconnectAttempts), MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts += 1;
    this.setStatus('reconnecting');
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }
}
