import { FlexStyle, TextStyle, ViewStyle } from 'react-native';

/**
 * RTL אחיד ב־Web ובנייד.
 *
 * מודל: I18nManager.isRTL = true בכל הפלטפורמות.
 * - textAlign:'left'  = start (ימין בעברית)
 * - textAlign:'right' = end   (שמאל בעברית) — לא להשתמש ליישור עברית
 * - flex-start / flex-end מתהפכים אוטומטית
 *
 * Web: גם document.dir + dir="rtl" על השורש (App.tsx).
 * Native: expo-localization forcesRTL + forceRTL + reload אם צריך.
 */
export const DIR: ViewStyle = { direction: 'rtl' };

/**
 * שורות אופקיות: עם RTL מספיק 'row' (start מימין).
 * row-reverse גורם להיפוך כפול.
 */
export const rowDir = 'row' as const;

/** יישור לתחילת השורה בעברית (ימין כש־RTL פעיל) */
export const alignStart = 'flex-start' as const;
export const alignEnd = 'flex-end' as const;

export const rtlText: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'left',
};

export const rtlRow: FlexStyle = {
  flexDirection: rowDir,
  direction: 'rtl',
};
