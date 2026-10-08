import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import test from 'node:test';
import { WebSocket } from 'ws';
import { JobStore } from '../job-store.js';
import { startJobWebSocket } from '../job-websocket.js';
import { createTestJob } from './test-job.js';

const receiveJson = async (socket: WebSocket): Promise<{ type: string; id?: string; error?: string }> => {
  const [message] = await once(socket, 'message');
  return JSON.parse(message.toString()) as { type: string; id?: string; error?: string };
};

test('requires TLS before exposing the service to a LAN interface', () => {
  const directory = mkdtempSync(join(tmpdir(), 'broxprint-websocket-tls-'));
  const store = new JobStore(join(directory, 'queue.sqlite'));
  try {
    assert.throws(() => startJobWebSocket({
      host: '0.0.0.0',
      port: 0,
      token: 'local-test-token',
      store,
      onIncomingJob: () => undefined,
    }), /TLS certificate and key are required/i);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requires authentication and acknowledges only persisted jobs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'broxprint-websocket-'));
  const store = new JobStore(join(directory, 'queue.sqlite'));
  let incomingCount = 0;
  const server = startJobWebSocket({
    host: '127.0.0.1',
    port: 0,
    token: 'local-test-token',
    store,
    onIncomingJob: () => { incomingCount += 1; },
  });

  try {
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}`);
    await once(socket, 'open');
    socket.send(JSON.stringify({ type: 'auth', token: 'local-test-token' }));
    assert.equal((await receiveJson(socket)).type, 'authenticated');
    socket.send(JSON.stringify({ type: 'job', job: createTestJob() }));
    assert.deepEqual(await receiveJson(socket), { type: 'accepted', id: 'job-test-1', status: 'queued' });
    assert.equal(incomingCount, 1);

    socket.send(JSON.stringify({ type: 'job', job: createTestJob() }));
    assert.equal((await receiveJson(socket)).type, 'accepted');
    assert.equal(incomingCount, 1);
    assert.equal(store.list().length, 1);
    socket.close();
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
