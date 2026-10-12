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
import { PRICING_KEY_BY_SERVICE, priceForService, priceForServiceOrder, unitPriceForService } from '../pricing';
import { SERVICE_PRESETS, createServiceFromPreset } from '../servicePresets';
import { INITIAL_STUDIO_SERVICES } from '../studioServices';
import { buildReportSummary } from '../reportMetrics';
import { SETTINGS_GROUPS } from '../../../features/desktop/pages/settingsGroups';
import { isIdentityDocument, isPdfJob, jobDisplayName, jobStatusLabelKey } from '../jobDisplay';
import {
  COUNTERS_STORAGE_KEY,
  loadPersisted,
  savePersisted,
  validators,
} from '../persistedState';
import { INITIAL_PRINTERS, matchPrinterForJob } from '../../../features/printers/printerRouting';
import {
  isWithinShopHours,
  isWithinWeeklyDndSchedule,
  validateCustomerOrderLimits,
  validateCustomerOrderPayment,
} from '../customerPolicy';
import {
  DEFAULT_APP_SETTINGS,
  isClockTime,
  type BusinessHoursSettings,
  type WeeklyDndSchedule,
} from '../../settings';
import { STRINGS, type TranslationKey } from '../../i18n/strings';
import { counterOrders, mergeCounterInbox, summarizeCounterOrders } from '../counterInbox';
import {
  COUNTER_FEED_KEY_PATTERN,
  isCounterFeedOrder,
  mergeFeedOrders,
  parseCounterFeedOrders,
  toCounterFeedOrder,
  type CounterFeedOrder,
} from '../counterFeed';
import {
  COUNTER_DESKTOP_TABS,
  AUXILIARY_WINDOW_BY_PAGE,
  MASTER_DESKTOP_TABS,
  defaultDesktopPage,
  desktopTabsForRole,
} from '../../../features/desktop/navigation';

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
  assert.equal(priceForService('stamp_photo', pricing), 15, 'stamp photo bills the stampPhoto tier, not the fallback');
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

test('priceForServiceOrder bills preset services at their own base price and keeps the tiered formula for built-ins', () => {
  const presetService = { id: 'custom_abc123', basePriceBDT: 18 };
  assert.equal(priceForServiceOrder(presetService, pricing, { copies: 2 }), 36);
  assert.equal(priceForServiceOrder({ id: 'doc_a4', basePriceBDT: 99 }, pricing, { colorMode: 'bw' }), 5, 'built-in services keep the shared pricing tier');
  assert.equal(priceForServiceOrder({ id: 'passport_photo', basePriceBDT: 99 }, pricing, { gridCount: 8 }), 70);
  assert.equal(priceForServiceOrder(undefined, pricing, { copies: 1 }), 35, 'unknown service keeps the 35 BDT fallback');
});

// ------------------------------------------------------------- servicePresets

test('SERVICE_PRESETS covers the default shop services with unique codes', () => {
  const codes = SERVICE_PRESETS.map(preset => preset.code);
  assert.equal(new Set(codes).size, codes.length, 'preset codes must be unique');
  for (const expected of ['IDCARD', 'A4BW', 'DOCFILE', 'PASSPORT4', 'PHOTO34R', 'STAMPPHOTO']) {
    assert.ok(codes.includes(expected), `missing preset ${expected}`);
  }
});

test('SERVICE_PRESETS codes never collide with the built-in service codes', () => {
  const builtinCodes = new Set(INITIAL_STUDIO_SERVICES.map(service => service.code.toUpperCase()));
  for (const preset of SERVICE_PRESETS) {
    assert.equal(builtinCodes.has(preset.code.toUpperCase()), false, `${preset.code} collides with a built-in service`);
  }
});

