import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrintJob, ShopCounter, ShopProfile, ServicePricing } from '../../types';
import { createJobId, nextTokenNumber } from '../jobIdentity';
import {
  approveJobTransition,
  collectNewlyCompleted,
  rejectJobTransition,
  tickJobRetention,
} from '../jobLifecycle';
import { PRICING_KEY_BY_SERVICE, priceForService, unitPriceForService } from '../pricing';
import { isIdentityDocument, isPdfJob, jobDisplayName, jobStatusLabelKey } from '../jobDisplay';
import {
  COUNTERS_STORAGE_KEY,
  loadPersisted,
  savePersisted,
  validators,
} from '../persistedState';
import { INITIAL_PRINTERS, matchPrinterForJob } from '../../../features/printers/printerRouting';

// ---------------------------------------------------------------- jobIdentity

test('createJobId produces collision-free, dated IDs', () => {
  const ids = new Set<string>();
  for (let index = 0; index < 500; index += 1) {
    const id = createJobId();
    assert.match(id, /^JOB-\d{8}-[A-Z0-9]{8,}$/);
    ids.add(id);
  }
  assert.equal(ids.size, 500, 'job IDs must never repeat within a session');
});

test('nextTokenNumber never reuses a visible or previously issued code', () => {
  // Empty state starts above the old hard-coded 127 base.
  assert.equal(nextTokenNumber([], 0), 128);
  // Visible jobs on the board are skipped even when the session sequence reset.
  assert.equal(nextTokenNumber(['130', '131'], 0), 132);
  // Monotonic within a session even if visible jobs already auto-deleted.
  assert.equal(nextTokenNumber([], 200), 201);
  assert.equal(nextTokenNumber(['130'], 200), 201);
  // Non-numeric tokens are ignored instead of poisoning the sequence.
  assert.equal(nextTokenNumber(['ABC', '', ''], 0), 128);
});

// -------------------------------------------------------------------- pricing

const pricing: ServicePricing = {
  passport4in1: 40,
  passport8in1: 70,
  stampPhoto: 15,
  nidSmartCard: 30,
  nidNormalA4: 10,
  photo4R: 25,
  photo6R: 35,
  docA4BW: 5,
  docA4Color: 12,
};

test('priceForService applies the shared unit-price mapping', () => {
  assert.equal(priceForService('passport_photo', pricing, { gridCount: 8 }), 70);
  assert.equal(priceForService('passport_photo', pricing, { gridCount: 4 }), 40);
  assert.equal(priceForService('passport_photo', pricing), 40, 'defaults to the 4-in-1 sheet');
  assert.equal(priceForService('nid_card', pricing), 30);
  assert.equal(priceForService('photo_4r', pricing), 25);
  assert.equal(priceForService('doc_a4', pricing, { colorMode: 'color' }), 12);
  assert.equal(priceForService('doc_a4', pricing, { colorMode: 'bw' }), 5);
  assert.equal(priceForService('doc_a4', pricing), 5, 'defaults to B&W');
});

test('priceForService multiplies by copies and falls back for unknown services', () => {
  assert.equal(priceForService('doc_a4', pricing, { colorMode: 'bw', copies: 3 }), 15);
  assert.equal(priceForService('custom_service', pricing, { copies: 2 }), 70, '35 BDT fallback × 2');
  assert.equal(unitPriceForService('custom_service', pricing), 35);
});

test('PRICING_KEY_BY_SERVICE maps every built-in service to its pricing key', () => {
  assert.equal(PRICING_KEY_BY_SERVICE.passport_photo, 'passport4in1');
  assert.equal(PRICING_KEY_BY_SERVICE.stamp_photo, 'stampPhoto');
  assert.equal(PRICING_KEY_BY_SERVICE.nid_card, 'nidSmartCard');
  assert.equal(PRICING_KEY_BY_SERVICE.photo_4r, 'photo4R');
  assert.equal(PRICING_KEY_BY_SERVICE.doc_a4, 'docA4BW');
});

