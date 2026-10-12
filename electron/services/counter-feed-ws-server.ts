import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { WebSocket, WebSocketServer } from 'ws';
import {
  COUNTER_FEED_KEY_HEADER,
  COUNTER_FEED_KEY_PATTERN,
  COUNTER_ID_PATTERN,
  toCounterFeedOrder,
  type CounterFeedOrder,
} from '../../src/shared/services/counterFeed.js';
import type { PrintJob } from '../../src/shared/types.js';

const MAX_MESSAGE_BYTES = 1024 * 1024;
const AUTH_TIMEOUT_MS = 5000;

export interface CounterFeedWsOptions {
  host: string;
  port: number;
  tls?: { certPath: string; keyPath: string };
  verifyCounterFeedKey: (counterId: string, key: string) => boolean;
  getCounterFeedOrders: (counterId: string) => PrintJob[];
  onError: (error: Error) => void;
}

interface AuthenticatedClient {
  socket: WebSocket;
  counterId: string;
}

export class CounterFeedWsServer {
  private readonly server: WebSocketServer;
  private readonly clients = new Map<WebSocket, AuthenticatedClient>();
  private readonly tlsServer?: ReturnType<typeof createServer>;

  constructor(private readonly options: CounterFeedWsOptions) {
    const isLoopback =
      options.host === '127.0.0.1' || options.host === 'localhost' || options.host === '::1';
    if (!isLoopback && !options.tls) {
      throw new Error(
        'TLS certificate and key are required when the WebSocket server is exposed beyond localhost.',
      );
    }
    if (Boolean(options.tls?.certPath) !== Boolean(options.tls?.keyPath)) {
      throw new Error(
        'Set both ALIF_SHOHOJ_PRINT_WS_TLS_CERT and ALIF_SHOHOJ_PRINT_WS_TLS_KEY to enable WSS.',
      );
    }

    this.tlsServer = options.tls
      ? createServer({
          cert: readFileSync(options.tls.certPath),
          key: readFileSync(options.tls.keyPath),
        })
      : undefined;

    this.server = new WebSocketServer(
      this.tlsServer
        ? { server: this.tlsServer, maxPayload: MAX_MESSAGE_BYTES }
        : { host: options.host, port: options.port, maxPayload: MAX_MESSAGE_BYTES },
    );

    if (this.tlsServer) {
      this.tlsServer.on('error', error => this.server.emit('error', error));
      this.tlsServer.listen(options.port, options.host);
      this.server.on('close', () => this.tlsServer?.close());
    }

    this.server.on('error', options.onError);
    this.server.on('connection', socket => this.handleConnection(socket));
  }

  listen(): void {
    if (!this.tlsServer) {
      this.server.on('listening', () => undefined);
    }
  }

  close(): void {
    for (const [socket] of this.clients) {
      socket.close(1001, 'Server closing');
    }
    this.clients.clear();
    this.server.close();
    this.tlsServer?.close();
  }

  pushUpdate(counterId: string): void {
    const orders = this.options
      .getCounterFeedOrders(counterId)
      .map(job => toCounterFeedOrder(job))
      .filter((order): order is CounterFeedOrder => order !== null)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 100);

    const message = JSON.stringify({
      type: 'feed:update',
      counterId,
      serverTime: Date.now(),
      orders,
    });

    for (const [socket, client] of this.clients) {
      if (client.counterId === counterId && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  private handleConnection(socket: WebSocket): void {
    let authenticated = false;
    let client: AuthenticatedClient | null = null;
    const authTimer = setTimeout(() => {
      if (!authenticated) {
        socket.close(4001, 'Authentication required');
      }
    }, AUTH_TIMEOUT_MS);

    socket.on('message', rawMessage => {
      const messageBuffer = Array.isArray(rawMessage)
        ? Buffer.concat(rawMessage)
        : Buffer.isBuffer(rawMessage)
          ? rawMessage
          : Buffer.from(rawMessage);

      if (messageBuffer.byteLength > MAX_MESSAGE_BYTES) {
        socket.close(1009, 'Message too large');
        return;
      }

      let message: { type?: string; counterId?: string; key?: string };
      try {
        message = JSON.parse(messageBuffer.toString()) as typeof message;
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid JSON.' }));
        return;
      }

      if (!authenticated) {
        if (
          message.type !== 'auth' ||
          typeof message.counterId !== 'string' ||
          typeof message.key !== 'string'
        ) {
          socket.close(4003, 'Invalid credentials');
          return;
        }

        const counterId = message.counterId;
        const key = message.key.trim().toLowerCase();

        if (
          !COUNTER_ID_PATTERN.test(counterId) ||
          !COUNTER_FEED_KEY_PATTERN.test(key)
        ) {
          socket.close(4003, 'Invalid credentials');
          return;
        }

        if (!this.options.verifyCounterFeedKey(counterId, key)) {
          socket.close(4003, 'Invalid credentials');
          return;
        }

        authenticated = true;
        client = { socket, counterId };
        this.clients.set(socket, client);
        clearTimeout(authTimer);
        socket.send(JSON.stringify({ type: 'authenticated', counterId }));
        return;
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimer);
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      clearTimeout(authTimer);
      this.clients.delete(socket);
    });
  }
}
