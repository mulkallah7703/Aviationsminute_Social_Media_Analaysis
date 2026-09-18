export const PLATFORM_CODES = [
  'youtube',
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'x',
  'snapchat',
] as const;

export type PlatformCode = (typeof PLATFORM_CODES)[number];

export const FIRST_PRODUCTION_PLATFORM: PlatformCode = 'youtube';

export type PlatformAvailability = 'available' | 'coming_soon';

export interface PlatformCatalogEntry {
  code: PlatformCode;
  name: string;
  nameAr: string;
  availability: PlatformAvailability;
  comingSoonLabel: string;
  comingSoonLabelAr: string;
}

export const PLATFORM_CATALOG: readonly PlatformCatalogEntry[] = [
  {
    code: 'youtube',
    name: 'YouTube',
    nameAr: 'يوتيوب',
    availability: 'available',
    comingSoonLabel: 'Connect YouTube',
    comingSoonLabelAr: 'ربط يوتيوب',
  },
  {
    code: 'instagram',
    name: 'Instagram',
    nameAr: 'إنستغرام',
    availability: 'coming_soon',
    comingSoonLabel: 'Coming Soon',
    comingSoonLabelAr: 'ستتاح قريبًا',
  },
  {
    code: 'facebook',
    name: 'Facebook',
    nameAr: 'فيسبوك',
    availability: 'coming_soon',
    comingSoonLabel: 'Coming Soon',
    comingSoonLabelAr: 'ستتاح قريبًا',
  },
  {
    code: 'tiktok',
    name: 'TikTok',
    nameAr: 'تيك توك',
    availability: 'coming_soon',
    comingSoonLabel: 'Coming Soon',
    comingSoonLabelAr: 'ستتاح قريبًا',
  },
  {
    code: 'linkedin',
    name: 'LinkedIn',
    nameAr: 'لينكدإن',
    availability: 'coming_soon',
    comingSoonLabel: 'Coming Soon',
    comingSoonLabelAr: 'ستتاح قريبًا',
  },
  {
    code: 'x',
    name: 'X',
    nameAr: 'إكس',
    availability: 'coming_soon',
    comingSoonLabel: 'Coming Soon',
    comingSoonLabelAr: 'ستتاح قريبًا',
  },
  {
    code: 'snapchat',
    name: 'Snapchat',
    nameAr: 'سناب شات',
    availability: 'coming_soon',
    comingSoonLabel: 'Coming Soon',
    comingSoonLabelAr: 'ستتاح قريبًا',
  },
] as const;

export function isPlatformCode(value: string): value is PlatformCode {
  return (PLATFORM_CODES as readonly string[]).includes(value);
}

export function getPlatformCatalogEntry(code: PlatformCode): PlatformCatalogEntry {
  const entry = PLATFORM_CATALOG.find((item) => item.code === code);
  if (!entry) {
    throw new Error(`Unknown platform code: ${code}`);
  }
  return entry;
}
