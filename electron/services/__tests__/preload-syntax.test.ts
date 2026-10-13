import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { Script } from 'node:vm';

// The preload bridge is plain JavaScript loaded verbatim by Electron, so a stray
// TypeScript annotation in it throws a SyntaxError at load time. When that happens
// `contextBridge.exposeInMainWorld` never runs and the renderer silently loses
// every desktop capability (printer queue, job saving, printing) while still
// rendering normally. Parsing the file here turns that silent failure into a
// failing test.
const preloadPath = join(process.cwd(), 'electron', 'preload.cjs');

test('the preload script parses as plain JavaScript', () => {
  const source = readFileSync(preloadPath, 'utf8');
  assert.doesNotThrow(() => new Script(source), 'electron/preload.cjs must stay valid JavaScript');
});

test('the preload script exposes the desktop bridge', () => {
  const source = readFileSync(preloadPath, 'utf8');
  assert.match(source, /contextBridge\.exposeInMainWorld\('alifShohojPrintDesktop'/);
});