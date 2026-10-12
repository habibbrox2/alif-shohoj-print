import assert from 'node:assert/strict';
import test from 'node:test';
import { readCloseToTrayPreference, writeCloseToTrayPreference } from '../window-settings.js';

test('missing and malformed legacy close-to-tray settings default to enabled', () => {
  assert.equal(readCloseToTrayPreference({ width: 1180, height: 780 }), true);
  assert.equal(readCloseToTrayPreference({ closeToTray: 'false' }), true);
  assert.equal(readCloseToTrayPreference({ closeToTray: null }), true);
  assert.equal(readCloseToTrayPreference(null), true);
  assert.equal(readCloseToTrayPreference('{malformed json'), true);
  assert.equal(readCloseToTrayPreference({ closeToTray: true }), true);
});

test('close-to-tray preference round-trips while preserving other window state', () => {
  const saved = writeCloseToTrayPreference({ width: 1180, height: 780, x: 12 }, false);
  const restored = readCloseToTrayPreference(JSON.parse(JSON.stringify(saved)) as unknown);

  assert.equal(restored, false);
  assert.equal(saved.width, 1180);
  assert.equal(saved.height, 780);
  assert.equal(saved.x, 12);
});
