import { app } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { AppLogger } from './app-logger.js';

// ============================================================================
// Types
// ============================================================================

export type SoundId = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06';

export interface SoundConfig {
  id: SoundId;
  file: string;
  description: string;
  minIntervalMs: number; // Minimum time between same sound
}

export interface SoundServiceOptions {
  volume: number; // 0-100
  soundAlertEnabled: boolean;
  toastSoundEnabled: boolean;
  isDndMode: boolean;
  resourcesPath: string;
}

// ============================================================================
// Sound Definitions
// ============================================================================

const SOUND_DEFINITIONS: SoundConfig[] = [
  {
    id: 'S01',
    file: 'sounds/S01.mp3',
    description: 'New order arrived',
    minIntervalMs: 1000,
  },
  {
    id: 'S02',
    file: 'sounds/S02.mp3',
    description: 'Pending approval reminder',
    minIntervalMs: 3000,
  },
  {
    id: 'S03',
    file: 'sounds/S03.mp3',
    description: 'Paper out',
    minIntervalMs: 5000,
  },
  {
    id: 'S04',
    file: 'sounds/S04.mp3',
    description: 'Ink low',
    minIntervalMs: 5000,
  },
  {
    id: 'S05',
    file: 'sounds/S05.mp3',
    description: 'Printer disconnected',
    minIntervalMs: 3000,
  },
  {
    id: 'S06',
    file: 'sounds/S06.mp3',
    description: 'Server offline',
    minIntervalMs: 5000,
  },
];

// ============================================================================
// SoundService Class
// ============================================================================

export class SoundService {
  private logger: AppLogger;
  private options: SoundServiceOptions;
  private soundQueue: Array<{ id: SoundId; timestamp: number; resolve: (value: boolean) => void }> = [];
  private isPlaying = false;
  private lastPlayed: Map<SoundId, number> = new Map();
  private audioElements: Map<SoundId, HTMLAudioElement> = new Map();
  private initialized = false;

  constructor(logger: AppLogger, options: Partial<SoundServiceOptions> = {}) {
    this.logger = logger;
    this.options = {
      volume: 70,
      soundAlertEnabled: true,
      toastSoundEnabled: true,
      isDndMode: false,
      resourcesPath: join(process.resourcesPath || app.getAppPath(), 'resources'),
      ...options,
    };
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Preload all sound files
    for (const sound of SOUND_DEFINITIONS) {
      const filePath = join(this.options.resourcesPath, sound.file);
      if (existsSync(filePath)) {
        // In Electron main process, we can't use HTMLAudioElement directly
        // We'll use a different approach - spawn a small player process or use
        // electron's native audio capabilities
        this.logger.info(`Sound file found: ${sound.id} at ${filePath}`);
      } else {
        this.logger.warn(`Sound file not found: ${sound.id} at ${filePath}`);
      }
    }

    this.initialized = true;
    this.logger.info('SoundService initialized');
  }

  // ---------------------------------------------------------------------------
  // Configuration Updates
  // ---------------------------------------------------------------------------

  updateOptions(options: Partial<SoundServiceOptions>): void {
    this.options = { ...this.options, ...options };
    this.logger.info('SoundService options updated', {
      volume: this.options.volume,
      soundAlertEnabled: this.options.soundAlertEnabled,
      toastSoundEnabled: this.options.toastSoundEnabled,
      isDndMode: this.options.isDndMode,
      resourcesPath: this.options.resourcesPath,
    });
  }

  setVolume(volume: number): void {
    this.options.volume = Math.max(0, Math.min(100, volume));
  }

  setSoundAlertEnabled(enabled: boolean): void {
    this.options.soundAlertEnabled = enabled;
  }

  setToastSoundEnabled(enabled: boolean): void {
    this.options.toastSoundEnabled = enabled;
  }

  setDndMode(enabled: boolean): void {
    this.options.isDndMode = enabled;
  }

  // ---------------------------------------------------------------------------
  // Sound Playback
  // ---------------------------------------------------------------------------

