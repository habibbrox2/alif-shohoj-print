import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { CustomerAppConfig } from '../../../src/shared/desktop-api.js';
import type { PrintJob } from '../../../src/shared/types.js';
import { CounterFeedSecretStore } from '../counter-feed-client.js';
import { pullCounterFeed } from '../counter-feed-client.js';
import { CounterFeedStore } from '../counter-feed-store.js';
import { LocalGateway } from '../local-gateway.js';
import { createTestJob } from './test-job.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));

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

const createConfig = (): CustomerAppConfig => ({
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
    isDndMode: false,
  },
  counters: [
    {
      id: 'CTR-01',
      code: 'CTR-1',
      name: 'Master Counter',
      operator: 'Owner',
      ipAddress: '127.0.0.1',
      status: 'active',
      isMasterHost: true,
      assignedServices: [],
      defaultPrinterId: 'printer-test',
      todayOrdersCount: 0,
      todayEarningsBDT: 0,
    },
    {
      id: 'CTR-02',
      code: 'CTR-2',
      name: 'Counter Two',
      operator: 'Operator',
      ipAddress: '127.0.0.2',
      status: 'active',
      isMasterHost: false,
      assignedServices: [],
      defaultPrinterId: 'printer-test',
      todayOrdersCount: 0,
      todayEarningsBDT: 0,
    },
  ],
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

test('the counter PC stores its pairing key outside the renderer and can clear it', () => {
  const directory = mkdtempSync(join(testDirectory, '.counter-feed-client-'));
  try {
    const store = new CounterFeedSecretStore(directory);
    assert.equal(store.has(), false);
    assert.equal(store.read(), null);

    assert.throws(() => store.set('not-a-key'));
    assert.throws(() => store.set('a'.repeat(63)));
    assert.equal(store.has(), false, 'a rejected key must not be saved');

    const key = 'd'.repeat(64);
    store.set(key);
    assert.equal(store.has(), true);
    assert.equal(store.read(), key);
    if (process.platform !== 'win32') {
      assert.equal(statSync(join(directory, 'counter-feed.secret')).mode & 0o777, 0o600);
    }

    const reopened = new CounterFeedSecretStore(directory);
    assert.equal(reopened.read(), key);

    store.clear();
    assert.equal(store.has(), false);
    assert.equal(store.read(), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a stored counter key is encrypted when a codec is available', () => {
  const directory = mkdtempSync(join(testDirectory, '.counter-feed-codec-'));
  try {
    const key = 'e'.repeat(64);
    const store = new CounterFeedSecretStore(directory, {
      encrypt: value => Buffer.from(value, 'utf8').reverse().toString('base64'),
      decrypt: value => Buffer.from(value, 'base64').toString('utf8').split('').reverse().join(''),
    });
    store.set(key);
    assert.equal(store.isProtected(), true);
    assert.equal(store.read(), key);
    const raw = readFileSync(join(directory, 'counter-feed.secret'), 'utf8');
    assert.equal(raw.includes(key), false, 'the stored file must not contain the key in clear text');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a paired counter PC pulls only its own orders from the master gateway', async () => {
  const masterDirectory = mkdtempSync(join(testDirectory, '.counter-feed-master-'));
  const counterDirectory = mkdtempSync(join(testDirectory, '.counter-feed-counter-'));
  const port = await getAvailablePort();
  const feedStore = new CounterFeedStore(masterDirectory);
  const key = feedStore.getOrCreateKey('CTR-02');
  const jobs: PrintJob[] = [
    { ...createTestJob(), id: 'ctr-02-job', counterId: 'CTR-02', tokenCode: '301', customerPhone: '01711111111', createdAt: 9_000 },
    { ...createTestJob(), id: 'ctr-01-job', counterId: 'CTR-01', tokenCode: '302', createdAt: 10_000 },
  ];
  const gateway = new LocalGateway({
    port,
    webRoot: process.cwd(),
    onCustomerOrder: job => job,
    getPendingOrderCount: () => 0,
    onCounterHeartbeat: () => undefined,
    onError: () => undefined,
    verifyCounterFeedKey: (counterId, candidate) => feedStore.verify(counterId, candidate),
    getCounterFeedOrders: counterId => jobs.filter(job => job.counterId === counterId),
  });
  const listening = new Promise<void>(resolve => gateway.onListening(resolve));
  gateway.listen();

  const masterUrl = `http://127.0.0.1:${port}`;
  try {
    await listening;
    gateway.publishCustomerConfig(createConfig());

    const secret = new CounterFeedSecretStore(counterDirectory);
    secret.set(key);

    const result = await pullCounterFeed({
      masterUrl,
      counterId: 'CTR-02',
      key: secret.read() ?? '',
      allowInsecureHttp: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.orders.map(order => order.id), ['ctr-02-job']);
    assert.equal(JSON.stringify(result.orders).includes('01711111111'), false);

    const wrongKey = await pullCounterFeed({
      masterUrl,
      counterId: 'CTR-02',
      key: 'f'.repeat(64),
      allowInsecureHttp: true,
    });
    assert.equal(wrongKey.ok, false);
    assert.equal(wrongKey.ok === false && wrongKey.reason, 'unauthorized');

    const insecure = await pullCounterFeed({ masterUrl, counterId: 'CTR-02', key, allowInsecureHttp: false });
    assert.equal(insecure.ok, false);
    assert.equal(insecure.ok === false && insecure.reason, 'unreachable');

    const unreachable = await pullCounterFeed({
      masterUrl: 'http://127.0.0.1:1',
      counterId: 'CTR-02',
      key,
      allowInsecureHttp: true,
      timeoutMs: 500,
    });
    assert.equal(unreachable.ok, false);
    assert.equal(unreachable.ok === false && unreachable.reason, 'unreachable');

    const rotated = feedStore.rotateKey('CTR-02');
    const stale = await pullCounterFeed({ masterUrl, counterId: 'CTR-02', key, allowInsecureHttp: true });
    assert.equal(stale.ok, false, 'a rotated key must stop working at once');
    const fresh = await pullCounterFeed({ masterUrl, counterId: 'CTR-02', key: rotated, allowInsecureHttp: true });
    assert.equal(fresh.ok, true);
  } finally {
    gateway.close();
    rmSync(masterDirectory, { recursive: true, force: true });
    rmSync(counterDirectory, { recursive: true, force: true });
  }
});
