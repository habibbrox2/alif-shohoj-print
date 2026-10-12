import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { CustomerAppConfig } from '../../../src/shared/desktop-api.js';
import type { PrintJob } from '../../../src/shared/types.js';
import { LocalGateway } from '../local-gateway.js';
import {
  COUNTER_FEED_FIELDS,
  COUNTER_FEED_KEY_HEADER,
  type CounterFeedOrder,
} from '../../../src/shared/services/counterFeed.js';
import { createTestJob } from './test-job.js';

const getAvailablePort = async (): Promise<number> => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const closed = once(server, 'close');
  server.close();
  await closed;
  return port;
};

const createConfig = (isDndMode: boolean): CustomerAppConfig => ({
  shopProfile: {
    id: 'shop-test',
    name: 'Test Shop',
    nameBn: 'টেস্ট শপ',
    code: 'TEST-01',
    phone: '01700000000',
    address: 'Test address',
    bkashNumber: '',
    nagadNumber: '',
    voiceGuide: { enabled: true, defaultLang: 'bn', defaultSpeed: 1 },
    isDndMode,
  },
  counters: [{
    id: 'CTR-01',
    code: 'CTR-1',
    name: 'Test Counter',
    operator: 'Test Operator',
    ipAddress: '127.0.0.1',
    status: 'active',
    isMasterHost: true,
    assignedServices: [],
    defaultPrinterId: 'printer-test',
    todayOrdersCount: 0,
    todayEarningsBDT: 0,
  }],
  printers: [],
  pricing: {
    passport4in1: 0,
    passport8in1: 0,
    stampPhoto: 0,
    nidSmartCard: 0,
    nidNormalA4: 0,
    photo4R: 0,
    photo6R: 0,
    docA4BW: 0,
    docA4Color: 0,
  },
  services: [],
  operationalPolicy: {
    businessHours: {
      enabled: false,
      timezone: 'Asia/Dhaka',
      daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      openTime: '09:00',
      closeTime: '17:00',
    },
    orderLimits: { maxPendingOrders: 20, maxCopies: 50, maxFileSizeMB: 20 },
    previewWatermarkEnabled: false,
  },
});

const testDirectory = dirname(fileURLToPath(import.meta.url));

test('the gateway serves the built entry documents from the resources/views directory', async () => {
  const webRoot = mkdtempSync(join(testDirectory, '.gateway-static-'));
  mkdirSync(join(webRoot, 'resources', 'views'), { recursive: true });
  writeFileSync(join(webRoot, 'resources', 'views', 'index.html'), '<html>counter pos</html>');
  writeFileSync(join(webRoot, 'resources', 'views', 'pwa.html'), '<html>customer app</html>');

  const port = await getAvailablePort();
  const gateway = new LocalGateway({
    port,
    webRoot,
    onCustomerOrder: job => job,
    getPendingOrderCount: () => 0,
    onCounterHeartbeat: () => undefined,
    onError: () => undefined,
  });
  const listening = new Promise<void>(resolve => gateway.onListening(resolve));
  gateway.listen();

  try {
    await listening;
    const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(rootResponse.status, 200);
    assert.match(await rootResponse.text(), /counter pos/);

    const pwaResponse = await fetch(`http://127.0.0.1:${port}/resources/views/pwa.html`);
    assert.equal(pwaResponse.status, 200);
    assert.match(await pwaResponse.text(), /customer app/);

    // Counter QR posters printed before the move still reach the customer app.
    const printedPoster = await fetch(`http://127.0.0.1:${port}/pwa.html`);
    assert.equal(printedPoster.status, 200);
    assert.match(await printedPoster.text(), /customer app/);
  } finally {
    gateway.close();
    rmSync(webRoot, { recursive: true, force: true });
  }
});

