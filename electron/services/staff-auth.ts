import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  StaffStore,
  StaffStoreError,
  type StaffRole,
  type StaffUser,
} from './staff-store.js';

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const FAILURE_LIMIT = 5;
const INITIAL_LOCKOUT_MS = 30 * 1000;
const MAX_LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_HASH = `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${'00'.repeat(SALT_LENGTH)}$${'00'.repeat(KEY_LENGTH)}`;

export type StaffPermission =
  | 'jobs'
  | 'pos'
  | 'shop-settings'
  | 'orders'
  | 'printers'
  | 'reports'
  | 'staff';

export interface StaffSession {
  id: string;
  userId: string;
  role: StaffRole;
  expiresAt: number;
}

export class StaffAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffAuthError';
  }
}

export class StaffAuthThrottledError extends StaffAuthError {
  constructor() {
    super('Too many failed PIN attempts. Try again later.');
    this.name = 'StaffAuthThrottledError';
  }
}

interface StaffAuthOptions {
  now?: () => number;
}

interface ActiveSession {
  id: string;
  userId: string;
  lastActivityAt: number;
}

interface FailureState {
  attempts: number;
  lockedUntil: number;
}

export const hashStaffPin = (pin: string): string => {
  const salt = randomBytes(SALT_LENGTH);
  const digest = scryptSync(pin, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString('hex')}$${digest.toString('hex')}`;
};

export const verifyStaffPin = (pin: string, encodedHash: string): boolean => {
  const parts = encodedHash.split('$');
  const validFormat =
    parts.length === 6 &&
    parts[0] === 'scrypt' &&
    parts[1] === String(SCRYPT_COST) &&
    parts[2] === String(SCRYPT_BLOCK_SIZE) &&
    parts[3] === String(SCRYPT_PARALLELIZATION) &&
    /^[0-9a-f]{32}$/i.test(parts[4] ?? '') &&
    /^[0-9a-f]{128}$/i.test(parts[5] ?? '');
  const salt = validFormat ? Buffer.from(parts[4] as string, 'hex') : Buffer.alloc(SALT_LENGTH);
  const expected = validFormat ? Buffer.from(parts[5] as string, 'hex') : Buffer.alloc(KEY_LENGTH);
  const actual = scryptSync(pin, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });
  const matches = timingSafeEqual(actual, expected);
  return validFormat && matches;
};

const isValidPin = (pin: string): boolean => /^\d{4,12}$/.test(pin);

const PERMISSIONS_BY_ROLE: Record<StaffRole, ReadonlySet<StaffPermission>> = {
  owner: new Set(['jobs', 'pos', 'shop-settings', 'orders', 'printers', 'reports', 'staff']),
  manager: new Set(['jobs', 'pos', 'shop-settings', 'orders', 'printers', 'reports']),
  operator: new Set(['jobs', 'pos']),
};

export class StaffAuthService {
  private readonly now: () => number;
  private readonly sessions = new Map<string, ActiveSession>();
  private failureState: FailureState = { attempts: 0, lockedUntil: 0 };

  constructor(
    private readonly store: StaffStore,
    options: StaffAuthOptions = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  isBootstrapped(): boolean {
    return this.store.isBootstrapped();
  }

  createOwner(pin: string): StaffUser {
    this.validatePin(pin);
    if (this.store.isBootstrapped()) {
      throw new StaffAuthError('Staff accounts have already been bootstrapped.');
    }
    return this.store.bootstrapOwner(hashStaffPin(pin));
  }

  login(pin: string): StaffSession {
    const now = this.now();
    this.assertNotThrottled(now);
    const validPin = typeof pin === 'string' && isValidPin(pin);
    const searchPin = validPin ? pin : '0000';
    const matches = this.store.findUsersByPin(searchPin, verifyStaffPin);
    if (!validPin || matches.length !== 1 || !matches[0]?.enabled) {
      if (matches.length === 0) verifyStaffPin(searchPin, DUMMY_HASH);
      this.recordFailure(now);
      throw new StaffAuthError('PIN was not accepted.');
    }

    this.failureState = { attempts: 0, lockedUntil: 0 };
    const user = matches[0];
    const id = randomUUID();
    this.sessions.set(id, { id, userId: user.id, lastActivityAt: now });
    return {
      id,
      userId: user.id,
      role: user.role,
      expiresAt: now + SESSION_IDLE_TIMEOUT_MS,
    };
  }

  authorize(sessionId: string, permission: StaffPermission): StaffUser {
    const session = this.sessions.get(sessionId);
    if (!session) throw new StaffAuthError('A valid staff session is required.');
    const now = this.now();
    if (now - session.lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) {
      this.sessions.delete(sessionId);
      throw new StaffAuthError('The staff session has expired.');
    }

    const user = this.store.getUser(session.userId);
    if (!user?.enabled) {
      this.sessions.delete(sessionId);
      throw new StaffAuthError('The staff session is no longer valid.');
    }
    if (!PERMISSIONS_BY_ROLE[user.role].has(permission)) {
      throw new StaffAuthError('This staff role does not have permission for that action.');
    }

    session.lastActivityAt = now;
    return user;
  }

  logout(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  createStaff(sessionId: string, pin: string, role: StaffRole): StaffUser {
    this.authorize(sessionId, 'staff');
    this.validatePin(pin);
    try {
      return this.store.createUser(pin, hashStaffPin(pin), role, verifyStaffPin);
    } catch (error) {
      if (error instanceof StaffStoreError) throw new StaffAuthError(error.message);
      throw error;
    }
  }

  setStaffRole(sessionId: string, userId: string, role: StaffRole): StaffUser {
    this.authorize(sessionId, 'staff');
    try {
      return this.store.setRole(userId, role);
    } catch (error) {
      if (error instanceof StaffStoreError) throw new StaffAuthError(error.message);
      throw error;
    }
  }

  setStaffEnabled(sessionId: string, userId: string, enabled: boolean): StaffUser {
    this.authorize(sessionId, 'staff');
    try {
      return this.store.setEnabled(userId, enabled);
    } catch (error) {
      if (error instanceof StaffStoreError) throw new StaffAuthError(error.message);
      throw error;
    }
  }

  listStaff(sessionId: string): StaffUser[] {
    this.authorize(sessionId, 'staff');
    return this.store.listUsers();
  }

  private validatePin(pin: string): void {
    if (typeof pin !== 'string' || !isValidPin(pin)) {
      throw new StaffAuthError('PIN must contain 4 to 12 digits.');
    }
  }

  private assertNotThrottled(now: number): void {
    if (this.failureState.lockedUntil > now) throw new StaffAuthThrottledError();
    if (this.failureState.lockedUntil > 0) this.failureState = { attempts: 0, lockedUntil: 0 };
  }

  private recordFailure(now: number): void {
    const attempts = this.failureState.attempts + 1;
    const lockoutMultiplier = 2 ** Math.floor((attempts - FAILURE_LIMIT) / FAILURE_LIMIT);
    const lockedUntil = attempts >= FAILURE_LIMIT
      ? now + Math.min(INITIAL_LOCKOUT_MS * lockoutMultiplier, MAX_LOCKOUT_MS)
      : 0;
    this.failureState = { attempts, lockedUntil };
  }
}
