import type { StudioService } from '../types';

/**
 * Reusable service presets (ডিফল্ট প্রিসেট) for the shop's service management.
 *
 * Every shopkeeper creates or deletes services from these presets instead of
 * configuring paper size, DPI and colour from scratch, so a new service is
 * always creatable with sane print-shop defaults. Codes are unique across the
 * catalog and deliberately distinct from `INITIAL_STUDIO_SERVICES` codes
 * (PASSPORT, STAMP, NID, PHOTO4R, A4DOC) so `createStudioService` never rejects
 * a preset because a built-in service already owns the code.
 */
export interface ServicePreset {
  code: string; // short code, e.g. 'A4BW'
  title: string; // English label
  titleBn: string; // Bengali label
  descriptionBn: string; // Bengali description
  icon: string; // emoji
  category: StudioService['category'];
  basePriceBDT: number;
  autoApprove: boolean;
  preferences: StudioService['preferences'];
}

export const SERVICE_PRESETS: readonly ServicePreset[] = [
  {
    code: 'IDCARD',
    title: 'ID Card Print',
    titleBn: 'পরিচয়পত্র (ID কার্ড) প্রিন্ট',
    descriptionBn: 'জাতীয় পরিচয়পত্র, ছাত্র ও কর্মী ID কার্ডের রঙিন প্রিন্ট',
    icon: '🪪',
    category: 'card',
    basePriceBDT: 20,
    autoApprove: false,
    preferences: {
      paperType: 'glossy',
      quality: 'high',
      color: 'color',
      paperSize: 'A4 (8.27x11.69 in)',
      dpi: 1200,
      defaultCopies: 1,
      borderless: false,
    },
  },
  {
    code: 'A4BW',
    title: 'A4 Print (B/W)',
    titleBn: 'A4 প্রিন্ট (সাদা-কালো)',
    descriptionBn: 'ফরম, চালান ও সাধারণ ডকুমেন্টের সাদা-কালো প্রিন্ট',
    icon: '🖨️',
    category: 'document',
    basePriceBDT: 5,
    autoApprove: true,
    preferences: {
      paperType: 'plain',
      quality: 'normal',
      color: 'bw',
      paperSize: 'A4 (8.27x11.69 in)',
      dpi: 600,
      defaultCopies: 1,
      borderless: false,
    },
  },
  {
    code: 'A4CLR',
    title: 'A4 Print (Color)',
    titleBn: 'A4 প্রিন্ট (রঙিন)',
    descriptionBn: 'পোস্টার, ফ্লায়ার ও রঙিন ডকুমেন্টের A4 প্রিন্ট',
    icon: '🌈',
    category: 'document',
    basePriceBDT: 15,
    autoApprove: true,
    preferences: {
      paperType: 'plain',
      quality: 'normal',
      color: 'color',
      paperSize: 'A4 (8.27x11.69 in)',
      dpi: 600,
      defaultCopies: 1,
      borderless: false,
    },
  },
  {
    code: 'DOCFILE',
    title: 'Doc/Docs File Print',
    titleBn: 'ডক/ডকস ফাইল প্রিন্ট',
    descriptionBn: 'ওয়ার্ড (Doc) ও গুগল ডকস ফাইলের প্রিন্ট',
    icon: '📝',
    category: 'document',
    basePriceBDT: 5,
    autoApprove: true,
    preferences: {
      paperType: 'plain',
      quality: 'normal',
      color: 'bw',
      paperSize: 'A4 (8.27x11.69 in)',
      dpi: 600,
      defaultCopies: 1,
      borderless: false,
    },
  },
  {
    code: 'PASSPORT4',
    title: 'Passport Photo Print (4-in-1)',
    titleBn: 'পাসপোর্ট সাইজ ছবি প্রিন্ট (৪ কপি শিট)',
    descriptionBn: 'এক শিটে ৪ কপি ল্যাব কোয়ালিটি পাসপোর্ট ছবি',
    icon: '📸',
    category: 'photo',
    basePriceBDT: 50,
    autoApprove: false,
    preferences: {
      paperType: 'glossy',
      quality: 'high',
      color: 'color',
      paperSize: 'Passport Grid (4-in-1)',
      dpi: 2880,
      defaultCopies: 1,
      borderless: true,
    },
  },
  {
    code: 'PASSPORT8',
    title: 'Passport Photo Print (8-in-1)',
    titleBn: 'পাসপোর্ট সাইজ ছবি প্রিন্ট (৮ কপি শিট)',
    descriptionBn: 'এক শিটে ৮ কপি ল্যাব কোয়ালিটি পাসপোর্ট ছবি',
    icon: '🛂',
    category: 'photo',
    basePriceBDT: 80,
    autoApprove: false,
    preferences: {
      paperType: 'glossy',
      quality: 'high',
      color: 'color',
      paperSize: 'Passport Grid (8-in-1)',
      dpi: 2880,
      defaultCopies: 1,
      borderless: true,
    },
  },
  {
    code: 'PHOTO34R',
    title: '3R/4R Photo Print',
    titleBn: '৩আর/৪আর ছবি প্রিন্ট',
    descriptionBn: 'হাই-গ্লসি ফটো পেপারে পারিবারিক ও অ্যালবাম ছবি',
    icon: '🖼️',
    category: 'photo',
    basePriceBDT: 35,
    autoApprove: false,
    preferences: {
      paperType: 'glossy',
      quality: 'high',
      color: 'color',
      paperSize: '4R (4x6 in)',
      dpi: 2880,
      defaultCopies: 1,
      borderless: true,
    },
  },
  {
    code: 'PHOTO6R',
    title: '6R Photo Print',
    titleBn: '৬আর ছবি প্রিন্ট',
    descriptionBn: 'বড় সাইজ ল্যাব ফটো প্রিন্ট',
    icon: '🏞️',
    category: 'photo',
    basePriceBDT: 60,
    autoApprove: false,
    preferences: {
      paperType: 'glossy',
      quality: 'high',
      color: 'color',
      paperSize: 'Custom',
      dpi: 2880,
      defaultCopies: 1,
      borderless: true,
    },
  },
  {
    code: 'STAMPPHOTO',
    title: 'Stamp Size Photo Print',
    titleBn: 'স্ট্যাম্প সাইজ ছবি প্রিন্ট',
    descriptionBn: 'অফিসিয়াল ফরম ও আবেদনপত্রের স্ট্যাম্প সাইজ ছবি',
    icon: '🏷️',
    category: 'photo',
    basePriceBDT: 30,
    autoApprove: false,
    preferences: {
      paperType: 'glossy',
      quality: 'high',
      color: 'color',
      paperSize: 'Stamp Size',
      dpi: 2880,
      defaultCopies: 1,
      borderless: true,
    },
  },
  {
    code: 'LEGALDOC',
    title: 'Legal Document Print',
    titleBn: 'লিগ্যাল সাইজ ডকুমেন্ট প্রিন্ট',
    descriptionBn: 'লিগ্যাল কাগজে দলিল ও অফিসিয়াল ডকুমেন্ট প্রিন্ট',
    icon: '📄',
    category: 'document',
    basePriceBDT: 10,
    autoApprove: true,
    preferences: {
      paperType: 'plain',
      quality: 'normal',
      color: 'bw',
      paperSize: 'Legal',
      dpi: 600,
      defaultCopies: 1,
      borderless: false,
    },
  },
];

/** A creatable service definition derived from a preset (id is assigned on create). */
export const createServiceFromPreset = (preset: ServicePreset): Omit<StudioService, 'id' | 'isCustom'> => ({
  code: preset.code,
  title: preset.title,
  titleBn: preset.titleBn,
  descriptionBn: preset.descriptionBn,
  icon: preset.icon,
  category: preset.category,
  basePriceBDT: preset.basePriceBDT,
  enabled: true,
  autoApprove: preset.autoApprove,
  preferences: { ...preset.preferences },
});