test('customer orders are rejected during Break Mode and accepted when it is off', async () => {
  const port = await getAvailablePort();
  const acceptedJobs: PrintJob[] = [];
  const errors: Error[] = [];
  const gateway = new LocalGateway({
    port,
    webRoot: process.cwd(),
    onCustomerOrder: job => {
      acceptedJobs.push(job);
      return job;
    },
    getPendingOrderCount: () => acceptedJobs.length,
    onCounterHeartbeat: () => undefined,
    onError: error => { errors.push(error); },
  });
  const listening = new Promise<void>(resolve => gateway.onListening(resolve));
  gateway.listen();

  try {
    await listening;
    gateway.publishCustomerConfig(createConfig(true));

    const configResponse = await fetch(`http://127.0.0.1:${port}/api/customer-config`);
    assert.equal(configResponse.status, 200);
    const publishedConfig = await configResponse.json() as CustomerAppConfig;
    assert.equal(publishedConfig.shopProfile.isDndMode, true);

    const order: PrintJob = { ...createTestJob(), counterId: 'CTR-01' };
    const rejectedResponse = await fetch(`http://127.0.0.1:${port}/api/customer-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    assert.equal(rejectedResponse.status, 503);
    assert.equal(acceptedJobs.length, 0);

    gateway.publishCustomerConfig(createConfig(false));
    const acceptedResponse = await fetch(`http://127.0.0.1:${port}/api/customer-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    assert.equal(acceptedResponse.status, 201);
    assert.equal(acceptedJobs.length, 1);
    assert.deepEqual(errors, []);
  } finally {
    gateway.close();
  }
});

test('the master gateway rejects customer orders that claim an MFS or already-collected payment', async () => {
  const port = await getAvailablePort();
  const acceptedJobs: PrintJob[] = [];
  const gateway = new LocalGateway({
    port,
    webRoot: process.cwd(),
    onCustomerOrder: job => {
      acceptedJobs.push(job);
      return job;
    },
    getPendingOrderCount: () => acceptedJobs.length,
    onCounterHeartbeat: () => undefined,
    onError: () => undefined,
  });
  const listening = new Promise<void>(resolve => gateway.onListening(resolve));
  gateway.listen();

  const post = (job: PrintJob) => fetch(`http://127.0.0.1:${port}/api/customer-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  });

  try {
    await listening;
    gateway.publishCustomerConfig(createConfig(false));

    const mfsOrder = await post({
      ...createTestJob(),
      counterId: 'CTR-01',
      paymentMethod: 'bkash',
      paymentStatus: 'paid_mfs',
    });
    assert.equal(mfsOrder.status, 400);

    const preCollected = await post({
      ...createTestJob(),
      counterId: 'CTR-01',
      paymentStatus: 'paid_counter',
    });
    assert.equal(preCollected.status, 400);
    assert.equal(acceptedJobs.length, 0);

    const counterCashOrder = await post({ ...createTestJob(), counterId: 'CTR-01' });
    assert.equal(counterCashOrder.status, 201);
    assert.equal(acceptedJobs.length, 1);
  } finally {
    gateway.close();
  }
});

test('the counter order feed requires that counter key and returns only its own sanitized orders', async () => {
  const port = await getAvailablePort();
  const counterKey = 'a'.repeat(64);
  const jobs: PrintJob[] = [
    { ...createTestJob(), id: 'job-counter-two', counterId: 'CTR-02', tokenCode: '201', createdAt: 5_000 },
    { ...createTestJob(), id: 'job-counter-two-done', counterId: 'CTR-02', tokenCode: '202', status: 'completed', createdAt: 6_000 },
    { ...createTestJob(), id: 'job-counter-three', counterId: 'CTR-01', tokenCode: '203', createdAt: 7_000 },
  ];
  const config = createConfig(false);
  config.counters = [
    ...config.counters,
    { ...config.counters[0], id: 'CTR-02', code: 'CTR-2', isMasterHost: false },
  ];
  const gateway = new LocalGateway({
    port,
    webRoot: process.cwd(),
    onCustomerOrder: job => job,
    getPendingOrderCount: () => 0,
    onCounterHeartbeat: () => undefined,
    onError: () => undefined,
    verifyCounterFeedKey: (counterId, key) => counterId === 'CTR-02' && key === counterKey,
    getCounterFeedOrders: counterId => jobs.filter(job => job.counterId === counterId),
  });
  const listening = new Promise<void>(resolve => gateway.onListening(resolve));
  gateway.listen();

  const pull = (key: string | null, query = 'counterId=CTR-02') => fetch(
    `http://127.0.0.1:${port}/api/counter-orders?${query}`,
    { headers: key === null ? {} : { [COUNTER_FEED_KEY_HEADER]: key } },
  );

  try {
    await listening;
    gateway.publishCustomerConfig(config);

    assert.equal((await pull(null)).status, 401, 'an unpaired request must be refused');
    assert.equal((await pull('b'.repeat(64))).status, 401, 'a wrong key must be refused');

    const response = await pull(counterKey);
    assert.equal(response.status, 200);
    const body = await response.json() as { counterId: string; orders: CounterFeedOrder[]; serverTime: number };
    assert.equal(body.counterId, 'CTR-02');
    assert.deepEqual(body.orders.map(order => order.id), ['job-counter-two-done', 'job-counter-two']);
    assert.equal(body.orders[0]?.status, 'completed');
    assert.equal(typeof body.serverTime, 'number');

    // The feed is the customer-facing side of the master queue: identity,
    // uploaded documents and audit history must never cross the LAN.
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes('customerPhone'), false);
    assert.equal(serialized.includes('customerName'), false);
    assert.equal(serialized.includes('fileUrl'), false);
    assert.equal(serialized.includes('fileName'), false);
    assert.equal(serialized.includes('auditLogs'), false);
    for (const order of body.orders) {
      assert.equal(Object.keys(order).every(field => COUNTER_FEED_FIELDS.includes(field)), true);
    }

    const since = await pull(counterKey, `counterId=CTR-02&since=6000`);
    const sinceBody = await since.json() as { orders: CounterFeedOrder[] };
    assert.deepEqual(sinceBody.orders.map(order => order.id), ['job-counter-two-done'], 'since must drop older orders');

    assert.equal((await pull(counterKey, 'counterId=CTR-09')).status, 400, 'an unknown counter must be refused');
    assert.equal((await pull(counterKey, 'counterId=../../etc')).status, 400);
    assert.equal((await pull(counterKey, 'counterId=CTR-01')).status, 401, 'a key is scoped to one counter');
  } finally {
    gateway.close();
  }
});

