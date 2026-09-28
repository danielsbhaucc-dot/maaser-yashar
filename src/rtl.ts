import { FlexStyle, Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * RTL — אסטרטגיה לפי פלטפורמה (Expo 57 / RN-web 0.21)
 *
 * Web (react-native-web):
 *   I18nManager הוא mock — לא הופך left/right.
 *   חובה: dir="rtl" על View שורש (או lang), ואז textAlign:'start' / marginStart.
 *   אסור style.direction ב־StyleSheet (נזרק / לא תקף).
 *
 * Native:
 *   I18nManager.forceRTL(true) + textAlign:'start'/'left'.
 *   direction:'rtl' על קונטיינר עוזר לירושה.
 */

export const isWeb = Platform.OS === 'web';

/** props ל־View שורש / מסכים — מפעילים RTL בווב */
export const rtlDomProps: { dir?: 'rtl'; lang?: string } = isWeb
  ? { dir: 'rtl', lang: 'he' }
  : {};

/** רק ל־pager אופקי שצריך מתמטיקת LTR */
export const ltrDomProps: { dir?: 'ltr' } = isWeb ? { dir: 'ltr' } : {};

/**
 * סגנון כיוון ל־native בלבד.
 * בווב: ריק — משתמשים ב־rtlDomProps.
 */
export const DIR: ViewStyle = isWeb ? {} : { direction: 'rtl' };

export const rowDir = 'row' as const;
export const alignStart = 'flex-start' as const;
export const alignEnd = 'flex-end' as const;

/** טקסט עברי — start עובד גם ב־web (עם dir=rtl) וגם ב־native (עם I18nManager) */
export const rtlText: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'start',
};

export const rtlRow: FlexStyle = {
  flexDirection: rowDir,
  ...(isWeb ? {} : { direction: 'rtl' as const }),
};
