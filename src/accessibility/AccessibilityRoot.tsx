import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useA11y } from './AccessibilityContext';
import { rootA11yStyle } from './effects';
import { rtlDomProps, DIR } from '../rtl';

/**
 * עוטף את תוכן האפליקציה ומחיל התאמות נגישות ברמת השורש.
 * ב־web רוב האפקטים (כולל גודל טקסט דרך zoom) מגיעים מ־CSS ב־effects.ts.
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

  const motionStyle =
    Platform.OS !== 'web' && (settings.stopAnimations || settings.reduceMotion)
      ? ({ cursor: undefined } as object)
      : null;

  return (
    <View
      style={[styles.flex, DIR, rootA11yStyle(settings), satStyle, motionStyle]}
      {...rtlDomProps}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
