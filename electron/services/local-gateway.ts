import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { PrintJob } from '../../src/shared/types.js';
import type { CustomerAppConfig } from '../../src/shared/desktop-api.js';
import { isPrintJob } from './job-websocket.js';

const MAX_REQUEST_BYTES = 56 * 1024 * 1024;
const HEARTBEAT_TIMEOUT_MS = 30_000;
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
  onCounterHeartbeat: (counterId: string, online: boolean) => void;
  onError: (error: Error) => void;
}

export class LocalGateway {
  private readonly server: Server;
  private readonly heartbeats = new Map<string, number>();
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
  }

  listen(): void {
    this.server.listen(this.options.port, this.options.tls ? '0.0.0.0' : '127.0.0.1');
  }

  close(): void {
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
      const body = await this.readJson(request, response, MAX_REQUEST_BYTES);
      if (!body) return;
      if (!this.customerConfig) {
        this.sendJson(response, 503, { error: 'The shop is still loading its customer settings.' });
        return;
      }
      const job = body as unknown as PrintJob;
      const allowedCounter = this.customerConfig.counters.some(counter => counter.id === job.counterId);
      if (!allowedCounter || !isPrintJob(job)) {
        this.sendJson(response, 400, { error: 'The order details are invalid or the selected counter does not exist.' });
        return;
      }
      try {
        const acceptedJob = this.options.onCustomerOrder(job);
        this.sendJson(response, 201, { job: acceptedJob });
      } catch (error) {
        this.sendJson(response, 500, { error: error instanceof Error ? error.message : 'The shop could not save this order.' });
      }
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
    let filePath = resolve(webRoot, normalizedPath || 'index.html');
    if (filePath !== webRoot && !filePath.startsWith(webRoot + sep)) {
      response.writeHead(403).end();
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = join(webRoot, 'index.html');
    if (!existsSync(filePath)) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('The customer app has not been built.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
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
