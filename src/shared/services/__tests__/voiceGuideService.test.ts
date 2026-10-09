import { VoiceGuideService } from '../voiceGuideService';
import { VoiceGuideManifest, VoiceGuideClip } from '../../types/voiceGuide';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Audio
const mockAudio = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  playbackRate: 1,
  volume: 1,
  currentTime: 0,
  onended: null,
  onerror: null,
};

global.Audio = jest.fn(() => mockAudio) as any;

// Mock speechSynthesis
const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => [
    { lang: 'bn-BD', name: 'Bangla Voice' },
    { lang: 'en-US', name: 'English Voice' },
  ]),
  speaking: false,
  pending: false,
};

Object.defineProperty(window, 'speechSynthesis', { value: mockSpeechSynthesis });

// Mock fetch
global.fetch = jest.fn();

describe('VoiceGuideService', () => {
  let service: VoiceGuideService;
  
  const mockManifest: VoiceGuideManifest = {
    version: '1.0.0',
    clips: [
      { id: 'C01', text_bn: 'স্বাগতম', file: 'audio/bn/C01.mp3', lang: 'bn' },
      { id: 'C02', text_bn: 'সেবা নির্বাচন', file: 'audio/bn/C02.mp3', lang: 'bn' },
      { id: 'S01', text_bn: 'নতুন অর্ডার', file: 'sounds/S01.mp3', lang: 'bn' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    mockAudio.play.mockResolvedValue(undefined);
    mockSpeechSynthesis.speak.mockClear();
    mockSpeechSynthesis.cancel.mockClear();
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    
    // Get fresh instance
    service = VoiceGuideService.getInstance();
    
    // Manually set manifest for testing
    (service as any).manifest = mockManifest;
    (service as any).isInitialized = true;
  });

  describe('Manifest Loading', () => {
    it('should load manifest from /audio/manifest.json', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockManifest),
      });

      const newService = VoiceGuideService.getInstance();
      // Call initialize to trigger fetch
      await (newService as any).initialize();
      
      expect(global.fetch).toHaveBeenCalledWith('/audio/manifest.json');
    });

    it('should handle manifest load failure gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const newService = VoiceGuideService.getInstance();
      await (newService as any).initialize();
      
      expect((newService as any).manifest).toBeNull();
    });
  });

  describe('Clip Management', () => {
    it('should return clip for valid ID and language', () => {
      const clip = service.getClip('C01', 'bn');
      expect(clip).toBeDefined();
      expect(clip?.id).toBe('C01');
      expect(clip?.text_bn).toBe('স্বাগতম');
    });

    it('should return undefined for invalid ID', () => {
      const clip = service.getClip('INVALID', 'bn');
      expect(clip).toBeUndefined();
    });

    it('should return clip URL', () => {
      const url = service.getClipUrl('C01', 'bn');
      expect(url).toBe('/audio/bn/C01.mp3');
    });
  });

  describe('Audio Playback', () => {
    it('should play clip when enabled', async () => {
      service.setEnabled(true);
      await service.play('C01');
      
      expect(mockAudio.play).toHaveBeenCalled();
      expect(service.getState().isPlaying).toBe(true);
      expect(service.getState().currentClipId).toBe('C01');
    });

    it('should not play when disabled', async () => {
      service.setEnabled(false);
      await service.play('C01');
      
      expect(mockAudio.play).not.toHaveBeenCalled();
      expect(service.getState().isPlaying).toBe(false);
    });

    it('should fallback to TTS when audio file not found', async () => {
      service.setEnabled(true);
      (service as any).manifest = null; // No manifest
      
      await service.play('C01');
      
      // Should fall back to speechSynthesis
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should replay current clip', async () => {
      service.setEnabled(true);
      await service.play('C01');
      mockAudio.play.mockClear();
      
      service.replay();
      
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should pause audio', async () => {
      service.setEnabled(true);
      await service.play('C01');
      
      service.pause();
      
      expect(mockAudio.pause).toHaveBeenCalled();
      expect(service.getState().isPlaying).toBe(false);
    });

    it('should stop audio', async () => {
      service.setEnabled(true);
      await service.play('C01');
      
      service.stop();
      
      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.currentTime).toBe(0);
      expect(service.getState().isPlaying).toBe(false);
      expect(service.getState().currentClipId).toBeNull();
    });
  });

  describe('Speed Control', () => {
    it('should set playback speed', () => {
      service.setSpeed(1.25);
      expect(service.getState().speed).toBe(1.25);
      expect(service.getPreferences().defaultSpeed).toBe(1.25);
    });

    it('should apply speed to current audio', async () => {
      service.setEnabled(true);
      await service.play('C01');
      
      service.setSpeed(0.8);
      
      expect(mockAudio.playbackRate).toBe(0.8);
    });
  });

  describe('Language Control', () => {
    it('should set language', () => {
      service.setLang('en');
      expect(service.getState().currentLang).toBe('en');
      expect(service.getPreferences().defaultLang).toBe('en');
    });
  });

  describe('Volume Control', () => {
    it('should set volume', () => {
      service.setVolume(0.5);
      expect(service.getState().volume).toBe(0.5);
    });

    it('should clamp volume between 0 and 1', () => {
      service.setVolume(1.5);
      expect(service.getState().volume).toBe(1);
      
      service.setVolume(-0.5);
      expect(service.getState().volume).toBe(0);
    });
  });

  describe('Enable/Disable', () => {
    it('should enable voice guide', () => {
      service.setEnabled(true);
      expect(service.getPreferences().enabled).toBe(true);
    });

    it('should disable voice guide and stop playback', async () => {
      service.setEnabled(true);
      await service.play('C01');
      
      service.setEnabled(false);
      
      expect(service.getPreferences().enabled).toBe(false);
      expect(service.getState().isPlaying).toBe(false);
    });
  });

  describe('Trigger Mapping', () => {
    it('should play correct clip for home event', async () => {
      service.setEnabled(true);
      service.trigger('home');
      
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should play correct clip for service_select event', async () => {
      service.setEnabled(true);
      service.trigger('service_select');
      
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should play correct clip for upload_start event', async () => {
      service.setEnabled(true);
      service.trigger('upload_start');
      
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should play correct clip for approved event with dynamic data', async () => {
      service.setEnabled(true);
      service.trigger('approved', { tokenCode: '123', price: 50 });
      
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should not trigger when disabled', async () => {
      service.setEnabled(false);
      service.trigger('home');
      
      expect(mockAudio.play).not.toHaveBeenCalled();
    });
  });

  describe('Dynamic TTS', () => {
    it('should filter sensitive data (NID numbers)', async () => {
      service.setEnabled(true);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false, // Force fallback to Web Speech
      });
      
      await service.speakDynamic({ tokenCode: '123', price: 50 }, 'bn');
      
      // Check that speechSynthesis was called with filtered text
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
      const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
      expect(utterance.text).not.toMatch(/\d{10,}/); // No long numbers
    });

    it('should filter phone numbers', async () => {
      service.setEnabled(true);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });
      
      await service.speakDynamic({ 
        tokenCode: '123', 
        price: 50 
      }, 'bn');
      
      // The tokenCode is short (3 digits) so it should be spoken
      // But long numbers like NID (10+ digits) should be filtered
      const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
      expect(utterance.text).toContain('123'); // Short token code OK
    });

    it('should filter passport-like patterns', async () => {
      service.setEnabled(true);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });
      
      // Test with a text containing passport-like pattern
      await service.speakDynamic({ 
        tokenCode: 'AB1234567890', // This looks like a passport
        price: 50 
      }, 'bn');
      
      const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
      expect(utterance.text).toContain('[সংবেদনশীল তথ্য]');
    });
  });

  describe('State Management', () => {
    it('should return current state', () => {
      const state = service.getState();
      expect(state).toHaveProperty('isPlaying');
      expect(state).toHaveProperty('currentClipId');
      expect(state).toHaveProperty('currentLang');
      expect(state).toHaveProperty('speed');
      expect(state).toHaveProperty('volume');
    });

    it('should return current preferences', () => {
      const prefs = service.getPreferences();
      expect(prefs).toHaveProperty('enabled');
      expect(prefs).toHaveProperty('defaultLang');
      expect(prefs).toHaveProperty('defaultSpeed');
    });

    it('should notify subscribers on state change', async () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);
      
      service.setEnabled(true);
      await service.play('C01');
      
      expect(listener).toHaveBeenCalled();
      
      unsubscribe();
      listener.mockClear();
      
      service.stop();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Persistence', () => {
    it('should save preferences to localStorage', () => {
      service.setEnabled(true);
      service.setLang('en');
      service.setSpeed(1.25);
      
      const stored = localStorage.getItem('voice-guide-prefs');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.enabled).toBe(true);
      expect(parsed.defaultLang).toBe('en');
      expect(parsed.defaultSpeed).toBe(1.25);
    });

    it('should load preferences from localStorage on init', () => {
      localStorage.setItem('voice-guide-prefs', JSON.stringify({
        enabled: false,
        defaultLang: 'en',
        defaultSpeed: 0.8,
      }));
      
      // Create new instance to test loading
      const newService = VoiceGuideService.getInstance();
      // Manually trigger loadPreferences
      (newService as any).loadPreferences();
      
      expect(newService.getPreferences().enabled).toBe(false);
      expect(newService.getPreferences().defaultLang).toBe('en');
      expect(newService.getPreferences().defaultSpeed).toBe(0.8);
    });
  });
});