// -------------------------------------------------------------- jobLifecycle

const createJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'JOB-20261009-TEST01',
  tokenCode: '128',
  customerPhone: '01700000000',
  customerName: 'Test Customer',
  serviceType: 'doc_a4',
  serviceLabel: 'A4 Document',
  serviceLabelBn: 'A4 ডকুমেন্ট',
  paperSize: 'A4 (8.27x11.69 in)',
  paperFinish: 'normal',
  copies: 2,
  colorMode: 'color',
  status: 'queued',
  targetPrinterId: 'printer-test',
  targetPrinterName: 'Test Printer',
  routingReason: 'Test',
  priceBDT: 20,
  paymentMethod: 'counter_cash',
  paymentStatus: 'unpaid',
  fileUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
  fileName: 'test.pdf',
  fileSize: '1 KB',
  createdAt: Date.now(),
  autoDeleteCountdownSeconds: 900,
  auditLogs: [],
  ...overrides,
});

test('approveJobTransition moves a queued job to approved with an audit entry', () => {
  const approved = approveJobTransition(createJob(), 1_000);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.copies, 2, 'unrelated fields are preserved');
  assert.equal(approved.auditLogs.length, 1);
  assert.equal(approved.auditLogs[0].action, 'order_approved');
  assert.equal(approved.auditLogs[0].actor, 'shopkeeper');
  assert.equal(approved.auditLogs[0].timestamp, 1_000);
});

test('rejectJobTransition rejects with reason, short retention, and an audit entry', () => {
  const rejected = rejectJobTransition(createJob(), 'blurry_photo', 'খারাপ ছবি', 2_000);
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.rejectReason, 'blurry_photo');
  assert.equal(rejected.rejectNote, 'খারাপ ছবি');
  assert.equal(rejected.autoDeleteCountdownSeconds, 120);
  assert.equal(rejected.auditLogs.at(-1)?.action, 'order_rejected');
});

test('tickJobRetention only ticks jobs that are eligible for deletion (BUG-006)', () => {
  const pending = createJob({ autoDeleteCountdownSeconds: 0 });
  const completed = createJob({ id: 'done-1', status: 'completed', completedAt: Date.now(), autoDeleteCountdownSeconds: 5 });

  const [tickedPending, tickedCompleted] = tickJobRetention([pending, completed]);
  assert.equal(tickedPending.autoDeleteCountdownSeconds, 0, 'pending jobs keep their value');
  assert.equal(tickedCompleted.autoDeleteCountdownSeconds, 4, 'completed jobs tick down');
});

test('tickJobRetention deletes completed/rejected jobs when the countdown runs out', () => {
  const almostDone = createJob({ id: 'done-2', status: 'completed', completedAt: Date.now(), autoDeleteCountdownSeconds: 3 });
  const rejected = createJob({ id: 'rej-1', status: 'rejected', autoDeleteCountdownSeconds: 4 });

  const afterOneTick = tickJobRetention([almostDone, rejected]);
  assert.deepEqual(afterOneTick.map(job => job.autoDeleteCountdownSeconds), [2, 3], 'still above the delete boundary');

  const afterTwoTicks = tickJobRetention(afterOneTick);
  assert.equal(afterTwoTicks.length, 1, 'a completed job hitting 1 is auto-deleted');
  assert.equal(afterTwoTicks[0].id, 'rej-1');

  const afterThreeTicks = tickJobRetention(afterTwoTicks);
  assert.deepEqual(afterThreeTicks, [], 'the rejected job is deleted when its countdown hits 1');
});

test('tickJobRetention is a no-op (same reference) when nothing eligible is present', () => {
  const jobs = [
    createJob({ id: 'q1' }),
    createJob({ id: 'q2', status: 'printing' }),
    createJob({ id: 'q3', status: 'failed' }),
  ];
  assert.equal(tickJobRetention(jobs), jobs, 'a no-op tick must not trigger a re-render');
});

