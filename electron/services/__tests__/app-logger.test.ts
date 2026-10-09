import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AppLogger } from '../app-logger.js';

test('rotates log files at the configured size threshold', () => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-logs-'));
  const logger = new AppLogger(directory);
  const line = 'x'.repeat(1024);

  try {
    for (let index = 0; index < 5200; index += 1) logger.info(line);
    const logDirectory = join(directory, 'logs');
    assert.ok(existsSync(join(logDirectory, 'app.log.1')));
    assert.ok(statSync(join(logDirectory, 'app.log')).size <= 5 * 1024 * 1024);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
