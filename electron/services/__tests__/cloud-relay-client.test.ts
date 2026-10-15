import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import type { PrintJob } from '../../../src/shared/types.js';
import {
  buildRelayWebSocketUrl,
  CloudRelayClient,
  isValidRelayDeviceId,
  isValidRelayToken,
} from '../cloud-relay-client.js';
import { createTestJob } from './test-job.js';

const RELAY_URL = 'https://relay.alifshohojprint.example.com/ws';

const waitFor = async (predicate: () => boolean, timeoutMs = 4000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for condition');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

const startRelay = async (): Promise<{ server: WebSocketServer; port: number }> => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return { server, port };
};

test('the relay URL always upgrades to wss and carries the device ID', () => {
  assert.equal(buildRelayWebSocketUrl(RELAY_URL, 'SHOP-0001'), 'wss://relay.alifshohojprint.example.com/ws?deviceid=SHOP-0001');

  const withQuery = buildRelayWebSocketUrl('https://relay.example.com/ws?token=abc', 'SHOP-0001');
  assert.equal(withQuery, 'wss://relay.example.com/ws?deviceid=SHOP-0001');

  assert.throws(() => buildRelayWebSocketUrl('http://relay.example.com/ws', 'SHOP-0001'), /HTTPS/);
  assert.equal(
    buildRelayWebSocketUrl('http://relay.example.com/ws', 'SHOP-0001', true),
    'ws://relay.example.com/ws?deviceid=SHOP-0001',
  );
  assert.throws(() => buildRelayWebSocketUrl('ftp://relay.example.com/ws', 'SHOP-0001'), /http/);
});

test('device identifiers and tokens are validated before any connection is opened', () => {
  assert.equal(isValidRelayDeviceId('SHOP-0001'), true);
  assert.equal(isValidRelayDeviceId('shop'), false, 'too short');
  assert.equal(isValidRelayDeviceId('shop id'), false, 'spaces');
  assert.equal(isValidRelayToken('a'.repeat(64)), true);
  assert.equal(isValidRelayToken('short'), false);

  const errors: Error[] = [];
  const client = new CloudRelayClient({
    relayUrl: RELAY_URL,
    deviceId: 'bad id',
    token: 'a'.repeat(64),
    onOrder: () => assert.fail('a rejected client must never deliver an order'),
    onError: error => errors.push(error),
  });
  client.connect();
  assert.equal(errors.length, 1);
  assert.equal(client.getStatus(), null);
});

test('the relay client authenticates, heartbeats, and accepts only well-formed orders', async () => {
  const { server, port } = await startRelay();
  const orders: PrintJob[] = [];
  const errors: Error[] = [];
  const statuses: string[] = [];
  const client = new CloudRelayClient({
    relayUrl: `http://127.0.0.1:${port}/ws`,
    deviceId: 'SHOP-0001',
    token: 'a'.repeat(64),
    allowInsecure: true,
    reconnect: false,
    heartbeatIntervalMs: 40,
    onOrder: job => orders.push(job),
    onStatusChange: status => statuses.push(status),
    onError: error => errors.push(error),
  });

  try {
    client.connect();
    const [socket] = (await once(server, 'connection')) as [WebSocket];
    const auth = JSON.parse(String((await once(socket, 'message'))[0])) as Record<string, unknown>;
    assert.equal(auth.type, 'auth');
    assert.equal(auth.deviceId, 'SHOP-0001');
    assert.equal(auth.token, 'a'.repeat(64));

    socket.send(JSON.stringify({ type: 'authenticated' }));
    await waitFor(() => statuses.includes('authenticated'));
    assert.equal(client.getStatus(), 'authenticated');

    const ping = JSON.parse(String((await once(socket, 'message'))[0])) as Record<string, unknown>;
    assert.equal(ping.type, 'ping', 'the client must send a heartbeat while idle');

    socket.send(JSON.stringify({ type: 'NEW_ORDER', job: createTestJob() }));
    await waitFor(() => orders.length === 1);
    assert.equal(orders[0]?.id, 'job-test-1');

    socket.send(JSON.stringify({ type: 'NEW_ORDER', job: { id: 'only-an-id' } }));
    await waitFor(() => errors.length > 0);
    assert.equal(orders.length, 1, 'a malformed order must be discarded, not queued');

    socket.send(JSON.stringify({ type: 'error', error: 'quota reached' }));
    await waitFor(() => errors.some(error => error.message.includes('quota reached')));
  } finally {
    client.disconnect();
    server.close();
  }
});

test('the relay client reopens the connection after the relay drops it', async () => {
  const { server, port } = await startRelay();
  const statuses: string[] = [];
  const client = new CloudRelayClient({
    relayUrl: `http://127.0.0.1:${port}/ws`,
    deviceId: 'SHOP-0001',
    token: 'a'.repeat(64),
    allowInsecure: true,
    reconnectDelayMs: 20,
    heartbeatIntervalMs: 5000,
    onOrder: () => undefined,
    onStatusChange: status => statuses.push(status),
    onError: () => undefined,
  });

  try {
    client.connect();
    const first = (await once(server, 'connection'))[0] as WebSocket;
    await once(first, 'message');

    // Register the wait before dropping the link: the retry may land first.
    const reconnected = once(server, 'connection');
    first.close();
    await reconnected;

    assert.equal(statuses.includes('reconnecting'), true);
    assert.equal(client.getStatus(), 'reconnecting');
  } finally {
    client.disconnect();
    server.close();
  }
});
