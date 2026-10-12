import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  StaffAuthError,
  StaffAuthService,
  StaffAuthThrottledError,
  hashStaffPin,
  verifyStaffPin,
} from '../staff-auth.js';
import { StaffStore } from '../staff-store.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));

const withStaffService = <T>(run: (store: StaffStore, service: StaffAuthService, databasePath: string) => T): T => {
  const directory = mkdtempSync(join(testDirectory, '.staff-auth-test-'));
  const databasePath = join(directory, 'staff.sqlite');
  const store = new StaffStore(databasePath);
  const service = new StaffAuthService(store);
  try {
    return run(store, service, databasePath);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
};

test('bootstraps exactly one Owner and persists only a salted scrypt hash', () => {
  withStaffService((_store, auth, databasePath) => {
    assert.equal(auth.isBootstrapped(), false);
    const owner = auth.createOwner('4826');
    assert.equal(owner.role, 'owner');
    assert.equal(auth.isBootstrapped(), true);
    assert.throws(() => auth.createOwner('9371'), StaffAuthError);

    const database = new Database(databasePath, { readonly: true });
    try {
      const row = database.prepare('SELECT pin_hash FROM staff_users WHERE id = ?').get(owner.id) as
        | { pin_hash: string }
        | undefined;
      assert.ok(row);
      assert.notEqual(row.pin_hash, '4826');
      assert.equal(verifyStaffPin('4826', row.pin_hash), true);
      assert.equal(verifyStaffPin('4827', row.pin_hash), false);
    } finally {
      database.close();
    }
  });
});

test('uses timing-safe verification for valid and malformed hash inputs', () => {
  const encoded = hashStaffPin('1357');
  assert.equal(verifyStaffPin('1357', encoded), true);
  assert.equal(verifyStaffPin('1358', encoded), false);
  assert.equal(verifyStaffPin('1357', 'invalid-hash'), false);
});

test('grants role-scoped permissions and limits staff administration to Owners', () => {
  withStaffService((_store, auth) => {
    const owner = auth.createOwner('2468');
    const ownerSession = auth.login('2468');
    const manager = auth.createStaff(ownerSession.id, '8642', 'manager');
    const operator = auth.createStaff(ownerSession.id, '7531', 'operator');
    const managerSession = auth.login('8642');
    const operatorSession = auth.login('7531');

    assert.equal(auth.authorize(managerSession.id, 'reports').id, manager.id);
    assert.throws(() => auth.authorize(managerSession.id, 'staff'), StaffAuthError);
    assert.equal(auth.authorize(operatorSession.id, 'jobs').id, operator.id);
    assert.equal(auth.authorize(operatorSession.id, 'pos').id, operator.id);
    assert.throws(() => auth.authorize(operatorSession.id, 'printers'), StaffAuthError);
    assert.throws(() => auth.createStaff(managerSession.id, '3579', 'operator'), StaffAuthError);
    assert.deepEqual(auth.listStaff(ownerSession.id).map(({ role }) => role), [
      owner.role,
      manager.role,
      operator.role,
    ]);
  });
});

test('expires inactive sessions, rejects invalid sessions, and supports logout', () => {
  const directory = mkdtempSync(join(testDirectory, '.staff-auth-test-'));
  const store = new StaffStore(join(directory, 'staff.sqlite'));
  let now = 10_000;
  const auth = new StaffAuthService(store, { now: () => now });
  try {
    auth.createOwner('9517');
    const session = auth.login('9517');
    now += 14 * 60 * 1000;
    assert.equal(auth.authorize(session.id, 'jobs').role, 'owner');
    now += 14 * 60 * 1000;
    assert.equal(auth.authorize(session.id, 'jobs').role, 'owner');
    now += 15 * 60 * 1000;
    assert.throws(() => auth.authorize(session.id, 'jobs'), StaffAuthError);
    assert.throws(() => auth.authorize(session.id, 'jobs'), StaffAuthError);

    const loggedOut = auth.login('9517');
    auth.logout(loggedOut.id);
    assert.throws(() => auth.authorize(loggedOut.id, 'jobs'), StaffAuthError);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('throttles repeated failed PIN attempts and resumes after the cooldown', () => {
  const directory = mkdtempSync(join(testDirectory, '.staff-auth-test-'));
  const store = new StaffStore(join(directory, 'staff.sqlite'));
  let now = 10_000;
  const auth = new StaffAuthService(store, { now: () => now });
  try {
    auth.createOwner('1593');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.throws(() => auth.login('0000'), StaffAuthError);
    }
    assert.throws(() => auth.login('1593'), StaffAuthThrottledError);
    now += 30 * 1000;
    assert.equal(auth.login('1593').role, 'owner');
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('protects the last enabled Owner from being disabled or demoted', () => {
  withStaffService((_store, auth) => {
    const owner = auth.createOwner('7412');
    const session = auth.login('7412');
    assert.throws(() => auth.setStaffEnabled(session.id, owner.id, false), StaffAuthError);
    assert.throws(() => auth.setStaffRole(session.id, owner.id, 'manager'), StaffAuthError);

    const secondOwner = auth.createStaff(session.id, '3691', 'owner');
    auth.setStaffEnabled(session.id, owner.id, false);
    const secondOwnerSession = auth.login('3691');
    assert.equal(auth.listStaff(secondOwnerSession.id).find((user) => user.id === secondOwner.id)?.enabled, true);
  });
});

test('rejects reused PINs and invalid PIN formats', () => {
  withStaffService((_store, auth) => {
    auth.createOwner('8520');
    const session = auth.login('8520');
    assert.throws(() => auth.createStaff(session.id, '8520', 'operator'), StaffAuthError);
    assert.throws(() => auth.createStaff(session.id, '12ab', 'operator'), StaffAuthError);
    assert.throws(() => auth.login('12ab'), StaffAuthError);
  });
});
