import { VoiceStep } from '../types';

let audioCtx: AudioContext | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

// Initialize or resume AudioContext
export const getAudioContext = (): AudioContext => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// Play cheerful incoming order chime (Bell arpeggio)
export const playIncomingOrderChime = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Notes: C5 -> E5 -> G5 -> C6
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.5);
    });
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
};

// Play mechanical print spool start / finish chime
export const playPrintCompleteChime = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.2); // E6
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.55);
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
};

// Play subtle UI tap tone
export const playTapTone = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {
    // Ignore muted audio context errors
  }
};

export const BANGLA_VOICE_SCRIPTS: Record<VoiceStep, { bn: string; en: string }> = {
  welcome: {
    bn: 'স্বাগতম ব্রক্সপ্রিন্ট ডিজিটাল স্টুডিওতে। সহজে ও দ্রুত প্রিন্ট করতে ধাপগুলো অনুসরণ করুন।',
    en: 'Welcome to ALIF SHOHOJ PRINT. Follow the easy steps to print directly from your phone.',
  },
  service: {
    bn: 'আপনি কী প্রিন্ট করতে চান? পাসপোর্ট সাইজ ছবি, এনআইডি কপি, ৪-আর ছবি, নাকি সাধারণ ডকুমেন্ট?',
    en: 'What would you like to print? Passport photo, NID copy, 4R photo, or document?',
  },
  upload: {
    bn: 'আপনার মোবাইল থেকে স্পষ্ট ফাইল বা ছবি নির্বাচন করুন।',
    en: 'Please select a clear photo or document from your phone.',
  },
  crop: {
    bn: 'ছবিটি ঘুরিয়ে বা ক্রপ করে কাঙ্ক্ষিত ফ্রেমে বসিয়ে নিন।',
    en: 'Crop or rotate your photo to fit the required frame.',
  },
  copies: {
    bn: 'কত কপি চান এবং কালার নাকি সাদা-কালো প্রিন্ট করবেন নির্বাচন করুন।',
    en: 'Select the number of copies, color mode, and paper finish.',
  },
  preview: {
    bn: 'প্রিন্ট প্রিভিউ ও মোট বিল দেখে নিন। সবকিছু ঠিক থাকলে নিশ্চিত করুন।',
    en: 'Review the print preview and total bill. Confirm when ready.',
  },
  token: {
    bn: 'আপনার প্রিন্ট অর্ডার গৃহীত হয়েছে। কাউন্টারে গিয়ে আপনার টোকেন কোডটি বলুন।',
    en: 'Your print order has been received. Please show your token code at the counter.',
  },
};

export class VoiceAssistant {
  private speed: number = 1.0;
  private lang: 'bn' | 'en' = 'bn';
  private isMuted: boolean = false;
  private isSpeaking: boolean = false;
  private onStateChangeCallback?: (isSpeaking: boolean) => void;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Warm up voices
      window.speechSynthesis.getVoices();
    }
  }

  public setOnStateChange(cb: (isSpeaking: boolean) => void) {
    this.onStateChangeCallback = cb;
  }

  public setSpeed(speed: number) {
    this.speed = speed;
  }

  public getSpeed(): number {
    return this.speed;
  }

  public setLanguage(lang: 'bn' | 'en') {
    this.lang = lang;
  }

  public getLanguage(): 'bn' | 'en' {
    return this.lang;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stop();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.onStateChangeCallback?.(false);
    }
  }

  public speakStep(step: VoiceStep, extraDetails?: { tokenCode?: string; price?: number }) {
    if (this.isMuted) return;

    let text = BANGLA_VOICE_SCRIPTS[step]?.[this.lang] || '';

    if (step === 'token' && extraDetails?.tokenCode) {
      if (this.lang === 'bn') {
        text = `অর্ডার সফল হয়েছে! আপনার টোকেন কোড ${extraDetails.tokenCode}। কাউন্টারে কোডটি দেখিয়ে প্রিন্ট সংগ্রহ করুন। মোট বিল ${extraDetails.price || 0} টাকা।`;
      } else {
        text = `Order successful! Your token code is ${extraDetails.tokenCode}. Show this code at the counter. Total bill is ${extraDetails.price || 0} Taka.`;
      }
    }

    this.speakText(text);
  }

  public speakShopAlert(tokenCode: string, serviceLabelBn: string) {
    if (this.isMuted) return;
    playIncomingOrderChime();
    const text = `নতুন অর্ডার এসেছে! টোকেন ${tokenCode}, ${serviceLabelBn}`;
    setTimeout(() => {
      this.speakText(text, 'bn');
    }, 600);
  }

  public speakText(text: string, forceLang?: 'bn' | 'en') {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    this.stop();
    getAudioContext(); // Ensure audio context unlocked

    const targetLang = forceLang || this.lang;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.speed;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (targetLang === 'bn') {
      const bnVoice = voices.find(v => v.lang.startsWith('bn') || v.lang.includes('Bangla') || v.lang.includes('Bengali'));
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
      this.isSpeaking = true;
      this.onStateChangeCallback?.(true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.onStateChangeCallback?.(false);
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.onStateChangeCallback?.(false);
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }
}

export const globalVoice = new VoiceAssistant();
