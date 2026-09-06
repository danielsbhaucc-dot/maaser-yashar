import { FlexStyle, TextStyle, ViewStyle } from 'react-native';

/**
 * RTL יציב בנייד וב־web.
 * - Native: expo-localization forcesRTL + I18nManager
 * - Web: document.dir=rtl (App.tsx)
 *
 * עם I18nManager.isRTL, textAlign:'left' = התחלה (ימין בעברית).
 * textAlign:'right' האבסולוטי הופך לשמאל — לכן rtlText משתמש ב־left.
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
