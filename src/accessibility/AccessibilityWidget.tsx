import React, { Suspense, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useA11y } from './AccessibilityContext';
import { colors, fonts, shadow } from '../theme';
import {
  PageStructureModal,
  ReadingGuideOverlay,
  ReadingMaskOverlay,
  ClickToSpeakOverlay,
  ScreenReaderHintsOverlay,
} from './Overlays';

const AccessibilityPanel = React.lazy(() => import('./AccessibilityPanel'));

/** אייקון נגישות גיאומטרי — בלי אימוג'י */
function A11yMark({ size = 22, color = colors.ink }: { size?: number; color?: string }) {
  const arm = size * 0.22;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: size,
          backgroundColor: color,
          marginBottom: size * 0.06,
        }}
      />
      <View
        style={{
          width: size * 0.55,
          height: size * 0.12,
          borderRadius: 4,
          backgroundColor: color,
          marginBottom: size * 0.04,
        }}
      />
      <View style={{ flexDirection: 'row', gap: arm * 0.35, alignItems: 'flex-end' }}>
        <View
          style={{
            width: size * 0.12,
            height: size * 0.32,
            borderRadius: 3,
            backgroundColor: color,
            transform: [{ rotate: '-12deg' }],
          }}
        />
        <View
          style={{
            width: size * 0.12,
            height: size * 0.32,
            borderRadius: 3,
            backgroundColor: color,
            transform: [{ rotate: '12deg' }],
          }}
        />
      </View>
    </View>
  );
}

function PanelFallback() {
  return (
    <View style={styles.panelFallback} pointerEvents="none">
      <ActivityIndicator color={colors.gold} />
    </View>
  );
}

/**
 * כפתור נגישות + overlays תמיד בבאנדל הראשי.
 * תוכן הפאנל נטען ב־lazy רק אחרי פתיחה ראשונה.
 */
export function AccessibilityWidget() {
  const a11y = useA11y();
  const { settings } = a11y;
  const insets = useSafeAreaInsets();
  const [panelArmed, setPanelArmed] = useState(false);

  useEffect(() => {
    if (settings.panelOpen) setPanelArmed(true);
  }, [settings.panelOpen]);

  const openOrClose = useCallback(() => {
    if (settings.panelOpen) a11y.closePanel();
    else {
      setPanelArmed(true);
      a11y.openPanel();
    }
  }, [a11y, settings.panelOpen]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A' || e.key === 'ש')) {
        e.preventDefault();
        if (settings.panelOpen) a11y.closePanel();
        else {
          setPanelArmed(true);
          a11y.openPanel();
        }
      }
      if (e.key === 'Escape' && settings.panelOpen) a11y.closePanel();
      if (e.altKey && (e.key === 'r' || e.key === 'R' || e.key === 'ר')) {
        e.preventDefault();
        a11y.resetAll();
      }
      if (e.altKey && (e.key === 'h' || e.key === 'H' || e.key === 'י')) {
        e.preventDefault();
        if (settings.widgetHidden) {
          a11y.showWidget();
          setPanelArmed(true);
          a11y.openPanel();
        } else a11y.hideWidget();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.panelOpen, settings.widgetHidden, a11y]);

  const fabBottom =
    (Platform.OS === 'ios' ? 22 : 12) + 64 + Math.max(insets.bottom - 8, 0) + 10;

  return (
    <>
      <ReadingGuideOverlay />
      <ReadingMaskOverlay />
      <ClickToSpeakOverlay />
      <ScreenReaderHintsOverlay />
      <PageStructureModal />

      {settings.widgetHidden ? (
        <Pressable
          onPress={() => {
            a11y.showWidget();
            setPanelArmed(true);
            a11y.openPanel();
          }}
          style={[styles.restoreBar, { bottom: fabBottom }]}
          accessibilityLabel="הצג כפתור נגישות"
          accessibilityRole="button"
        >
          <A11yMark size={16} color={colors.gold} />
          <Text style={styles.restoreTxt}>נגישות</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={openOrClose}
          style={[styles.fab, { bottom: fabBottom }, a11y.active && styles.fabActive]}
          accessibilityLabel="פתח תפריט נגישות"
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[...colors.primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGrad}
          >
            <A11yMark size={24} color={colors.ink} />
          </LinearGradient>
          {a11y.active ? (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeTxt}>✓</Text>
            </View>
          ) : null}
        </Pressable>
      )}

      {panelArmed ? (
        <Suspense fallback={settings.panelOpen ? <PanelFallback /> : null}>
          <AccessibilityPanel />
        </Suspense>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    start: 14,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    zIndex: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(79, 95, 217, 0.45)' } as object,
      default: { ...shadow.fab },
    }),
  },
  fabGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabActive: { borderColor: colors.gold },
  fabBadge: {
    position: 'absolute',
    top: -2,
    end: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.bg,
  },
  fabBadgeTxt: { fontSize: 13, color: colors.primaryOn, fontFamily: fonts.bold },
  restoreBar: {
    position: 'absolute',
    start: 14,
    zIndex: 80,
    backgroundColor: colors.surfaceSolid,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassGoldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(0,0,0,0.35)' } as object,
      default: { ...shadow.soft },
    }),
  },
  restoreTxt: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  panelFallback: {
    ...StyleSheet.absoluteFill,
    zIndex: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12, 16, 32, 0.35)',
  },
});
