import { Platform } from 'react-native';

/** נוסח אחיד להצהרת פרטיות קצרה — מקור אמת יחיד לכל המסכים */

export const PRIVACY_SHORT =
  "הפנקס נשמר רק במכשיר שלך. אם תפתח את הצ'אט עם נועם, " +
  'ההודעה ונתוני החודש יישלחו לעיבוד בשירות חיצוני (OpenRouter).';

export const PRIVACY_LINK_LABEL = 'מה בדיוק נשמר ומה נשלח';

export const PRIVACY_PATH = '/privacy';

/** כתובת מלאה לדף הפרטיות הסטטי (עובד גם בלי JS באפליקציה) */
export function privacyPageUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // .html עובד גם ב־Expo מקומי; ב־Netlify גם /privacy מנותב לכאן
    return `${window.location.origin}/privacy.html`;
  }
  return `https://maaser-yashar.netlify.app${PRIVACY_PATH}`;
}
