export interface VoiceGuideClip {
  id: string;
  text_bn: string;
  text_en?: string;
  file: string;
  lang: 'bn' | 'en';
  version?: string;
}

export interface VoiceGuideManifest {
  version: string;
  clips: VoiceGuideClip[];
}

export interface VoiceGuidePreferences {
  enabled: boolean;
  defaultLang: 'bn' | 'en';
  defaultSpeed: 0.8 | 1.0 | 1.25;
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