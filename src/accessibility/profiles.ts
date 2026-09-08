import type { A11yProfileId, A11ySettings } from './types';
import { DEFAULT_A11Y } from './types';

export type ProfileMeta = {
  id: A11yProfileId;
  title: string;
  subtitle: string;
  /** גליף גיאומטרי — בלי אימוג'י */
  icon: string;
  patch: Partial<A11ySettings>;
};

export const A11Y_PROFILES: ProfileMeta[] = [
  {
    id: 'motor',
    title: 'לקות מוטורית',
    subtitle: 'כפתורים גדולים, מקלדת, סמן מוגדל',
    icon: '⊕',
    patch: {
      largeButtons: true,
      keyboardNav: true,
      highlightFocus: true,
      highlightHover: true,
      bigCursor: 'large',
      stopAnimations: true,
      fontSize: 1,
      contentSpacing: 2,
    },
  },
  {
    id: 'dyslexia',
    title: 'דיסלקציה',
    subtitle: 'גופן קריא, ריווח מוגדל, הדגשת קישורים',
    icon: 'Aa',
    patch: {
      dyslexiaFont: true,
      readableFont: true,
      letterSpacing: 2,
      wordSpacing: 2,
      lineHeight: 2,
      highlightLinks: true,
      underlineLinks: true,
      readingGuide: true,
      boldText: false,
    },
  },
  {
    id: 'cognitive',
    title: 'קוגניטיבי ולמידה',
    subtitle: 'מצב קריאה, הסתרת תמונות, ריווח נוח',
    icon: '◈',
    patch: {
      readingMode: true,
      hideImages: true,
      fontSize: 1,
      lineHeight: 2,
      readableFont: true,
      stopAnimations: true,
      highlightHeadings: true,
      contentSpacing: 1,
      lowTransparency: true,
    },
  },
  {
    id: 'adhd',
    title: 'קשב וריכוז',
    subtitle: 'מסכת קריאה, עצירת אנימציות, מיקוד',
    icon: '◎',
    patch: {
      readingMask: true,
      readingGuide: true,
      stopAnimations: true,
      reduceMotion: true,
      highlightFocus: true,
      lowTransparency: true,
    },
  },
  {
    id: 'vision',
    title: 'לקות ראייה',
    subtitle: 'ניגודיות גבוהה, טקסט גדול, סמן כהה',
    icon: '◐',
    patch: {
      contrast: 'high',
      fontSize: 3,
      lineHeight: 2,
      bigCursor: 'largeDark',
      highlightLinks: true,
      highlightHeadings: true,
      highlightFocus: true,
      readableFont: true,
      boldText: true,
      underlineLinks: true,
      largeButtons: true,
    },
  },
  {
    id: 'seizure',
    title: 'התקפים ואפילפסיה',
    subtitle: 'ביטול הבהובים, הפחתת תנועה, רוויה נמוכה',
    icon: '⏸',
    patch: {
      stopAnimations: true,
      reduceMotion: true,
      saturation: 'low',
      muteMedia: true,
      highlightHover: false,
    },
  },
];

export function applyProfile(
  current: A11ySettings,
  profileId: A11yProfileId
): A11ySettings {
  if (profileId === 'none') {
    return {
      ...DEFAULT_A11Y,
      widgetHidden: current.widgetHidden,
      panelOpen: current.panelOpen,
      profile: 'none',
    };
  }
  const meta = A11Y_PROFILES.find((p) => p.id === profileId);
  if (!meta) return current;
  return {
    ...DEFAULT_A11Y,
    widgetHidden: current.widgetHidden,
    panelOpen: current.panelOpen,
    profile: profileId,
    ...meta.patch,
  };
}

export const LEVEL_LABELS = ['רגיל', 'גדול', 'גדול מאוד', 'ענק', 'מקסימלי'] as const;

export const SPEECH_RATE_LABELS = ['רגיל', 'איטי', 'איטי מאוד'] as const;

export const TEXT_ALIGN_OPTIONS = [
  { id: 0 as const, label: 'ברירת מחדל' },
  { id: 1 as const, label: 'לימין' },
  { id: 2 as const, label: 'מרכז' },
];

/** בלי לבן טהור — גוונים מהפלטה */
export const COLOR_SWATCHES = [
  '#8B9BFF',
  '#A78BFA',
  '#C4B5FD',
  '#F0C674',
  '#7EC8E3',
  '#F0A8B8',
  '#4F86D8',
  '#0B1020',
] as const;