test('collectNewlyCompleted counts each completion once, this session only (BUG-007)', () => {
  const now = Date.now();
  const jobs = [
    createJob({ id: 'old-completed', status: 'completed', completedAt: now - 60_000 }),
    createJob({ id: 'fresh-completed', status: 'completed', completedAt: now + 1_000 }),
    createJob({ id: 'still-queued' }),
  ];

  const firstPass = collectNewlyCompleted(jobs, new Set(), now);
  assert.deepEqual(firstPass.map(job => job.id), ['fresh-completed'],
    'only this session\'s completions count — pre-session rows rehydrated from SQLite are skipped, so persisted stats start at zero and are never double-counted');

  const counted = new Set(firstPass.map(job => job.id));
  assert.deepEqual(collectNewlyCompleted(jobs, counted, now), [],
    'a second pass must never double-count the same completion');
});

// --------------------------------------------------------------- printerRouting

test('matchPrinterForJob routes photo services to the online photo printer', () => {
  const result = matchPrinterForJob('passport_photo', '4R (4x6 in)', 'color', INITIAL_PRINTERS);
  assert.equal(result.printerId, 'printer_epson_l805');
  assert.equal(result.isPreferred, true);
  assert.equal(result.requiresFallback, false);
  assert.ok(result.optimalDpi > 0);
});

test('matchPrinterForJob routes NID/B&W documents to the online laser printer', () => {
  const result = matchPrinterForJob('nid_card', 'A4 (8.27x11.69 in)', 'bw', INITIAL_PRINTERS);
  assert.equal(result.printerId, 'printer_hp_laserjet');
  assert.equal(result.requiresFallback, false);
});

test('matchPrinterForJob never picks an offline printer while an online one fits', () => {
  const result = matchPrinterForJob('doc_a4', 'A4 (8.27x11.69 in)', 'color', INITIAL_PRINTERS);
  assert.notEqual(result.printerId, 'printer_canon_g3010', 'the Canon demo device is offline');
  assert.ok(['printer_epson_l805', 'printer_hp_laserjet'].includes(result.printerId));
});

test('matchPrinterForJob falls back with an alert when the only capable printer is offline', () => {
  const offlineOnly = INITIAL_PRINTERS
    .filter(printer => printer.id === 'printer_canon_g3010')
    .map(printer => ({ ...printer, status: 'offline' as const }));
  const result = matchPrinterForJob('doc_a4', 'A4 (8.27x11.69 in)', 'color', offlineOnly);
  assert.equal(result.printerId, 'printer_canon_g3010');
  assert.equal(result.requiresFallback, true);
  assert.match(result.reason, /OFFLINE/);
});

test('matchPrinterForJob degrades to a generic spooler when no devices are registered', () => {
  const result = matchPrinterForJob('doc_a4', 'A4 (8.27x11.69 in)', 'color', []);
  assert.equal(result.requiresFallback, true);
  assert.equal(result.printerId, 'printer_epson_l805');
  assert.match(result.reason, /generic spooler/);
});

// -------------------------------------------------------------- persistedState

const installLocalStorageMock = () => {
  const store = new Map<string, string>();
  (globalThis as unknown as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };
  return store;
};

const counters: ShopCounter[] = [{
  id: 'CTR-01',
  code: 'CTR-1',
  name: 'কাউন্টার ১',
  operator: 'মো: শাকিল',
  ipAddress: '192.168.1.110',
  status: 'active',
  isMasterHost: true,
  assignedServices: ['doc_a4'],
  defaultPrinterId: 'printer_epson_l805',
  todayOrdersCount: 3,
  todayEarningsBDT: 150,
}];

