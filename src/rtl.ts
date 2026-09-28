import { FlexStyle, Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * RTL — אסטרטגיה לפי פלטפורמה (Expo 57 / RN-web 0.21)
 *
 * Web:
 *   I18nManager = mock. חובה dir="rtl" על View שורש + textAlign:'start'.
 *
 * Native:
 *   rtlBootstrap.ts מפעיל I18nManager.forceRTL לפני הרינדור.
 *   DIR (direction:'rtl') על כל מעטפת שורש — ירושה עקבית גם בהרשמה.
 */

export const isWeb = Platform.OS === 'web';

/** props ל־View — מפעילים כיוון בווב דרך DOM */
export const rtlDomProps: { dir?: 'rtl'; lang?: string } = isWeb
  ? { dir: 'rtl', lang: 'he' }
  : {};

/** pager אופקי שצריך מתמטיקת LTR (web בלבד) */
export const ltrDomProps: { dir?: 'ltr' } = isWeb ? { dir: 'ltr' } : {};

/**
 * כיוון לייאאוט:
 * - Native: direction rtl על הקונטיינר (שורש האפליקציה + מסכים)
 * - Web: ריק — משתמשים ב־rtlDomProps (style.direction נדחה ב־StyleSheet)
 */
export const DIR: ViewStyle = isWeb ? {} : { direction: 'rtl' };

export const rowDir = 'row' as const;
export const alignStart = 'flex-start' as const;
export const alignEnd = 'flex-end' as const;

export const rtlText: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'start',
};

export const rtlRow: FlexStyle = {
  flexDirection: rowDir,
  ...DIR,
};
