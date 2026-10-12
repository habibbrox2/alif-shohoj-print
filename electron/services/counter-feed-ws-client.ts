import { WebSocket } from 'ws';
import {
  COUNTER_FEED_KEY_PATTERN,
  COUNTER_ID_PATTERN,
  parseCounterFeedOrders,
  type CounterFeedOrder,
} from '../../src/shared/services/counterFeed.js';

export interface CounterFeedWsClientOptions {
  masterUrl: string;
  counterId: string;
  key: string;
  onUpdate: (orders: CounterFeedOrder[], serverTime: number) => void;
  onError: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  allowInsecureHttp?: boolean;
}

export class CounterFeedWsClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = false;
  private reconnectDelay: number;
  private reconnectAttempts = 0;

  constructor(private readonly options: CounterFeedWsClientOptions) {
    this.reconnectDelay = options.reconnectDelayMs ?? 5000;
    this.shouldReconnect = options.reconnect ?? true;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.open();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  private open(): void {
    if (!COUNTER_ID_PATTERN.test(this.options.counterId)) {
      this.options.onError(new Error('Invalid counter ID'));
      return;
    }
    if (!COUNTER_FEED_KEY_PATTERN.test(this.options.key)) {
      this.options.onError(new Error('Invalid feed key'));
      return;
    }

    let wsUrl: URL;
    try {
      wsUrl = new URL(this.options.masterUrl);
    } catch {
      this.options.onError(new Error('Invalid master URL'));
      return;
    }

    if (wsUrl.protocol === 'https:') {
      wsUrl.protocol = 'wss:';
    } else if (wsUrl.protocol === 'http:') {
      if (!this.options.allowInsecureHttp) {
        this.options.onError(new Error('WS requires HTTPS or allowInsecureHttp'));
        return;
      }
      wsUrl.protocol = 'ws:';
    } else {
      this.options.onError(new Error('Unsupported protocol'));
      return;
    }

    wsUrl.pathname = wsUrl.pathname.endsWith('/')
      ? wsUrl.pathname + 'counter-feed-ws'
      : wsUrl.pathname + '/counter-feed-ws';

    try {
      this.ws = new WebSocket(wsUrl.toString());
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.options.onOpen?.();
      // Authenticate
      this.ws?.send(
        JSON.stringify({
          type: 'auth',
          counterId: this.options.counterId,
          key: this.options.key,
        }),
      );
    });

    this.ws.on('message', raw => {
      const messageBuffer = Array.isArray(raw)
        ? Buffer.concat(raw)
        : Buffer.isBuffer(raw)
          ? raw
          : Buffer.from(raw);

      let message: unknown;
      try {
        message = JSON.parse(messageBuffer.toString());
      } catch {
        this.options.onError(new Error('Invalid JSON from server'));
        return;
      }

      if (!message || typeof message !== 'object') return;
      const msg = message as Record<string, unknown>;

      if (msg.type === 'authenticated') {
        return;
      }
      if (msg.type === 'feed:update') {
        const orders = parseCounterFeedOrders({ orders: msg.orders });
        if (orders) {
          const serverTime = typeof msg.serverTime === 'number' ? msg.serverTime : Date.now();
          this.options.onUpdate(orders, serverTime);
        }
        return;
      }
      if (msg.type === 'error') {
        const err = typeof msg.error === 'string' ? msg.error : 'Server error';
        this.options.onError(new Error(err));
      }
    });

    this.ws.on('close', () => {
      this.options.onClose?.();
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', error => {
      this.handleError(error);
    });
  }

  private handleError(error: Error): void {
    this.options.onError(error);
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }
}
