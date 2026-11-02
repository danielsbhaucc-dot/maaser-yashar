import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useA11y } from './AccessibilityContext';
import { nativeSaturationFilter, rootA11yStyle } from './effects';
import { rtlDomProps, DIR } from '../rtl';

/**
 * עוטף את תוכן האפליקציה ומחיל התאמות נגישות ברמת השורש.
 * ב־web רוב האפקטים (כולל גודל טקסט דרך zoom) מגיעים מ־CSS ב־effects.ts.
 * ב־native — scale על השורש כדי ש־fontSize בפיקסלים יגדל בפועל.
 */
export function AccessibilityRoot({ children }: { children: React.ReactNode }) {
  const { settings } = useA11y();

  // native: גווני אפור אמיתי דרך filter (Android, ארכיטקטורה חדשה). ב־iOS אין filter
  // לצבע — לא מזייפים בשקיפות; הפאנל מציג שהאפשרות זמינה רק ב־web/Android.
  const satStyle =
    Platform.OS === 'android' && settings.saturation !== 'off'
      ? ({ filter: nativeSaturationFilter(settings.saturation) } as object)
      : null;

  return (
    <View
      style={[styles.flex, DIR, rootA11yStyle(settings), satStyle]}
      {...rtlDomProps}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
