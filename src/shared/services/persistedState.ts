import type { PrinterDevice, ServicePricing, ShopCounter, ShopProfile } from '../types';

/**
 * localStorage persistence for renderer state (audit improvement #5).
 *
 * Previously counters, printers, pricing and the shop profile reset to demo
 * values on every reload while only studio services survived — now each is
 * saved like `SERVICES_STORAGE_KEY` and restored through a runtime validator
 * so corrupt or hand-edited storage falls back to the defaults.
 *
 * Jobs are intentionally NOT persisted here: the Electron desktop queue
 * (SQLite via `listQueue()`) is the source of truth for jobs, and real job
 * payloads carry up-to-40 MB data URLs that would exceed the localStorage quota.
 */

export const COUNTERS_STORAGE_KEY = 'alif-shohoj-print-counters';
export const PRINTERS_STORAGE_KEY = 'alif-shohoj-print-printers';
export const PRICING_STORAGE_KEY = 'alif-shohoj-print-pricing';
export const SHOP_PROFILE_STORAGE_KEY = 'alif-shohoj-print-shop-profile';

const LEGACY_STORAGE_KEYS: Record<string, string> = {
  [COUNTERS_STORAGE_KEY]: 'broxprint-counters',
  [PRINTERS_STORAGE_KEY]: 'broxprint-printers',
  [PRICING_STORAGE_KEY]: 'broxprint-pricing',
  [SHOP_PROFILE_STORAGE_KEY]: 'broxprint-shop-profile',
};

export const readMigratedStorageValue = (key: string, legacyKey?: string): string | null => {
  let legacyValue: string | null = null;
  try {
    const currentValue = window.localStorage.getItem(key);
    if (currentValue !== null) return currentValue;
    if (!legacyKey) return null;
    legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue === null) return null;
    window.localStorage.setItem(key, legacyValue);
    window.localStorage.removeItem(legacyKey);
    return legacyValue;
  } catch (error) {
    console.error(`Could not migrate saved state at "${key}".`, error);
    return legacyValue;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isShopCounter = (value: unknown): value is ShopCounter => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.operator === 'string' &&
    typeof value.ipAddress === 'string' &&
    (value.status === 'active' || value.status === 'busy' || value.status === 'offline') &&
    typeof value.isMasterHost === 'boolean' &&
    Array.isArray(value.assignedServices) &&
    value.assignedServices.every(service => typeof service === 'string') &&
    typeof value.defaultPrinterId === 'string' &&
    typeof value.todayOrdersCount === 'number' && Number.isFinite(value.todayOrdersCount) &&
    typeof value.todayEarningsBDT === 'number' && Number.isFinite(value.todayEarningsBDT)
  );
};

const isPrinterDevice = (value: unknown): value is PrinterDevice => {
  if (!isRecord(value)) return false;
  const inkLevels = value.inkLevels;
  return (
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && value.name.length > 0 &&
    typeof value.brand === 'string' && value.brand.length > 0 &&
    typeof value.model === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.supportedPaperSizes) &&
    value.supportedPaperSizes.every(size => typeof size === 'string') &&
    typeof value.colorCapability === 'string' &&
    typeof value.queueCount === 'number' && Number.isFinite(value.queueCount) &&
    isRecord(inkLevels) && typeof inkLevels.black === 'number' &&
    typeof value.paperCount === 'number' && Number.isFinite(value.paperCount)
  );
};

const isServicePricing = (value: unknown): value is ServicePricing => {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(([key, entryValue]) => key.length > 0 && typeof entryValue === 'number' && Number.isFinite(entryValue))
  );
};

const isShopProfile = (value: unknown): value is ShopProfile => {
  if (!isRecord(value)) return false;
  const localServer = value.localServer;
  return (
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' &&
    typeof value.nameBn === 'string' &&
    typeof value.code === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.phone === 'string' &&
    typeof value.address === 'string' &&
    typeof value.token === 'string' &&
    typeof value.bkashNumber === 'string' &&
    typeof value.nagadNumber === 'string' &&
    typeof value.soundAlertEnabled === 'boolean' &&
    typeof value.isDndMode === 'boolean' &&
    (value.dndMessage === undefined || typeof value.dndMessage === 'string') &&
    isRecord(localServer) &&
    typeof localServer.port === 'number' && Number.isFinite(localServer.port) &&
    (localServer.status === 'running' || localServer.status === 'stopped' || localServer.status === 'restarting')
  );
};

export const validators = {
  // Empty arrays are valid — they mean the owner deleted every removable entry,
  // which must survive a reload instead of resurrecting the demo defaults.
  counters: (value: unknown): value is ShopCounter[] =>
    Array.isArray(value) && value.every(isShopCounter),
  printers: (value: unknown): value is PrinterDevice[] =>
    Array.isArray(value) && value.every(isPrinterDevice),
  pricing: isServicePricing,
  shopProfile: isShopProfile,
} as const;

export const loadPersisted = <T>(key: string, validate: (value: unknown) => value is T, fallback: T): T => {
  try {
    const saved = readMigratedStorageValue(key, LEGACY_STORAGE_KEYS[key]);
    if (!saved) return fallback;
    const parsed: unknown = JSON.parse(saved);
    if (validate(parsed)) return parsed;
    console.warn(`Saved state at "${key}" is invalid; restoring the defaults.`);
    return fallback;
  } catch (error) {
    console.error(`Could not read saved state at "${key}".`, error);
    return fallback;
  }
};

export const savePersisted = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Quota errors must never break the running app; the next reload simply
    // falls back to the previous saved snapshot.
    console.error(`Could not save state at "${key}".`, error);
  }
};
