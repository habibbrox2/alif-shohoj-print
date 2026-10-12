export type VoiceCommandId =
  | 'next'
  | 'back'
  | 'confirm'
  | 'copies_up'
  | 'copies_down'
  | 'color'
  | 'bw'
  | 'replay'
  | 'help'
  | 'stop'
  | 'approve'
  | 'reject';

export type VoiceCommandLang = 'bn' | 'en';

export interface VoiceCommandDefinition {
  id: VoiceCommandId;
  bn: readonly string[];
  en: readonly string[];
  hintBn: string;
  hintEn: string;
}

export interface VoiceCommandMatch {
  id: VoiceCommandId;
  transcript: string;
}
