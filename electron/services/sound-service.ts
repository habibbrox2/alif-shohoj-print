import { app } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
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
      this.logger.warn(`Sound file not found: ${filePath}, using system beep`);
      return this.playSystemBeep();
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
      return this.playSystemBeep();
    }
  }

  private async playAudioFile(filePath: string): Promise<boolean> {
    // In Electron main process, we can use the 'play-sound' package or
    // spawn a child process to play audio
    // For now, we'll use a simple approach with system beep
    
    // TODO: Replace with actual audio playback using:
    // - 'play-sound' npm package (cross-platform)
    // - 'node-wav-player' for WAV files
    // - Electron's native audio APIs
    
    // For now, use system beep as fallback
    return this.playSystemBeep();
  }

  private playSystemBeep(): boolean {
    try {
      // Use system beep - works on Windows
      if (process.platform === 'win32') {
        // Windows: use PowerShell to play a beep
        const { spawn } = require('child_process');
        const ps = spawn('powershell', ['-c', '[console]::beep(800,300)']);
        ps.on('error', () => {
          // Ignore errors
        });
      } else {
        // Linux/Mac: use terminal beep
        process.stdout.write('\x07');
      }
      return true;
    } catch {
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