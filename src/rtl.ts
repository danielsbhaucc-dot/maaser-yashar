import { FlexStyle, Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * RTL אחיד ב־Native וב־Web — בלי היפוך כפול.
 *
 * Native: I18nManager.isRTL=true → textAlign:'left' = start (ימין),
 *         flex-start מימין. DIR מוסיף direction לקונטיינרים.
 *
 * Web: I18nManager.forceRTL כבר הופך left/start ו־flex.
 *      אסור גם לשים style.direction:'rtl' / body.direction — זה היפוך כפול
 *      (מסכים נראים LTR). נשענים על I18nManager + document.documentElement.dir.
 */
export const DIR: ViewStyle =
  Platform.OS === 'web' ? {} : { direction: 'rtl' };

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
  ...(Platform.OS === 'web' ? {} : { direction: 'rtl' as const }),
};