  private async playSoundInternal(soundId: SoundId): Promise<boolean> {
    const soundDef = SOUND_DEFINITIONS.find(s => s.id === soundId);
    if (!soundDef) {
      this.logger.warn(`Unknown sound ID: ${soundId}`);
      return false;
    }

    // Check DND mode
    if (this.options.isDndMode) {
      this.logger.info(`Sound ${soundId} suppressed: DND mode active`);
      return false;
    }

    // Check if sound alerts are enabled
    if (!this.options.soundAlertEnabled) {
      this.logger.info(`Sound ${soundId} suppressed: sound alerts disabled`);
      return false;
    }

    // Check deduplication interval
    const now = Date.now();
    const lastPlayed = this.lastPlayed.get(soundId) || 0;
    if (now - lastPlayed < soundDef.minIntervalMs) {
      this.logger.info(`Sound ${soundId} suppressed: played ${now - lastPlayed}ms ago (min ${soundDef.minIntervalMs}ms)`);
      return false;
    }

    // Check if file exists
    const filePath = join(this.options.resourcesPath, soundDef.file);
    if (!existsSync(filePath)) {
      this.logger.warn(`Sound file not found: ${filePath}, using a generated tone`);
      return this.playVolumeScaledTone();
    }

    try {
      // Use Electron's native notification sound or spawn a player
      // For simplicity, we'll use a system beep as fallback
      // In production, you'd use a proper audio player like 'play-sound' npm package
      // or Electron's native audio capabilities
      
      this.lastPlayed.set(soundId, now);
      this.logger.info(`Playing sound: ${soundId} (${soundDef.description})`);
      
      // Try to play using system beep with custom frequency/duration
      // This is a placeholder - in real implementation, use a proper audio library
      return await this.playAudioFile(filePath);
    } catch (error) {
      this.logger.error(`Failed to play sound ${soundId}`, error);
      return this.playVolumeScaledTone();
    }
  }

  private async playAudioFile(filePath: string): Promise<boolean> {
    void filePath;
    return this.playVolumeScaledTone();
  }

  private async playVolumeScaledTone(): Promise<boolean> {
    if (this.options.volume <= 0) return false;
    if (process.platform !== 'win32') {
      process.stdout.write('\x07');
      return true;
    }

    const sampleRate = 22_050;
    const sampleCount = sampleRate * 0.3;
    const pcmBytes = Buffer.alloc(sampleCount * 2);
    const amplitude = Math.round(32_767 * this.options.volume / 100);
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = Math.round(amplitude * Math.sin(2 * Math.PI * 800 * index / sampleRate));
      pcmBytes.writeInt16LE(sample, index * 2);
    }

    const wav = Buffer.alloc(44 + pcmBytes.length);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVE', 8);
    wav.write('fmt ', 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(pcmBytes.length, 40);
    pcmBytes.copy(wav, 44);

    const wavPath = join(tmpdir(), `alif-notification-${randomBytes(12).toString('hex')}.wav`);
    try {
      await writeFile(wavPath, wav, { flag: 'wx' });
      const escapedPath = wavPath.replace(/'/g, "''");
      const script = `$player = New-Object System.Media.SoundPlayer('${escapedPath}'); try { $player.Load(); $player.PlaySync() } finally { $player.Dispose() }`;
      return await new Promise<boolean>(resolve => {
        const player = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
          windowsHide: true,
          stdio: 'ignore',
        });
        let settled = false;
        const finish = (result: boolean) => {
          if (settled) return;
          settled = true;
          void unlink(wavPath).finally(() => resolve(result));
        };
        player.once('error', () => finish(false));
        player.once('close', code => finish(code === 0));
      });
    } catch (error) {
      await unlink(wavPath).catch(() => undefined);
      this.logger.error('Could not play the generated notification tone.', error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async play(soundId: SoundId): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Add to queue
    return new Promise((resolve) => {
      this.soundQueue.push({ id: soundId, timestamp: Date.now(), resolve });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isPlaying || this.soundQueue.length === 0) return;

    this.isPlaying = true;

    while (this.soundQueue.length > 0) {
      const item = this.soundQueue.shift()!;
      const result = await this.playSoundInternal(item.id);
      item.resolve(result);
      
      // Small delay between queued sounds to prevent overlap
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isPlaying = false;
  }

  // ---------------------------------------------------------------------------
  // Convenience Methods for Triggers
  // ---------------------------------------------------------------------------

  async playNewOrder(): Promise<boolean> {
    return this.play('S01');
  }

  async playPendingReminder(): Promise<boolean> {
    return this.play('S02');
  }

  async playPaperOut(): Promise<boolean> {
    return this.play('S03');
  }

  async playInkLow(): Promise<boolean> {
    return this.play('S04');
  }

  async playPrinterDisconnected(): Promise<boolean> {
    return this.play('S05');
  }

  async playOffline(): Promise<boolean> {
    return this.play('S06');
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.soundQueue = [];
    this.lastPlayed.clear();
    this.audioElements.clear();
    this.initialized = false;
  }
}

// Singleton instance
let soundServiceInstance: SoundService | null = null;

export function createSoundService(logger: AppLogger, options?: Partial<SoundServiceOptions>): SoundService {
  if (!soundServiceInstance) {
    soundServiceInstance = new SoundService(logger, options);
  }
  return soundServiceInstance;
}

export function getSoundService(): SoundService | null {
  return soundServiceInstance;
}