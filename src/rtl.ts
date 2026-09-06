import { FlexStyle, TextStyle, ViewStyle } from 'react-native';

/**
 * RTL יציב גם בנייד (Expo Go) — בלי להסתמך רק על I18nManager + restart.
 * עוטפים את השורש ב־direction: 'rtl' (ראה App / Screen).
 */
export const DIR: ViewStyle = { direction: 'rtl' };

/**
 * שורות אופקיות: עם direction:rtl מספיק 'row'.
 * (ב־web עם dir=rtl, וגם עם I18nManager, row-reverse גורם להיפוך כפול.)
 */
export const rowDir = 'row' as const;

/** יישור תוכן לתחילת השורה בעברית (ימין כש־direction=rtl) */
export const alignStart = 'flex-start' as const;
export const alignEnd = 'flex-end' as const;

export const rtlText: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'right',
};

export const rtlRow: FlexStyle = {
  flexDirection: rowDir,
  direction: 'rtl',
};
