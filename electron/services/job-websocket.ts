import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { WebSocket, WebSocketServer } from 'ws';
import type { PrintJob } from '../../src/shared/types.js';
import type { DesktopQueueJob } from '../../src/shared/desktop-api.js';
import { JobStore } from './job-store.js';

const MAX_MESSAGE_BYTES = 56 * 1024 * 1024;

export interface JobWebSocketOptions {
  host: string;
  port: number;
  token: string;
  tls?: { certPath: string; keyPath: string };
  store: JobStore;
  onIncomingJob: (queueJob: DesktopQueueJob) => void;
}

export const isPrintJob = (value: unknown): value is PrintJob => {
  if (!value || typeof value !== 'object') return false;
  const job = value as Partial<PrintJob>;
  return typeof job.id === 'string' && job.id.length > 0 && job.id.length <= 128 &&
    typeof job.fileUrl === 'string' && /^data:(application\/pdf|image\/(jpeg|png));base64,/i.test(job.fileUrl) &&
    Buffer.from(job.fileUrl.split(',')[1] || '', 'base64').byteLength <= 40 * 1024 * 1024 &&
    typeof job.fileName === 'string' && job.fileName.length <= 255 &&
    typeof job.serviceLabel === 'string' && typeof job.serviceLabelBn === 'string' &&
    typeof job.targetPrinterName === 'string' && job.targetPrinterName.length <= 256 &&
    Number.isInteger(job.copies) && (job.copies ?? 0) > 0 && (job.copies ?? 0) <= 100 &&
    typeof job.priceBDT === 'number' && Number.isFinite(job.priceBDT) &&
    typeof job.createdAt === 'number' && Number.isFinite(job.createdAt);
};

const safeTokenEquals = (candidate: string, expected: string): boolean => {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
};

export const startJobWebSocket = (options: JobWebSocketOptions): WebSocketServer => {
  if (!options.token) throw new Error('ALIF_SHOHOJ_PRINT_WS_TOKEN must be set before the WebSocket service starts.');
  const isLoopback = options.host === '127.0.0.1' || options.host === 'localhost' || options.host === '::1';
  if (!isLoopback && !options.tls) {
    throw new Error('TLS certificate and key are required when the WebSocket server is exposed beyond localhost.');
  }
  if (Boolean(options.tls?.certPath) !== Boolean(options.tls?.keyPath)) {
    throw new Error('Set both ALIF_SHOHOJ_PRINT_WS_TLS_CERT and ALIF_SHOHOJ_PRINT_WS_TLS_KEY to enable WSS.');
  }
  const tlsServer = options.tls
    ? createServer({
        cert: readFileSync(options.tls.certPath),
        key: readFileSync(options.tls.keyPath),
      })
    : undefined;
  const server = new WebSocketServer(
    tlsServer
      ? { server: tlsServer, maxPayload: MAX_MESSAGE_BYTES }
      : { host: options.host, port: options.port, maxPayload: MAX_MESSAGE_BYTES }
  );
  if (tlsServer) {
    tlsServer.on('error', error => server.emit('error', error));
    tlsServer.listen(options.port, options.host);
    // wss.close() never closes an externally managed server — shut the HTTPS
    // listener down too so before-quit releases the TLS port cleanly.
    server.on('close', () => tlsServer.close());
  }

  server.on('connection', socket => {
    let authenticated = false;
    const authTimer = setTimeout(() => socket.close(4001, 'Authentication required'), 5000);

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

      let message: { type?: string; token?: string; job?: unknown };
      try {
        message = JSON.parse(messageBuffer.toString()) as typeof message;
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid JSON.' }));
        return;
      }

      if (!authenticated) {
        if (message.type !== 'auth' || typeof message.token !== 'string' || !safeTokenEquals(message.token, options.token)) {
          socket.close(4003, 'Invalid credentials');
          return;
        }
        authenticated = true;
        clearTimeout(authTimer);
        socket.send(JSON.stringify({ type: 'authenticated' }));
        return;
      }

      if (message.type !== 'job' || !isPrintJob(message.job)) {
        socket.send(JSON.stringify({ type: 'rejected', error: 'Invalid print job payload.' }));
        return;
      }

      try {
        const existing = options.store.get(message.job.id);
        const queueJob = options.store.enqueue(message.job);
        if (!existing) options.onIncomingJob(queueJob);
        socket.send(JSON.stringify({ type: 'accepted', id: message.job.id, status: queueJob.status }));
      } catch (error) {
        socket.send(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Could not persist the print job.',
        }));
      }
    });

    socket.on('close', () => clearTimeout(authTimer));
    socket.on('error', () => clearTimeout(authTimer));
  });

  return server;
};

export const sendToSocket = (socket: WebSocket, message: unknown): void => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};