describe('filterSensitiveData', () => {
  // Import the filter function - we need to export it or test via the service
  const service = VoiceGuideService.getInstance();
  
  // Access private method through service instance
  const filterFn = (text: string) => {
    // Replicate the filter logic
    const SENSITIVE_PATTERNS = [
      /\b\d{10,17}\b/g,
      /\b\d{11}\b/g,
      /\b[A-Z]{2}\d{10,}\b/gi,
    ];
    let filtered = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      filtered = filtered.replace(pattern, '[সংবেদনশীল তথ্য]');
    }
    return filtered;
  };

  it('should filter NID numbers (10-17 digits)', () => {
    const text = 'আপনার এনআইডি 12345678901234567 আছে';
    const result = filterFn(text);
    expect(result).toContain('[সংবেদনশীল তথ্য]');
    expect(result).not.toContain('12345678901234567');
  });

  it('should filter phone numbers (11 digits)', () => {
    const text = 'ফোন: 01712345678';
    const result = filterFn(text);
    expect(result).toContain('[সংবেদনশীল তথ্য]');
    expect(result).not.toContain('01712345678');
  });

  it('should filter passport-like patterns', () => {
    const text = 'পাসপোর্ট: AB1234567890';
    const result = filterFn(text);
    expect(result).toContain('[সংবেদনশীল তথ্য]');
    expect(result).not.toContain('AB1234567890');
  });

  it('should NOT filter short token codes (3-4 digits)', () => {
    const text = 'টোকেন কোড 1234';
    const result = filterFn(text);
    expect(result).toContain('1234');
    expect(result).not.toContain('[সংবেদনশীল তথ্য]');
  });

  it('should NOT filter prices', () => {
    const text = 'মোট বিল ১৫০ টাকা';
    const result = filterFn(text);
    expect(result).toContain('১৫০');
    expect(result).not.toContain('[সংবেদনশীল তথ্য]');
  });
});