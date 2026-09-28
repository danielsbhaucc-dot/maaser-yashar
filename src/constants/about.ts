import { Platform } from 'react-native';

export const ABOUT_LINK_LABEL = 'מי עומד מאחורי מעשר ישר';

export const ABOUT_PATH = '/about';

/** כתובת מלאה לדף האודות הסטטי */
export function aboutPageUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/about.html`;
  }
  return `https://maaser-yashar.netlify.app${ABOUT_PATH}`;
}