test('the counter order feed locks out a counter that keeps guessing its key', async () => {
  const port = await getAvailablePort();
  const config = createConfig(false);
  config.counters = [...config.counters, { ...config.counters[0], id: 'CTR-02', code: 'CTR-2', isMasterHost: false }];
  const gateway = new LocalGateway({
    port,
    webRoot: process.cwd(),
    onCustomerOrder: job => job,
    getPendingOrderCount: () => 0,
    onCounterHeartbeat: () => undefined,
    onError: () => undefined,
    verifyCounterFeedKey: () => false,
    getCounterFeedOrders: () => [],
  });
  const listening = new Promise<void>(resolve => gateway.onListening(resolve));
  gateway.listen();

  try {
    await listening;
    gateway.publishCustomerConfig(config);
    const attempt = () => fetch(`http://127.0.0.1:${port}/api/counter-orders?counterId=CTR-02`, {
      headers: { [COUNTER_FEED_KEY_HEADER]: 'c'.repeat(64) },
    });

    for (let index = 0; index < 10; index += 1) {
      assert.equal((await attempt()).status, 401);
    }
    assert.equal((await attempt()).status, 429, 'repeated failures must be throttled');
  } finally {
    gateway.close();
  }
});

test('the master gateway applies hours, copy/file limits, and pending capacity before accepting orders', async () => {
  const port = await getAvailablePort();
  const acceptedJobs: PrintJob[] = [];
  const gateway = new LocalGateway({
    port,
    webRoot: process.cwd(),
    onCustomerOrder: job => {
      acceptedJobs.push(job);
      return job;
    },
    getPendingOrderCount: () => acceptedJobs.length,
    onCounterHeartbeat: () => undefined,
    onError: () => undefined,
  });
  const listening = new Promise<void>(resolve => gateway.onListening(resolve));
  gateway.listen();

  const post = (job: PrintJob) => fetch(`http://127.0.0.1:${port}/api/customer-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  });

  try {
    await listening;
    const config = createConfig(false);
    const closedConfig: CustomerAppConfig = {
      ...config,
      operationalPolicy: {
        ...config.operationalPolicy,
        businessHours: {
          ...config.operationalPolicy.businessHours,
          enabled: true,
          // Empty day list: closed on every weekday, so this never depends on
          // the real clock (a named day like Monday is open on that day).
          daysOfWeek: [],
          openTime: '09:00',
          closeTime: '17:00',
        },
      },
    };
    gateway.publishCustomerConfig(closedConfig);
    const closedResponse = await post({ ...createTestJob(), counterId: 'CTR-01' });
    assert.equal(closedResponse.status, 503);
    assert.equal(acceptedJobs.length, 0);

    const limitedConfig: CustomerAppConfig = {
      ...config,
      operationalPolicy: {
        ...config.operationalPolicy,
        orderLimits: { maxPendingOrders: 1, maxCopies: 1, maxFileSizeMB: 1 },
      },
    };
    gateway.publishCustomerConfig(limitedConfig);
    const tooManyCopies = await post({ ...createTestJob(), counterId: 'CTR-01', copies: 2 });
    assert.equal(tooManyCopies.status, 413);
    const tooLarge = await post({
      ...createTestJob(`data:application/pdf;base64,${Buffer.alloc(1024 * 1024 + 1).toString('base64')}`),
      counterId: 'CTR-01',
      copies: 1,
    });
    assert.equal(tooLarge.status, 413);

    const concurrent = await Promise.all([
      post({ ...createTestJob(), counterId: 'CTR-01', copies: 1 }),
      post({ ...createTestJob(), counterId: 'CTR-01', copies: 1 }),
    ]);
    assert.deepEqual(concurrent.map(response => response.status).sort(), [201, 429]);
    assert.equal(acceptedJobs.length, 1);
  } finally {
    gateway.close();
  }
});
