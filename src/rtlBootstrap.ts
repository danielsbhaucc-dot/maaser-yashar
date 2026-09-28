/**
 * RTL native — חייב לרוץ לפני כל מסך (מיובא מ־index.ts).
 * בווב I18nManager הוא mock; שם משתמשים ב־dir="rtl" (ראה rtl.ts / App.tsx).
 */
import { I18nManager, Platform } from 'react-native';

if (Platform.OS !== 'web') {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
      I18nManager.swapLeftAndRightInRTL(true);
    }
  } catch {
    // Expo Go / סביבות בלי native RTL prefs
  }
}

export function isNativeRtlActive(): boolean {
  if (Platform.OS === 'web') return true; // מטופל ב־dir
  return I18nManager.isRTL === true;
}
