import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const ROTATED_LOG_COUNT = 5;

export class AppLogger {
  private readonly logDirectory: string;
  private readonly logFile: string;

  constructor(userDataPath: string) {
    this.logDirectory = join(userDataPath, 'logs');
    this.logFile = join(this.logDirectory, 'app.log');
    mkdirSync(this.logDirectory, { recursive: true });
  }

  info(message: string, details?: Record<string, unknown>): void {
    this.write('info', message, details);
  }

  error(message: string, error?: unknown, details?: Record<string, unknown>): void {
    const errorText = error instanceof Error ? `${error.name}: ${error.message}` : error ? String(error) : undefined;
    this.write('error', message, { ...details, ...(errorText ? { error: errorText } : {}) });
  }

  private write(level: 'info' | 'error', message: string, details?: Record<string, unknown>): void {
    const line = `${JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...details })}\n`;
    this.rotateIfNeeded(Buffer.byteLength(line));
    writeFileSync(this.logFile, line, { encoding: 'utf8', flag: 'a' });
  }

  private rotateIfNeeded(incomingBytes: number): void {
    if (!existsSync(this.logFile) || statSync(this.logFile).size + incomingBytes <= MAX_LOG_BYTES) return;

    const oldestLog = `${this.logFile}.${ROTATED_LOG_COUNT}`;
    if (existsSync(oldestLog)) rmSync(oldestLog);
    for (let index = ROTATED_LOG_COUNT - 1; index >= 1; index -= 1) {
      const source = `${this.logFile}.${index}`;
      if (existsSync(source)) renameSync(source, `${this.logFile}.${index + 1}`);
    }
    renameSync(this.logFile, `${this.logFile}.1`);
  }
}
