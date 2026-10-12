import type { VoiceCommandDefinition, VoiceCommandId, VoiceCommandLang } from '../types/voiceCommands';

// Basic command set: 10 customer commands (bn + en) + approve/reject for the shop inbox.
// Matching is substring-based so short natural phrases work in both languages.

export const VOICE_COMMANDS: readonly VoiceCommandDefinition[] = [
  { id: 'next', bn: ['পরের ধাপ', 'পরের', 'সামনে যাও', 'এগিয়ে যাও'], en: ['next', 'next step', 'continue', 'go forward'], hintBn: '“পরের ধাপ”', hintEn: '“next”' },
  { id: 'back', bn: ['পেছনে যাও', 'পিছনে', 'ব্যাক', 'আগের ধাপ'], en: ['back', 'previous', 'go back', 'previous step'], hintBn: '“পেছনে যাও”', hintEn: '“back”' },
  { id: 'confirm', bn: ['কনফার্ম', 'কনফার্ম করো', 'অর্ডার করো', 'নিশ্চিত করো'], en: ['confirm', 'confirm order', 'place order', 'submit'], hintBn: '“কনফার্ম করো”', hintEn: '“confirm order”' },
  { id: 'copies_up', bn: ['কপি বাড়াও', 'একটা বাড়াও', 'আরেকটা কপি', 'সংখ্যা বাড়াও'], en: ['more copies', 'increase copies', 'one more copy', 'copies up'], hintBn: '“কপি বাড়াও”', hintEn: '“more copies”' },
  { id: 'copies_down', bn: ['কপি কমাও', 'একটা কমাও', 'সংখ্যা কমাও'], en: ['fewer copies', 'decrease copies', 'one less copy', 'copies down'], hintBn: '“কপি কমাও”', hintEn: '“fewer copies”' },
  { id: 'color', bn: ['রঙিন', 'কালার', 'রঙিন করো'], en: ['color', 'colour', 'color mode'], hintBn: '“রঙিন”', hintEn: '“color”' },
  { id: 'bw', bn: ['সাদা কালো', 'সাদাকালো', 'ব্ল্যাক হোয়াইট'], en: ['black and white', 'black white', 'grayscale', 'bw'], hintBn: '“সাদা কালো”', hintEn: '“black and white”' },
  { id: 'replay', bn: ['আবার বলো', 'আবার শোনাও', 'আবার শুনতে চাই'], en: ['repeat', 'say again', 'replay', 'play again'], hintBn: '“আবার বলো”', hintEn: '“repeat”' },
  { id: 'help', bn: ['সাহায্য', 'কী বলতে পারি', 'কি বলবো', 'হেল্প'], en: ['help', 'what can i say', 'commands', 'options'], hintBn: '“সাহায্য”', hintEn: '“help”' },
  { id: 'stop', bn: ['থামো', 'বন্ধ করো', 'চুপ করো'], en: ['stop', 'cancel', 'quiet', 'mute'], hintBn: '“থামো”', hintEn: '“stop”' },
  { id: 'approve', bn: ['অনুমোদন', 'এপ্রুভ', 'অনুমোদন করো'], en: ['approve', 'approve order', 'accept order'], hintBn: '“অনুমোদন করো”', hintEn: '“approve order”' },
  { id: 'reject', bn: ['বাতিল', 'বাতিল করো', 'রিজেক্ট'], en: ['reject', 'reject order', 'decline'], hintBn: '“বাতিল করো”', hintEn: '“reject order”' },
];

export function normalizeTranscript(input: string): string {
  return input
    .toLowerCase()
    .replace(/[।.,!?;:"'()\[\]<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchVoiceCommand(transcript: string): VoiceCommandId | null {
  const text = normalizeTranscript(transcript);
  if (!text) return null;
  let best: { id: VoiceCommandId; length: number } | null = null;
  for (const command of VOICE_COMMANDS) {
    const phrases = [...command.bn.map(normalizeTranscript), ...command.en.map(normalizeTranscript)];
    for (const phrase of phrases) {
      if (!phrase) continue;
      if (text === phrase || text.includes(phrase)) {
        if (!best || phrase.length > best.length) {
          best = { id: command.id, length: phrase.length };
        }
      }
    }
  }
  return best?.id ?? null;
}

export function getVoiceCommandHints(lang: VoiceCommandLang): string[] {
  return VOICE_COMMANDS.map(command => (lang === 'bn' ? command.hintBn : command.hintEn));
}

// Spoken confirmation clip (VC series in voice-manifest.json) for each voice
// command. Handlers play these selectively: step-changing commands already
// trigger a guide clip for the new step, so only silent actions get feedback.
export const VOICE_COMMAND_CLIP_ID: Record<VoiceCommandId, string> = {
  next: 'VC01',
  back: 'VC02',
  confirm: 'VC03',
  copies_up: 'VC04',
  copies_down: 'VC05',
  color: 'VC06',
  bw: 'VC07',
  replay: 'VC08',
  help: 'VC09',
  stop: 'VC10',
  approve: 'VC11',
  reject: 'VC12',
};

export function isVoiceCommandSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.SpeechRecognition === 'function' || typeof w.webkitSpeechRecognition === 'function';
}

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export interface VoiceCommandListenerOptions {
  lang?: VoiceCommandLang;
  onCommand: (id: VoiceCommandId, transcript: string) => void;
  onTranscript?: (transcript: string, matched: VoiceCommandId | null) => void;
  onError?: (message: string) => void;
}

// Thin wrapper around the Web Speech API. Audio never leaves the browser
// except to the browser vendor's own speech service (Chrome); transcripts
// are matched locally and never uploaded by this app.
export class VoiceCommandListener {
  private recognition: RecognitionInstance | null = null;
  private listening = false;

  constructor(private options: VoiceCommandListenerOptions) {}

  start(): boolean {
    if (this.listening) return true;
    if (!isVoiceCommandSupported()) {
      this.options.onError?.('speech_not_supported');
      return false;
    }
    try {
      const w = window as unknown as Record<string, new () => RecognitionInstance>;
      const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      const recognition = new Recognition();
      recognition.lang = this.options.lang === 'en' ? 'en-US' : 'bn-BD';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        const transcript = String(event.results?.[0]?.[0]?.transcript ?? '');
        if (!transcript) return;
        const matched = matchVoiceCommand(transcript);
        this.options.onTranscript?.(transcript, matched);
        if (matched) this.options.onCommand(matched, transcript);
      };
      recognition.onerror = event => {
        this.options.onError?.(String(event?.error ?? 'recognition_error'));
      };
      recognition.onend = () => {
        this.listening = false;
        this.recognition = null;
      };
      recognition.start();
      this.recognition = recognition;
      this.listening = true;
      return true;
    } catch {
      this.options.onError?.('recognition_error');
      return false;
    }
  }

  stop(): void {
    try {
      this.recognition?.stop();
    } catch {
      // Ignore stop errors; onend cleans up state.
    }
    this.listening = false;
    this.recognition = null;
  }

  isListening(): boolean {
    return this.listening;
  }
}
