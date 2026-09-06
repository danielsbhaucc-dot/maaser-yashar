import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useA11y } from './AccessibilityContext';
import { rootA11yStyle } from './effects';

/**
 * עוטף את תוכן האפליקציה ומחיל התאמות נגישות ברמת השורש (בעיקר native).
 * ב־web רוב האפקטים מגיעים מ־CSS מוזרק.
 */
export function AccessibilityRoot({ children }: { children: React.ReactNode }) {
  const { settings } = useA11y();

  return (
    <View
      style={[
        styles.flex,
        rootA11yStyle(settings),
        Platform.OS !== 'web' && settings.saturation === 'low'
          ? { opacity: 0.9 }
          : null,
        Platform.OS !== 'web' &&
        (settings.saturation === 'mono' || settings.saturation === 'grayscale')
          ? { opacity: 0.85 }
          : null,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
