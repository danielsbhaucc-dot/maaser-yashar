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
      bigCursor: 'large',
      stopAnimations: true,
      fontSize: 1,
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
      readingGuide: true,
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
