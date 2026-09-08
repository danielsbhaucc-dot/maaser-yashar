import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useA11y } from './AccessibilityContext';
import { rootA11yStyle } from './effects';

/**
 * עוטף את תוכן האפליקציה ומחיל התאמות נגישות ברמת השורש.
 * ב־web רוב האפקטים (כולל גודל טקסט דרך zoom) מגיעים מ־CSS.
 * ב־native — scale על השורש כדי ש־fontSize בפיקסלים יגדל בפועל.
 */
export function AccessibilityRoot({ children }: { children: React.ReactNode }) {
  const { settings } = useA11y();

  const satStyle =
    Platform.OS !== 'web'
      ? settings.saturation === 'low'
        ? { opacity: 0.92 }
        : settings.saturation === 'mono' || settings.saturation === 'grayscale'
          ? { opacity: 0.88 }
          : null
      : null;

  return (
    <View style={[styles.flex, rootA11yStyle(settings), satStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
