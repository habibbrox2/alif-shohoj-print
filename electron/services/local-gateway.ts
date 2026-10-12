import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import type { PrintJob } from '../../src/shared/types.js';
import type { CustomerAppConfig } from '../../src/shared/desktop-api.js';
import {
  isWithinShopHours,
  validateCustomerOrderLimits,
  validateCustomerOrderPayment,
} from '../../src/shared/services/customerPolicy.js';
import { isPrintJob } from './job-websocket.js';
import {
  COUNTER_FEED_KEY_HEADER,
  COUNTER_FEED_KEY_PATTERN,
  COUNTER_FEED_MAX_ORDERS,
  COUNTER_ID_PATTERN,
  toCounterFeedOrder,
  type CounterFeedOrder,
} from '../../src/shared/services/counterFeed.js';

const MAX_REQUEST_BYTES = 56 * 1024 * 1024;
const HEARTBEAT_TIMEOUT_MS = 30_000;
// A counter PC may send one request every few seconds; more failed keys than
// this in a row is a guessing attempt, not a misconfigured counter.
const FEED_FAILURE_LIMIT = 10;
const FEED_LOCKOUT_MS = 60_000;
const WS_AUTH_TIMEOUT_MS = 5000;
const WS_MAX_MESSAGE_BYTES = 1024 * 1024;
// Built entry documents; Vite emits them under dist/resources/views/.
const DEFAULT_DOCUMENT = 'resources/views/index.html';
const FALLBACK_DOCUMENT = 'resources/views/pwa.html';
const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export interface LocalGatewayOptions {
  port: number;
  webRoot: string;
  tls?: { certPath: string; keyPath: string };
  onCustomerOrder: (job: PrintJob) => PrintJob;
  getPendingOrderCount: () => number;
  onCounterHeartbeat: (counterId: string, online: boolean) => void;
  onError: (error: Error) => void;
  /** Only provided by the master PC, which is the only host that serves a counter feed. */
  verifyCounterFeedKey?: (counterId: string, key: string) => boolean;
  getCounterFeedOrders?: (counterId: string) => PrintJob[];
  /** Optional callback when a counter feed WebSocket client authenticates. */
  onCounterFeedWsAuth?: (counterId: string) => void;
}

interface FeedFailureState {
  attempts: number;
  lockedUntil: number;
}

interface AuthenticatedWsClient {
  socket: WebSocket;
  counterId: string;
}

export class LocalGateway {
  private readonly server: Server;
  private readonly wsServer: WebSocketServer;
  private readonly wsClients = new Map<WebSocket, AuthenticatedWsClient>();
  private readonly heartbeats = new Map<string, number>();
  private readonly feedFailures = new Map<string, FeedFailureState>();
  private customerConfig: CustomerAppConfig | null = null;

  constructor(private readonly options: LocalGatewayOptions) {
    const handler = (request: IncomingMessage, response: ServerResponse) => {
      void this.handle(request, response).catch(error => {
        options.onError(error instanceof Error ? error : new Error(String(error)));
        if (!response.headersSent) this.sendJson(response, 500, { error: 'The gateway could not complete this request.' });
        else response.destroy();
      });
    };
    this.server = options.tls
      ? createSecureServer({ cert: readFileSync(options.tls.certPath), key: readFileSync(options.tls.keyPath) }, handler)
      : createServer(handler);
    this.server.on('error', options.onError);

    // Create WebSocket server attached to the same HTTP server
    this.wsServer = new WebSocketServer({ server: this.server, maxPayload: WS_MAX_MESSAGE_BYTES });
    this.wsServer.on('error', options.onError);
    this.wsServer.on('connection', (socket, request) => this.handleWsConnection(socket, request));
  }

  listen(): void {
    this.server.listen(this.options.port, this.options.tls ? '0.0.0.0' : '127.0.0.1');
  }

  close(): void {
    for (const [socket] of this.wsClients) {
      socket.close(1001, 'Server closing');
    }
    this.wsClients.clear();
    this.wsServer.close();
    this.server.close();
  }

  onListening(callback: () => void): void {
    this.server.on('listening', callback);
  }

  publishCustomerConfig(config: CustomerAppConfig): void {
    this.customerConfig = config;
  }

