import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { migrateDataDirectory, resolveUserDataDirectory } from '../data-directory-migration.js';

function makeTree(root: string): void {
  mkdirSync(join(root, 'sub'), { recursive: true });
  writeFileSync(join(root, 'file.txt'), 'hello');
  writeFileSync(join(root, 'sub', 'nested.txt'), 'world');
}

test('migrateDataDirectory moves the legacy directory when the target is absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'alif-migrate-move-'));
  try {
    const legacy = join(root, 'Legacy App');
    makeTree(legacy);
    const result = migrateDataDirectory(root, 'Legacy App', 'Target App');
    assert.equal(result.migrated, true);
    assert.equal(result.merged, false);
    assert.equal(result.targetPath, join(root, 'Target App'));
    assert.equal(result.legacyPath, legacy);
    // The legacy directory is gone; the target holds the tree.
    assert.ok(!existsSync(legacy));
    assert.ok(existsSync(join(result.targetPath, 'file.txt')));
    assert.ok(existsSync(join(result.targetPath, 'sub', 'nested.txt')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('migrateDataDirectory merges into an existing target without overwriting', () => {
  const root = mkdtempSync(join(tmpdir(), 'alif-migrate-merge-'));
  try {
    const legacy = join(root, 'Legacy App');
    const target = join(root, 'Target App');
    makeTree(legacy);
    mkdirSync(target, { recursive: true });
    // The target already owns a file of the same name; the merge must keep it.
    writeFileSync(join(target, 'file.txt'), 'target-wins');
    writeFileSync(join(target, 'own.txt'), 'kept');

    const result = migrateDataDirectory(root, 'Legacy App', 'Target App');
    assert.equal(result.migrated, false);
    assert.equal(result.merged, true);
    assert.equal(result.targetPath, target);
    assert.ok(existsSync(legacy), 'the legacy copy is kept until a later cleanup');
    assert.equal(readFileSync(join(target, 'file.txt'), 'utf8'), 'target-wins');
    assert.equal(readFileSync(join(target, 'own.txt'), 'utf8'), 'kept');
    assert.equal(readFileSync(join(target, 'sub', 'nested.txt'), 'utf8'), 'world');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('migrateDataDirectory is a no-op when the legacy directory is absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'alif-migrate-none-'));
  try {
    const result = migrateDataDirectory(root, 'Legacy App', 'Target App');
    assert.equal(result.migrated, false);
    assert.equal(result.merged, false);
    assert.equal(result.targetPath, join(root, 'Target App'));
    assert.equal(result.legacyPath, undefined);
    assert.ok(!existsSync(result.targetPath));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resolveUserDataDirectory migrates BroxPrint Studio into AlifShohojPrint', () => {
  const root = mkdtempSync(join(tmpdir(), 'alif-resolve-'));
  try {
    const legacy = join(root, 'BroxPrint Studio');
    makeTree(legacy);
    const target = resolveUserDataDirectory(root);
    assert.equal(target, join(root, 'AlifShohojPrint'));
    assert.ok(!existsSync(legacy));
    assert.ok(existsSync(join(target, 'file.txt')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resolveUserDataDirectory is idempotent when the target already exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'alif-resolve-idem-'));
  try {
    const legacy = join(root, 'BroxPrint Studio');
    const target = join(root, 'AlifShohojPrint');
    makeTree(legacy);
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'existing.txt'), 'keep');

    const first = resolveUserDataDirectory(root);
    const second = resolveUserDataDirectory(root);
    assert.equal(first, target);
    assert.equal(second, target);
    assert.equal(readFileSync(join(target, 'existing.txt'), 'utf8'), 'keep');
    assert.equal(readFileSync(join(target, 'file.txt'), 'utf8'), 'hello');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});