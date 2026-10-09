import { VoiceGuideClip, VoiceGuideManifest } from '../types/voiceGuide';

// ============================================================================
// Types
// ============================================================================

export type VoiceGuideLang = 'bn' | 'en';
export type VoiceGuideSpeed = 0.8 | 1.0 | 1.25;

export interface VoiceGuidePreferences {
  enabled: boolean;
  defaultLang: VoiceGuideLang;
  defaultSpeed: VoiceGuideSpeed;
}

export interface VoiceGuideState {
  isPlaying: boolean;
  currentClipId: string | null;
  currentLang: VoiceGuideLang;
  speed: VoiceGuideSpeed;
  volume: number;
}

export type VoiceGuideEvent = 
  | 'home'
  | 'service_select'
  | 'upload_start'
  | 'upload_progress'
  | 'upload_success'
  | 'upload_failed'
  | 'copies_select'
  | 'size_select'
  | 'color_select'
  | 'crop_rotate'
  | 'preview'
  | 'confirm'
  | 'waiting_approval'
  | 'approved'
  | 'ready'
  | 'price_changed'
  | 'rejected'
  | 'rejected_paid'
  | 'payment'
  | 'payment_success'
  | 'shop_closed'
  | 'offline'
  | 'security_note'
  | 'goodbye';

export interface DynamicTTSData {
  tokenCode?: string;
  price?: number;
  orderNumber?: string;
  serviceName?: string;
  pickupCode?: string;
}

// ============================================================================
// Sensitive data filter - never speak NID, name, phone
// ============================================================================

const SENSITIVE_PATTERNS = [
  /\b\d{10,17}\b/g, // NID numbers (10-17 digits)
  /\b\d{11}\b/g,    // Phone numbers (11 digits for BD)
  /\b[A-Z]{2}\d{10,}\b/gi, // Passport-like patterns
];

function filterSensitiveData(text: string): string {
  let filtered = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    filtered = filtered.replace(pattern, '[সংবেদনশীল তথ্য]');
  }
  return filtered;
}

// ============================================================================
// VoiceGuideService Class
// ============================================================================

