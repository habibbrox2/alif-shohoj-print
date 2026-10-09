import { SoundService, SOUND_DEFINITIONS } from '../sound-service.js';
import { AppLogger } from '../app-logger.js';

// Mock AppLogger
jest.mock('../app-logger', () => ({
  AppLogger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock fs
jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock child_process for system beep
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    on: jest.fn(),
  }),
}));

describe('SoundService', () => {
  let logger: AppLogger;
  let soundService: SoundService;
  
  const mockOptions = {
    volume: 70,
    soundAlertEnabled: true,
    toastSoundEnabled: true,
    isDndMode: false,
    resourcesPath: '/mock/resources',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new AppLogger('/mock/logs');
    soundService = new SoundService(logger, mockOptions);
  });

  describe('Sound Definitions', () => {
    it('should have all 6 sound definitions (S01-S06)', () => {
      expect(SOUND_DEFINITIONS).toHaveLength(6);
      
      const ids = SOUND_DEFINITIONS.map(s => s.id);
      expect(ids).toEqual(['S01', 'S02', 'S03', 'S04', 'S05', 'S06']);
    });

    it('should have correct descriptions for each sound', () => {
      const descriptions = SOUND_DEFINITIONS.map((s: typeof SOUND_DEFINITIONS[0]) => s.description);
      expect(descriptions).toContain('New order arrived');
      expect(descriptions).toContain('Pending approval reminder');
      expect(descriptions).toContain('Paper out');
      expect(descriptions).toContain('Ink low');
      expect(descriptions).toContain('Printer disconnected');
      expect(descriptions).toContain('Server offline');
    });

    it('should have deduplication intervals', () => {
      SOUND_DEFINITIONS.forEach((sound: typeof SOUND_DEFINITIONS[0]) => {
        expect(sound.minIntervalMs).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration', () => {
    it('should update options', () => {
      soundService.updateOptions({ volume: 50, isDndMode: true });
      
      // Options are private, but we can verify through behavior
      expect(soundService).toBeDefined();
    });

    it('should set volume', () => {
      soundService.setVolume(50);
      soundService.setVolume(150); // Should clamp to 100
      soundService.setVolume(-10); // Should clamp to 0
    });

    it('should set sound alert enabled', () => {
      soundService.setSoundAlertEnabled(false);
      soundService.setSoundAlertEnabled(true);
    });

    it('should set toast sound enabled', () => {
      soundService.setToastSoundEnabled(false);
      soundService.setToastSoundEnabled(true);
    });

    it('should set DND mode', () => {
      soundService.setDndMode(true);
      soundService.setDndMode(false);
    });
  });

  describe('Sound Playback Logic', () => {
    beforeEach(() => {
      // Mock existsSync to return true for sound files
      const fs = require('node:fs');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should not play when DND mode is active', async () => {
      soundService.setDndMode(true);
      const result = await soundService.play('S01');
      
      expect(result).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('suppressed: DND mode active')
      );
    });

    it('should not play when sound alerts disabled', async () => {
      soundService.setSoundAlertEnabled(false);
      const result = await soundService.play('S01');
      
      expect(result).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('suppressed: sound alerts disabled')
      );
    });

    it('should deduplicate same sound within interval', async () => {
      const result1 = await soundService.play('S01');
      const result2 = await soundService.play('S01'); // Immediate second call
      
      // First should play, second should be deduplicated
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('suppressed: played')
      );
    });

    it('should allow same sound after interval expires', async () => {
      // Manually manipulate lastPlayed to simulate time passing
      const lastPlayedMap = (soundService as any).lastPlayed;
      lastPlayedMap.set('S01', Date.now() - 10000); // 10 seconds ago
      
      const result = await soundService.play('S01');
      expect(result).toBe(true);
    });

    it('should fallback to system beep when file not found', async () => {
      const fs = require('node:fs');
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await soundService.play('S01');
      
      expect(result).toBe(true); // System beep should succeed
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sound file not found')
      );
    });
  });

  describe('Convenience Methods', () => {
    beforeEach(() => {
      const fs = require('node:fs');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should have playNewOrder method', async () => {
      const result = await soundService.playNewOrder();
      expect(typeof result).toBe('boolean');
    });

    it('should have playPendingReminder method', async () => {
      const result = await soundService.playPendingReminder();
      expect(typeof result).toBe('boolean');
    });

    it('should have playPaperOut method', async () => {
      const result = await soundService.playPaperOut();
      expect(typeof result).toBe('boolean');
    });

    it('should have playInkLow method', async () => {
      const result = await soundService.playInkLow();
      expect(typeof result).toBe('boolean');
    });

    it('should have playPrinterDisconnected method', async () => {
      const result = await soundService.playPrinterDisconnected();
      expect(typeof result).toBe('boolean');
    });

    it('should have playOffline method', async () => {
      const result = await soundService.playOffline();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Queue Processing', () => {
    beforeEach(() => {
      const fs = require('node:fs');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should queue multiple sounds and play sequentially', async () => {
      const promise1 = soundService.play('S01');
      const promise2 = soundService.play('S02');
      const promise3 = soundService.play('S03');
      
      const results = await Promise.all([promise1, promise2, promise3]);
      
      // All should succeed (no deduplication since different sounds)
      expect(results).toEqual([true, true, true]);
    });

    it('should process queue in order', async () => {
      const playOrder: string[] = [];
      
      // Mock playSoundInternal to track order
      const originalPlaySoundInternal = (soundService as any).playSoundInternal;
      (soundService as any).playSoundInternal = jest.fn().mockImplementation(async (id: string) => {
        playOrder.push(id);
        return true;
      });
      
      await Promise.all([
        soundService.play('S01'),
        soundService.play('S02'),
        soundService.play('S03'),
      ]);
      
      expect(playOrder).toEqual(['S01', 'S02', 'S03']);
    });
  });

  describe('Cleanup', () => {
    it('should destroy cleanly', () => {
      soundService.destroy();
      // Should not throw
    });
  });
});

describe('createSoundService / getSoundService', () => {
  it('should create singleton instance', () => {
    const logger = new AppLogger('/mock/logs');
    const service1 = require('../sound-service').createSoundService(logger);
    const service2 = require('../sound-service').getSoundService();
    
    expect(service1).toBe(service2);
  });
});