  getCounterStatuses(counterIds: string[]): Array<{ counterId: string; online: boolean; lastSeenAt: number | null }> {
    const now = Date.now();
    return counterIds.map(counterId => {
      const lastSeenAt = this.heartbeats.get(counterId) ?? null;
      const isMasterCounter = this.customerConfig?.counters.some(counter => counter.id === counterId && counter.isMasterHost) ?? false;
      return {
        counterId,
        online: isMasterCounter || (lastSeenAt !== null && now - lastSeenAt <= HEARTBEAT_TIMEOUT_MS),
        lastSeenAt,
      };
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    let pathname: string;
    try {
      pathname = new URL(request.url || '/', 'http://localhost').pathname;
    } catch {
      this.sendJson(response, 400, { error: 'The request URL is invalid.' });
      return;
    }
    if (request.method === 'GET' && pathname === '/api/health') {
      this.sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === 'GET' && pathname === '/api/customer-config') {
      if (!this.customerConfig) {
        this.sendJson(response, 503, { error: 'The shop is still loading its customer settings.' });
        return;
      }
      this.sendJson(response, 200, this.customerConfig);
      return;
    }
    if (request.method === 'POST' && pathname === '/api/counter-heartbeat') {
      const body = await this.readJson(request, response, 2048);
      if (!body) return;
      const counterId = typeof body.counterId === 'string' ? body.counterId : '';
      if (!/^CTR-[A-Z0-9-]{1,32}$/i.test(counterId)) {
        this.sendJson(response, 400, { error: 'A valid counter ID is required.' });
        return;
      }
      if (!this.customerConfig) {
        this.sendJson(response, 503, { error: 'The shop is still loading its counter settings.' });
        return;
      }
      if (!this.customerConfig.counters.some(counter => counter.id === counterId)) {
        this.sendJson(response, 400, { error: 'The counter is not configured on this master PC.' });
        return;
      }
      const wasOnline = this.getCounterStatuses([counterId])[0].online;
      this.heartbeats.set(counterId, Date.now());
      if (!wasOnline) this.options.onCounterHeartbeat(counterId, true);
      this.sendJson(response, 204, {});
      return;
    }
    if (request.method === 'POST' && pathname === '/api/customer-orders') {
      if (!this.customerConfig) {
        this.sendJson(response, 503, { error: 'The shop is still loading its customer settings.' });
        return;
      }
      if (this.customerConfig.shopProfile.isDndMode) {
        this.sendJson(response, 503, { error: 'The shop is temporarily closed to new orders.' });
        return;
      }
      const body = await this.readJson(request, response, MAX_REQUEST_BYTES);
      if (!body) return;
      const job = body as unknown as PrintJob;
      const allowedCounter = this.customerConfig.counters.some(counter => counter.id === job.counterId);
      if (!allowedCounter || !isPrintJob(job)) {
        this.sendJson(response, 400, { error: 'The order details are invalid or the selected counter does not exist.' });
        return;
      }
      const { businessHours, orderLimits } = this.customerConfig.operationalPolicy;
      if (!isWithinShopHours(Date.now(), businessHours)) {
        this.sendJson(response, 503, { error: 'The shop is currently outside its order acceptance hours.' });
        return;
      }
      const paymentError = validateCustomerOrderPayment(job);
      if (paymentError) {
        this.sendJson(response, 400, { error: paymentError });
        return;
      }
      const limitError = validateCustomerOrderLimits(job, orderLimits);
      if (limitError) {
        this.sendJson(response, 413, { error: limitError });
        return;
      }
      if (this.options.getPendingOrderCount() >= orderLimits.maxPendingOrders) {
        this.sendJson(response, 429, { error: 'The shop has reached its pending order limit. Please try again later.' });
        return;
      }
      try {
        // No await between checking capacity and persistence: onCustomerOrder
        // synchronously reserves a queue slot before another request can pass.
        const acceptedJob = this.options.onCustomerOrder(job);
        this.sendJson(response, 201, { job: acceptedJob });
      } catch (error) {
        this.sendJson(response, 500, { error: error instanceof Error ? error.message : 'The shop could not save this order.' });
      }
      return;
    }
    if (request.method === 'GET' && pathname === '/api/counter-orders') {
      this.handleCounterOrders(request, response);
      return;
    }
    if (request.method === 'GET' && pathname === '/api/counter-status') {
      const ids = (new URL(request.url || '/', 'http://localhost').searchParams.get('ids') || '')
        .split(',').filter(id => /^CTR-[A-Z0-9-]{1,32}$/i.test(id)).slice(0, 64);
      this.sendJson(response, 200, { counters: this.getCounterStatuses(ids) });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      this.sendJson(response, 404, { error: 'Not found.' });
      return;
    }
    this.serveStatic(pathname, response, request.method === 'HEAD');
  }

  /**
   * Serves one counter PC the orders that belong to it. This is the only route
   * that returns order data, so it is the only route that requires a pairing
   * key: a customer phone (or any other PC on the shop LAN) must not be able to
   * read another counter's orders.
   */
  private handleCounterOrders(request: IncomingMessage, response: ServerResponse): void {
    const { verifyCounterFeedKey, getCounterFeedOrders } = this.options;
    if (!verifyCounterFeedKey || !getCounterFeedOrders) {
      this.sendJson(response, 503, { error: 'This PC does not serve a counter order feed.' });
      return;
    }
    const url = new URL(request.url || '/', 'http://localhost');
    const counterId = url.searchParams.get('counterId') || '';
    if (!COUNTER_ID_PATTERN.test(counterId)) {
      this.sendJson(response, 400, { error: 'A valid counter ID is required.' });
      return;
    }
    if (!this.customerConfig) {
      this.sendJson(response, 503, { error: 'The shop is still loading its counter settings.' });
      return;
    }
    if (!this.customerConfig.counters.some(counter => counter.id === counterId)) {
      this.sendJson(response, 400, { error: 'The counter is not configured on this master PC.' });
      return;
    }

    const now = Date.now();
    const failures = this.feedFailures.get(counterId);
    if (failures && failures.lockedUntil > now) {
      this.sendJson(response, 429, { error: 'Too many rejected feed keys. Try again shortly.' });
      return;
    }

    const header = request.headers[COUNTER_FEED_KEY_HEADER];
    const providedKey = typeof header === 'string' ? header : '';
    if (!COUNTER_FEED_KEY_PATTERN.test(providedKey) || !verifyCounterFeedKey(counterId, providedKey)) {
      const attempts = (failures?.attempts ?? 0) + 1;
      this.feedFailures.set(counterId, {
        attempts,
        lockedUntil: attempts >= FEED_FAILURE_LIMIT ? now + FEED_LOCKOUT_MS : 0,
      });
      // Never echo the key or the expected value: only the fact of a mismatch.
      this.sendJson(response, 401, { error: 'The counter feed key was not accepted.' });
      return;
    }
    this.feedFailures.delete(counterId);

    const rawSince = Number(url.searchParams.get('since') ?? '0');
    const since = Number.isFinite(rawSince) && rawSince > 0 ? rawSince : 0;
    const orders = getCounterFeedOrders(counterId)
      .filter(job => job.createdAt >= since)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, COUNTER_FEED_MAX_ORDERS)
      .map(job => toCounterFeedOrder(job))
      .filter(order => order !== null);
    this.sendJson(response, 200, { counterId, serverTime: now, orders });
  }

  /**
   * Handles WebSocket connections for the counter feed.
   * The client must authenticate with { type: 'auth', counterId, key }.
   */
  private handleWsConnection(socket: WebSocket, request: IncomingMessage): void {
    const { verifyCounterFeedKey, getCounterFeedOrders, onCounterFeedWsAuth } = this.options;
    if (!verifyCounterFeedKey || !getCounterFeedOrders) {
      socket.close(4003, 'Counter feed not available on this PC');
      return;
    }

    let authenticated = false;
    let client: AuthenticatedWsClient | null = null;
    const authTimer = setTimeout(() => {
      if (!authenticated) socket.close(4001, 'Authentication required');
    }, WS_AUTH_TIMEOUT_MS);

    socket.on('message', rawMessage => {
      const messageBuffer = Array.isArray(rawMessage)
        ? Buffer.concat(rawMessage)
        : Buffer.isBuffer(rawMessage)
          ? rawMessage
          : Buffer.from(rawMessage);

      if (messageBuffer.byteLength > WS_MAX_MESSAGE_BYTES) {
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

        if (!verifyCounterFeedKey(counterId, key)) {
          socket.close(4003, 'Invalid credentials');
          return;
        }

        authenticated = true;
        client = { socket, counterId };
        this.wsClients.set(socket, client);
        clearTimeout(authTimer);
        socket.send(JSON.stringify({ type: 'authenticated', counterId }));
        onCounterFeedWsAuth?.(counterId);
        return;
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimer);
      this.wsClients.delete(socket);
    });

    socket.on('error', () => {
      clearTimeout(authTimer);
      this.wsClients.delete(socket);
    });
  }

  /**
   * Pushes a real-time update to all authenticated WebSocket clients for a counter.
   * Called when a new order arrives for that counter.
   */
  pushCounterFeedUpdate(counterId: string): void {
    const { getCounterFeedOrders } = this.options;
    if (!getCounterFeedOrders) return;

    const orders = getCounterFeedOrders(counterId)
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

    for (const [socket, client] of this.wsClients) {
      if (client.counterId === counterId && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  private serveStatic(pathname: string, response: ServerResponse, headOnly: boolean): void {
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const normalizedPath = normalize(decodedPath).replace(/^([/\\])+/, '');
    const webRoot = resolve(this.options.webRoot);
    let filePath = resolve(webRoot, normalizedPath || DEFAULT_DOCUMENT);
    if (filePath !== webRoot && !filePath.startsWith(webRoot + sep)) {
      response.writeHead(403).end();
      return;
    }
    // Unknown paths fall back to the customer PWA: the shopkeeper shell must
    // never be served to a customer phone that mistypes a URL.
    if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = join(webRoot, FALLBACK_DOCUMENT);
    if (!existsSync(filePath)) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('The customer app has not been built.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': extname(filePath).toLowerCase() === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    if (headOnly) response.end();
    else createReadStream(filePath).pipe(response);
  }

  private async readJson(request: IncomingMessage, response: ServerResponse, maxBytes: number): Promise<Record<string, unknown> | null> {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;
      if (size > maxBytes) {
        this.sendJson(response, 413, { error: 'The request is too large.' });
        request.destroy();
        return null;
      }
      chunks.push(buffer);
    }
    try {
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
      return value as Record<string, unknown>;
    } catch {
      this.sendJson(response, 400, { error: 'The request body must be a JSON object.' });
      return null;
    }
  }

  private sendJson(response: ServerResponse, status: number, body: unknown): void {
    const serialized = status === 204 ? '' : JSON.stringify(body);
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(serialized),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(serialized);
  }
}