export class VoiceGuideService {
  private static instance: VoiceGuideService;
  private manifest: VoiceGuideManifest | null = null;
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private currentAudio: HTMLAudioElement | null = null;
  private state: VoiceGuideState = {
    isPlaying: false,
    currentClipId: null,
    currentLang: 'bn',
    speed: 1.0,
    volume: 1.0,
  };
  private preferences: VoiceGuidePreferences = {
    enabled: true,
    defaultLang: 'bn',
    defaultSpeed: 1.0,
  };
  private listeners: Set<(state: VoiceGuideState) => void> = new Set();
  private utterance: SpeechSynthesisUtterance | null = null;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.loadPreferences();
      this.initAudioContext();
    }
  }

  static getInstance(): VoiceGuideService {
    if (!VoiceGuideService.instance) {
      VoiceGuideService.instance = new VoiceGuideService();
    }
    return VoiceGuideService.instance;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  private initAudioContext(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    } catch {
      // AudioContext not available
    }
  }

  private async ensureAudioContext(): Promise<AudioContext | null> {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem('voice-guide-prefs');
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore parsing errors
    }
    this.state.currentLang = this.preferences.defaultLang;
    this.state.speed = this.preferences.defaultSpeed;
  }

  private savePreferences(): void {
    try {
      localStorage.setItem('voice-guide-prefs', JSON.stringify(this.preferences));
    } catch {
      // Ignore storage errors
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      const response = await fetch('/audio/manifest.json');
      if (response.ok) {
        this.manifest = await response.json();
      }
    } catch {
      console.warn('Voice guide manifest not found, using fallback');
    }
    this.isInitialized = true;
  }

  // ---------------------------------------------------------------------------
  // Manifest & Clip Management
  // ---------------------------------------------------------------------------

  getManifest(): VoiceGuideManifest | null {
    return this.manifest;
  }

  getClip(id: string, lang: VoiceGuideLang = 'bn'): VoiceGuideClip | undefined {
    if (!this.manifest) return undefined;
    return this.manifest.clips.find(clip => clip.id === id && clip.lang === lang);
  }

  getClipUrl(id: string, lang: VoiceGuideLang = 'bn'): string | null {
    const clip = this.getClip(id, lang);
    if (!clip) return null;
    return `/${clip.file}`;
  }

  // ---------------------------------------------------------------------------
  // Audio Playback (Static Clips)
  // ---------------------------------------------------------------------------

  async play(id: string, lang?: VoiceGuideLang): Promise<void> {
    if (!this.preferences.enabled) return;

    const targetLang = lang || this.state.currentLang;
    const url = this.getClipUrl(id, targetLang);

    if (!url) {
      console.warn(`Voice clip ${id} not found for lang ${targetLang}, trying fallback`);
      // Try fallback to Bengali
      if (targetLang !== 'bn') {
        return this.play(id, 'bn');
      }
      // Fallback to TTS
      const clip = this.getClip(id, 'bn');
      if (clip) {
        return this.speakText(filterSensitiveData(clip.text_bn), 'bn');
      }
      return;
    }

    this.stop();

    try {
      const audio = new Audio(url);
      audio.playbackRate = this.state.speed;
      audio.volume = this.state.volume;
      
      this.currentAudio = audio;
      this.state.isPlaying = true;
      this.state.currentClipId = id;
      this.notifyListeners();

      audio.onended = () => {
        this.state.isPlaying = false;
        this.state.currentClipId = null;
        this.currentAudio = null;
        this.notifyListeners();
      };

      audio.onerror = () => {
        this.state.isPlaying = false;
        this.state.currentClipId = null;
        this.currentAudio = null;
        this.notifyListeners();
        // Fallback to TTS
        const clip = this.getClip(id, targetLang);
        if (clip) {
          this.speakText(filterSensitiveData(clip.text_bn), targetLang);
        }
      };

      await audio.play();
    } catch (error) {
      console.warn('Audio playback failed, falling back to TTS:', error);
      const clip = this.getClip(id, targetLang);
      if (clip) {
        this.speakText(filterSensitiveData(clip.text_bn), targetLang);
      }
    }
  }

  replay(): void {
    if (this.state.currentClipId) {
      this.play(this.state.currentClipId, this.state.currentLang);
    }
  }

  pause(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.state.isPlaying = false;
      this.notifyListeners();
    }
    if (this.utterance && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.state.isPlaying = false;
      this.notifyListeners();
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    this.state.isPlaying = false;
    this.state.currentClipId = null;
    this.notifyListeners();
  }

  setSpeed(speed: VoiceGuideSpeed): void {
    this.state.speed = speed;
    this.preferences.defaultSpeed = speed;
    this.savePreferences();
    if (this.currentAudio) {
      this.currentAudio.playbackRate = speed;
    }
    this.notifyListeners();
  }

  setLang(lang: VoiceGuideLang): void {
    this.state.currentLang = lang;
    this.preferences.defaultLang = lang;
    this.savePreferences();
    this.notifyListeners();
  }

  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.state.volume;
    }
    this.notifyListeners();
  }

  setEnabled(enabled: boolean): void {
    this.preferences.enabled = enabled;
    this.savePreferences();
    if (!enabled) {
      this.stop();
    }
    this.notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Dynamic TTS for Variable Data
  // ---------------------------------------------------------------------------

  async speakDynamic(data: DynamicTTSData, lang: VoiceGuideLang = 'bn'): Promise<void> {
    if (!this.preferences.enabled) return;

    let text = '';
    
    if (lang === 'bn') {
      const parts: string[] = [];
      if (data.tokenCode) parts.push(`টোকেন কোড ${data.tokenCode}`);
      if (data.price !== undefined) parts.push(`মোট বিল ${data.price} টাকা`);
      if (data.orderNumber) parts.push(`অর্ডার নম্বর ${data.orderNumber}`);
      if (data.serviceName) parts.push(`সার্ভিস ${data.serviceName}`);
      if (data.pickupCode) parts.push(`পিকআপ কোড ${data.pickupCode}`);
      text = parts.join('। ') + '।';
    } else {
      const parts: string[] = [];
      if (data.tokenCode) parts.push(`Token code ${data.tokenCode}`);
      if (data.price !== undefined) parts.push(`Total bill ${data.price} Taka`);
      if (data.orderNumber) parts.push(`Order number ${data.orderNumber}`);
      if (data.serviceName) parts.push(`Service ${data.serviceName}`);
      if (data.pickupCode) parts.push(`Pickup code ${data.pickupCode}`);
      text = parts.join('. ') + '.';
    }

    // Filter sensitive data
    text = filterSensitiveData(text);

    // Try server-side TTS first
    const success = await this.speakWithServerTTS(text, lang);
    if (!success) {
      // Fallback to Web Speech API
      this.speakText(text, lang);
    }
  }

  private async speakWithServerTTS(text: string, lang: VoiceGuideLang): Promise<boolean> {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: lang === 'bn' ? 'bn-BD' : 'en-US' }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = this.state.speed;
        audio.volume = this.state.volume;
        
        this.currentAudio = audio;
        this.state.isPlaying = true;
        this.notifyListeners();

        audio.onended = () => {
          this.state.isPlaying = false;
          this.currentAudio = null;
          URL.revokeObjectURL(url);
          this.notifyListeners();
        };

        audio.onerror = () => {
          this.state.isPlaying = false;
          this.currentAudio = null;
          URL.revokeObjectURL(url);
          this.notifyListeners();
          return false;
        };

        await audio.play();
        return true;
      }
    } catch {
      // Server TTS failed
    }
    return false;
  }

  private speakText(text: string, lang: VoiceGuideLang): void {
    if (!this.preferences.enabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    this.stop();
    this.ensureAudioContext(); // Unlock audio context

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.state.speed;
    utterance.pitch = 1.0;
    utterance.volume = this.state.volume;

    const voices = window.speechSynthesis.getVoices();
    if (lang === 'bn') {
      const bnVoice = voices.find(v => 
        v.lang.startsWith('bn') || 
        v.lang.includes('Bangla') || 
        v.lang.includes('Bengali')
      );
      if (bnVoice) {
        utterance.voice = bnVoice;
        utterance.lang = bnVoice.lang;
      } else {
        utterance.lang = 'bn-BD';
      }
    } else {
      const enVoice = voices.find(v => v.lang.startsWith('en'));
      if (enVoice) {
        utterance.voice = enVoice;
        utterance.lang = enVoice.lang;
      } else {
        utterance.lang = 'en-US';
      }
    }

    utterance.onstart = () => {
      this.state.isPlaying = true;
      this.notifyListeners();
    };

    utterance.onend = () => {
      this.state.isPlaying = false;
      this.utterance = null;
      this.notifyListeners();
    };

    utterance.onerror = () => {
      this.state.isPlaying = false;
      this.utterance = null;
      this.notifyListeners();
    };

    this.utterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  // ---------------------------------------------------------------------------
  // Event-based Trigger Mapping
  // ---------------------------------------------------------------------------

  private eventToClipMap: Record<VoiceGuideEvent, string> = {
    home: 'C01',
    service_select: 'C02',
    upload_start: 'C06',
    upload_progress: 'C07',
    upload_success: 'C08',
    upload_failed: 'C09',
    copies_select: 'C10',
    size_select: 'C11',
    color_select: 'C12',
    crop_rotate: 'C13',
    preview: 'C14',
    confirm: 'C15',
    waiting_approval: 'C16',
    approved: 'C17',
    ready: 'C18',
    price_changed: 'C19',
    rejected: 'C20',
    rejected_paid: 'C21',
    payment: 'C22',
    payment_success: 'C23',
    shop_closed: 'C24',
    offline: 'C25',
    security_note: 'C26',
    goodbye: 'C27',
  };

  trigger(event: VoiceGuideEvent, dynamicData?: DynamicTTSData): void {
    if (!this.preferences.enabled) return;

    const clipId = this.eventToClipMap[event];
    if (clipId) {
      this.play(clipId);
    }

    // Handle dynamic data for certain events
    if (dynamicData && (event === 'approved' || event === 'ready' || event === 'rejected' || event === 'rejected_paid' || event === 'payment_success')) {
      // Wait a bit for the static clip to start, then speak dynamic data
      setTimeout(() => {
        this.speakDynamic(dynamicData, this.state.currentLang);
      }, 1500);
    }
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  getState(): VoiceGuideState {
    return { ...this.state };
  }

  getPreferences(): VoiceGuidePreferences {
    return { ...this.preferences };
  }

  subscribe(listener: (state: VoiceGuideState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.stop();
    this.listeners.clear();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const voiceGuide = VoiceGuideService.getInstance();