test('createServiceFromPreset produces a valid creatable service and copies preferences', () => {
  for (const preset of SERVICE_PRESETS) {
    const service = createServiceFromPreset(preset);
    assert.equal(service.code, preset.code);
    assert.equal(service.titleBn, preset.titleBn);
    assert.equal(service.enabled, true);
    assert.ok(service.basePriceBDT >= 0);
    assert.ok(service.preferences.dpi >= 1);
    assert.equal(service.preferences.defaultCopies >= 1 && Number.isInteger(service.preferences.defaultCopies), true);
    service.preferences.dpi = 1;
    assert.notEqual(preset.preferences.dpi, 1, 'preferences must be copied, not shared by reference');
  }
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

// --------------------------------------------------------------- reportMetrics

test('buildReportSummary uses local day and month boundaries for completed work', () => {
  const now = new Date(2026, 9, 10, 12);
  const dayStart = new Date(2026, 9, 10).getTime();
  const nextDay = new Date(2026, 9, 11).getTime();
  const monthStart = new Date(2026, 9, 1).getTime();
  const nextMonth = new Date(2026, 10, 1).getTime();

  const summary = buildReportSummary([
    createJob({ id: 'before-day', status: 'completed', completedAt: dayStart - 1, priceBDT: 100 }),
    createJob({ id: 'today', status: 'completed', completedAt: dayStart, priceBDT: 40, paymentStatus: 'unpaid' }),
    createJob({ id: 'tomorrow', status: 'completed', completedAt: nextDay, priceBDT: 200 }),
    createJob({ id: 'this-month', status: 'completed', completedAt: monthStart, priceBDT: 20 }),
    createJob({ id: 'next-month', status: 'completed', completedAt: nextMonth, priceBDT: 300 }),
  ], now);

  assert.deepEqual(summary.today, { printedJobs: 1, queuedJobs: 0, earningsBDT: 40 });
  assert.deepEqual(summary.thisMonth, { printedJobs: 4, queuedJobs: 0, earningsBDT: 360 });
});

test('buildReportSummary counts active and failed queue jobs by creation time, excluding rejected jobs', () => {
  const now = new Date(2026, 9, 10, 12);
  const dayStart = new Date(2026, 9, 10).getTime();
  const nextDay = new Date(2026, 9, 11).getTime();

  const summary = buildReportSummary([
    createJob({ id: 'queued-today', status: 'queued', createdAt: dayStart }),
    createJob({ id: 'failed-today', status: 'failed', createdAt: dayStart + 1 }),
    createJob({ id: 'rejected-today', status: 'rejected', createdAt: dayStart + 2 }),
    createJob({ id: 'queued-tomorrow', status: 'queued', createdAt: nextDay }),
  ], now);

  assert.deepEqual(summary.today, { printedJobs: 0, queuedJobs: 2, earningsBDT: 0 });
});

test('buildReportSummary returns zero totals for an empty job list', () => {
  const summary = buildReportSummary([], new Date(2026, 9, 10, 12));
  assert.deepEqual(summary.today, { printedJobs: 0, queuedJobs: 0, earningsBDT: 0 });
  assert.deepEqual(summary.thisMonth, { printedJobs: 0, queuedJobs: 0, earningsBDT: 0 });
});

// --------------------------------------------------------------- settingsGroups

test('SETTINGS_GROUPS contains the ordered 11 setting groups and never disables audit logging', () => {
  assert.deepEqual(SETTINGS_GROUPS.map(group => group.id), [
    'shopOrders', 'services', 'approval', 'notifications', 'printers', 'voiceGuide',
    'payments', 'security', 'staff', 'agent', 'customize',
  ]);
  const shopOrderItems = SETTINGS_GROUPS.find(group => group.id === 'shopOrders')?.items;
  assert.equal(shopOrderItems?.find(item => item.id === 'acceptingOrders')?.status, 'supported');
  assert.equal(SETTINGS_GROUPS.find(group => group.id === 'agent')?.items.find(item => item.id === 'minimizeToTray')?.status, 'supported');
  const paymentItems = SETTINGS_GROUPS.find(group => group.id === 'payments')?.items;
  assert.equal(paymentItems?.find(item => item.id === 'counterPayment')?.status, 'required');
  for (const itemId of ['paymentMethods', 'automaticRefund']) {
    assert.equal(paymentItems?.find(item => item.id === itemId)?.status, 'comingSoon');
  }
  assert.ok(SETTINGS_GROUPS.some(group => group.items.some(item => item.status === 'comingSoon')));
  assert.equal(
    SETTINGS_GROUPS.some(group => group.items.some(item => item.id === 'auditLogDisable')),
    false,
  );
});

test('Approval settings expose auto approval while keeping audit logging required', () => {
  const approvalItems = SETTINGS_GROUPS.find(group => group.id === 'approval')?.items;
  const securityItems = SETTINGS_GROUPS.find(group => group.id === 'security')?.items;

  assert.equal(approvalItems?.find(item => item.id === 'autoApproval')?.status, 'supported');
  for (const itemId of ['manualApproval', 'orderEditing', 'priceConfirmation', 'approvalTimeout']) {
    assert.equal(approvalItems?.find(item => item.id === itemId)?.status, 'comingSoon');
  }
  assert.equal(securityItems?.find(item => item.id === 'auditLogStatus')?.status, 'required');
});

// --------------------------------------------------------------- counterInbox

test('a counter inbox lists only its own orders, newest first', () => {
  const orders = counterOrders([
    createJob({ id: 'older', counterId: 'CTR-02', createdAt: 1_000 }),
    createJob({ id: 'other-counter', counterId: 'CTR-03', createdAt: 3_000 }),
    createJob({ id: 'newer', counterId: 'CTR-02', createdAt: 2_000 }),
  ], 'CTR-02');

  assert.deepEqual(orders.map(order => order.id), ['newer', 'older']);
  assert.deepEqual(counterOrders([createJob({ counterId: 'CTR-02' })], ''), []);
});

test('counter order totals separate active, printed, rejected and failed work', () => {
  const orders = [
    createJob({ id: 'queued', status: 'queued', counterId: 'CTR-02' }),
    createJob({ id: 'printing', status: 'printing', counterId: 'CTR-02' }),
    createJob({ id: 'failed', status: 'failed', counterId: 'CTR-02' }),
    createJob({ id: 'done', status: 'completed', counterId: 'CTR-02' }),
    createJob({ id: 'rejected', status: 'rejected', counterId: 'CTR-02' }),
  ];

  assert.deepEqual(summarizeCounterOrders(orders), { active: 3, printed: 1, rejected: 1 });
  assert.deepEqual(summarizeCounterOrders([]), { active: 0, printed: 0, rejected: 0 });
});

const feedOrder = (overrides: Partial<CounterFeedOrder> = {}): CounterFeedOrder => ({
  id: 'feed-1',
  counterId: 'CTR-02',
  tokenCode: '301',
  serviceType: 'doc_a4',
  serviceLabel: 'A4 Document',
  serviceLabelBn: 'A4 ডকুমেন্ট',
  paperSize: 'A4 (8.27x11.69 in)',
  copies: 1,
  status: 'queued',
  paymentStatus: 'unpaid',
  priceBDT: 10,
  createdAt: 5_000,
  ...overrides,
});

test('the master feed projection drops customer identity and uploaded documents', () => {
  const job = createJob({ id: 'job-1', counterId: 'CTR-02' });
  const projected = toCounterFeedOrder({
    ...job,
    customerPhone: '01711111111',
    customerName: 'Real Customer',
    fileName: 'nid-scan.jpg',
    auditLogs: [{ id: 'log-1', timestamp: 1, actor: 'system', action: 'created', details: 'Created' }],
  });

  assert.ok(projected);
  assert.deepEqual(Object.keys(projected).sort(), [
    'copies',
    'counterId',
    'createdAt',
    'id',
    'paperSize',
    'paymentStatus',
    'priceBDT',
    'serviceLabel',
    'serviceLabelBn',
    'serviceType',
    'status',
    'tokenCode',
  ]);
  assert.equal('fileUrl' in projected, false);
  assert.equal('customerPhone' in projected, false);
  assert.equal(
    toCounterFeedOrder(createJob({ counterId: 'CTR-02', completedAt: 9_000 }))?.completedAt,
    9_000,
    'a completed job carries its completion time',
  );
  assert.equal(toCounterFeedOrder(createJob({ counterId: undefined })), null, 'an unassigned job has no counter feed');
});

test('a counter feed payload is validated before it reaches the inbox', () => {
  assert.deepEqual(parseCounterFeedOrders({ orders: [feedOrder()] }), [feedOrder()]);
  assert.deepEqual(parseCounterFeedOrders({ orders: [] }), []);
  assert.equal(parseCounterFeedOrders({ orders: [{ ...feedOrder(), status: 'invented' }] }), null);
  assert.equal(parseCounterFeedOrders({ orders: [{ ...feedOrder(), priceBDT: Number.NaN }] }), null);
  assert.equal(parseCounterFeedOrders({ orders: [{ ...feedOrder(), tokenCode: '' }] }), null);
  assert.equal(parseCounterFeedOrders({ orders: [{ ...feedOrder(), completedAt: 'yesterday' }] }), null);
  assert.equal(parseCounterFeedOrders({ orders: [feedOrder(), { counterId: 'CTR-02' }] }), null);
  assert.equal(parseCounterFeedOrders({ orders: 'all of them' }), null);
  assert.equal(parseCounterFeedOrders(null), null);
  assert.equal(isCounterFeedOrder(feedOrder()), true);
  assert.equal(isCounterFeedOrder({ ...feedOrder(), counterId: 42 }), false);
  assert.equal(COUNTER_FEED_KEY_PATTERN.test('a'.repeat(64)), true);
  assert.equal(COUNTER_FEED_KEY_PATTERN.test('A'.repeat(64)), false, 'a pasted uppercase key is normalised before saving');
  assert.equal(COUNTER_FEED_KEY_PATTERN.test('a'.repeat(63)), false);
});

test('the counter inbox merges the master feed over local rows without duplicating orders', () => {
  const localJobs = [
    createJob({ id: 'both', counterId: 'CTR-02', status: 'queued', createdAt: 4_000 }),
    createJob({ id: 'local-only', counterId: 'CTR-02', createdAt: 1_000 }),
    createJob({ id: 'elsewhere', counterId: 'CTR-03', createdAt: 9_000 }),
  ];
  const feed = [
    feedOrder({ id: 'both', status: 'completed', createdAt: 4_000 }),
    feedOrder({ id: 'feed-only', createdAt: 6_000, counterId: 'CTR-02' }),
    feedOrder({ id: 'other-counter-feed', counterId: 'CTR-03', createdAt: 7_000 }),
  ];

  const inbox = mergeCounterInbox(localJobs, feed, 'CTR-02');
  assert.deepEqual(inbox.map(order => order.id), ['feed-only', 'both', 'local-only']);
  assert.equal(inbox.find(order => order.id === 'both')?.status, 'completed', 'the master owns the job lifecycle');
  assert.equal(inbox.find(order => order.id === 'both')?.source, 'master');
  assert.equal(inbox.find(order => order.id === 'local-only')?.source, 'local');
  assert.equal(inbox.some(order => order.id === 'elsewhere'), false);
  assert.equal(inbox.some(order => order.id === 'other-counter-feed'), false, 'a counter never sees another counter');
  assert.deepEqual(mergeCounterInbox(localJobs, feed, ''), []);
});

test('the counter feed keeps the newest copy of an order and forgets yesterday', () => {
  const now = 10_000_000;
  const merged = mergeFeedOrders(
    [feedOrder({ id: 'kept', createdAt: now - 1_000 }), feedOrder({ id: 'stale', createdAt: now - 2_000 })],
    [feedOrder({ id: 'kept', status: 'printing', createdAt: now - 1_000 })],
    now,
  );
  assert.deepEqual(merged.map(order => order.id), ['kept', 'stale']);
  assert.equal(merged[0]?.status, 'printing');

  const pruned = mergeFeedOrders([feedOrder({ id: 'old', createdAt: now - 48 * 60 * 60 * 1000 })], [], now);
  assert.deepEqual(pruned, []);
});

test('the desktop shell exposes master tabs to the master and counter inbox + studio to a counter', () => {
  assert.deepEqual(desktopTabsForRole(true), MASTER_DESKTOP_TABS);
  assert.deepEqual(desktopTabsForRole(false), COUNTER_DESKTOP_TABS);
  assert.deepEqual(desktopTabsForRole(false).map(tab => tab.page), ['counter', 'studio']);
  assert.equal(COUNTER_DESKTOP_TABS.some(tab => ['settings', 'printers', 'reports', 'jobs'].includes(tab.page)), false);
  assert.equal(defaultDesktopPage(true), 'studio');
  assert.equal(defaultDesktopPage(false), 'counter');
});

test('Studio leads the master tab bar and Settings + Printers open in auxiliary windows', () => {
  assert.equal(MASTER_DESKTOP_TABS[0]?.page, 'studio');
  assert.deepEqual(
    MASTER_DESKTOP_TABS.map(tab => tab.page),
    ['studio', 'status', 'printers', 'jobs', 'reports', 'settings']
  );
  assert.equal(AUXILIARY_WINDOW_BY_PAGE.settings, 'settings');
  assert.equal(AUXILIARY_WINDOW_BY_PAGE.printers, 'agent');
  assert.equal(AUXILIARY_WINDOW_BY_PAGE.studio, undefined);
  assert.equal(AUXILIARY_WINDOW_BY_PAGE.jobs, undefined);
});

test('business hours settings are editable and label every weekday in both languages', () => {
  const shopOrderItems = SETTINGS_GROUPS.find(group => group.id === 'shopOrders')?.items;
  assert.equal(shopOrderItems?.find(item => item.id === 'businessHours')?.status, 'supported');

  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
    const label = STRINGS[`settings.day.${day}` as TranslationKey];
    assert.ok(label, `settings.day.${day} must exist`);
    assert.ok(label.en.length > 0 && label.bn.length > 0, `settings.day.${day} must be translated`);
  }

  for (const key of [
    'settings.businessHoursEnabled',
    'settings.businessHoursOpen',
    'settings.businessHoursClose',
    'settings.businessHoursDays',
    'settings.businessHoursDaysRequired',
    'settings.invalidTime',
  ] as const) {
    assert.ok(STRINGS[key].en.length > 0 && STRINGS[key].bn.length > 0, `${key} must be translated`);
  }
});

test('clock times accept only the values the settings form can save', () => {
  for (const value of ['00:00', '09:00', '17:30', '23:59']) {
    assert.equal(isClockTime(value), true, `${value} must be accepted`);
  }
  for (const value of ['', '9:00', '24:00', '09:60', '0900', 'abc', 900]) {
    assert.equal(isClockTime(value), false, `${String(value)} must be rejected`);
  }
});

test('shop hours use Asia/Dhaka days, boundaries, and overnight intervals', () => {
  const weekdayHours: BusinessHoursSettings = {
    ...DEFAULT_APP_SETTINGS.businessHours,
    enabled: true,
    daysOfWeek: ['monday'],
    openTime: '09:00',
    closeTime: '17:00',
  };
  assert.equal(isWithinShopHours(Date.UTC(2026, 9, 12, 2, 59), weekdayHours), false);
  assert.equal(isWithinShopHours(Date.UTC(2026, 9, 12, 3, 0), weekdayHours), true);
  assert.equal(isWithinShopHours(Date.UTC(2026, 9, 11, 4, 0), weekdayHours), false);

  const overnightHours: BusinessHoursSettings = {
    ...weekdayHours,
    daysOfWeek: ['sunday'],
    openTime: '22:00',
    closeTime: '02:00',
  };
  assert.equal(isWithinShopHours(Date.UTC(2026, 9, 11, 17, 0), overnightHours), true);
  assert.equal(isWithinShopHours(Date.UTC(2026, 9, 11, 19, 0), overnightHours), true);
  assert.equal(isWithinShopHours(Date.UTC(2026, 9, 11, 21, 0), overnightHours), false);
  assert.equal(isWithinShopHours(Date.now(), { ...weekdayHours, enabled: false }), true);
});

test('customer order limits validate copy count and encoded file bytes', () => {
  const limits = DEFAULT_APP_SETTINGS.orderLimits;
  assert.equal(validateCustomerOrderLimits({ copies: 50, fileUrl: 'data:application/pdf;base64,JVBERg==' }, limits), null);
  assert.match(validateCustomerOrderLimits({ copies: 51, fileUrl: 'data:application/pdf;base64,JVBERg==' }, limits) || '', /copies/);
  const oversized = `data:application/pdf;base64,${Buffer.alloc(20 * 1024 * 1024 + 1).toString('base64')}`;
  assert.match(validateCustomerOrderLimits({ copies: 1, fileUrl: oversized }, limits) || '', /20 MB/);
  assert.match(validateCustomerOrderLimits({ copies: 1, fileUrl: 'blob:forbidden' }, limits) || '', /data URL/);
});

test('customer orders are accepted only as unpaid counter cash', () => {
  assert.equal(validateCustomerOrderPayment({ paymentMethod: 'counter_cash', paymentStatus: 'unpaid' }), null);
  assert.match(
    validateCustomerOrderPayment({ paymentMethod: 'bkash', paymentStatus: 'paid_mfs' }) || '',
    /counter-cash/
  );
  assert.match(
    validateCustomerOrderPayment({ paymentMethod: 'nagad', paymentStatus: 'paid_mfs' }) || '',
    /counter-cash/
  );
  assert.match(
    validateCustomerOrderPayment({ paymentMethod: 'counter_cash', paymentStatus: 'paid_counter' }) || '',
    /counter-cash/
  );
});

test('weekly DND follows Dhaka schedule days across midnight', () => {
  const schedule: WeeklyDndSchedule = { daysOfWeek: ['sunday'], startTime: '22:00', endTime: '02:00' };
  assert.equal(isWithinWeeklyDndSchedule(Date.UTC(2026, 9, 11, 17), schedule), true);
  assert.equal(isWithinWeeklyDndSchedule(Date.UTC(2026, 9, 11, 19), schedule), true);
  assert.equal(isWithinWeeklyDndSchedule(Date.UTC(2026, 9, 11, 21), schedule), false);
  assert.equal(isWithinWeeklyDndSchedule(Date.now(), null), false);
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