const shopProfile: ShopProfile = {
  id: 'shop-1',
  name: 'RCD Studio',
  nameBn: 'আরসিডি স্টুডিও',
  code: 'RCD-8K29',
  owner: 'Owner',
  phone: '01700000000',
  address: 'Dhaka',
  token: 'abc123',
  bkashNumber: '01700000000',
  nagadNumber: '01700000000',
  soundAlertEnabled: true,
  isDndMode: false,
  voiceGuide: { enabled: false, defaultLang: 'bn', defaultSpeed: 1.0 },
  localServer: { status: 'running', port: 43821, localIp: '192.168.1.2', connectedClients: 0, uptimeSeconds: 0 },
};

test('loadPersisted restores valid saved state and round-trips through savePersisted', () => {
  installLocalStorageMock();
  savePersisted(COUNTERS_STORAGE_KEY, counters);
  const restored = loadPersisted(COUNTERS_STORAGE_KEY, validators.counters, []);
  assert.deepEqual(restored, counters);
});

test('loadPersisted falls back to defaults for corrupt or invalid JSON', () => {
  const store = installLocalStorageMock();
  store.set('bad-json', '{not json');
  const fallback = [{ ...counters[0] }];
  assert.equal(loadPersisted('bad-json', validators.counters, fallback), fallback);

  store.set('wrong-shape', JSON.stringify([{ id: 5 }]));
  assert.equal(loadPersisted('wrong-shape', validators.counters, fallback), fallback);

  // A missing key is not an error — just the defaults.
  assert.equal(loadPersisted('missing-key', validators.counters, fallback), fallback);
});

test('persistedState validators reject structurally broken entries', () => {
  assert.equal(validators.counters([counters[0], { id: 'CTR-02' }]), false);
  assert.equal(validators.counters(counters), true);
  assert.equal(validators.pricing(pricing), true);
  assert.equal(validators.pricing({ passport4in1: '40' }), false);
  assert.equal(validators.shopProfile(shopProfile), true);
  assert.equal(validators.shopProfile({ ...shopProfile, soundAlertEnabled: 'yes' }), false);
  assert.equal(validators.printers(INITIAL_PRINTERS), true);
  assert.equal(validators.printers([{ id: 'x' }]), false);
});

// ---------------------------------------------------------------- jobDisplay

test('identity documents never expose their upload file name', () => {
  assert.equal(isIdentityDocument(createJob()), false, 'a plain document keeps its name');

  const nidJob = createJob({ serviceType: 'nid_card', fileName: 'nid_shakil_photo.jpg' });
  assert.equal(isIdentityDocument(nidJob), true);
  assert.equal(jobDisplayName(nidJob, 'NID Photo'), nidJob.serviceLabel);
  assert.notEqual(jobDisplayName(nidJob, 'NID Photo'), nidJob.fileName);

  // A passport photo uploaded under a personal name is still an identity document.
  const passportJob = createJob({
    serviceType: 'passport_photo',
    serviceLabel: 'Passport Photo',
    fileName: 'rahim-copy.jpg'
  });
  assert.equal(jobDisplayName(passportJob, 'NID Photo'), 'Passport Photo');
});

test('isPdfJob recognises PDF jobs regardless of how they are stored', () => {
  assert.equal(isPdfJob(createJob()), true, 'base64 PDF data URL');
  assert.equal(isPdfJob(createJob({ fileUrl: 'blob:local', fileName: 'form.PDF' })), true);
  assert.equal(isPdfJob(createJob({ fileUrl: 'blob:local', fileName: 'photo.jpg' })), false);
});

test('jobStatusLabelKey groups every pre-print state under the pending label', () => {
  assert.equal(jobStatusLabelKey('queued'), 'job.status.pending');
  assert.equal(jobStatusLabelKey('approved'), 'job.status.pending');
  assert.equal(jobStatusLabelKey('routing'), 'job.status.pending');
  assert.equal(jobStatusLabelKey('printing'), 'job.status.printing');
  assert.equal(jobStatusLabelKey('completed'), 'job.status.printed');
  assert.equal(jobStatusLabelKey('failed'), 'job.status.failed');
  assert.equal(jobStatusLabelKey('rejected'), 'job.status.rejected');
});
