import React from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, layout, radii, spacing } from '../theme';
import { DIR } from '../rtl';

type Props = {
  children: React.ReactNode;
  edges?: Edge[];
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'handled' | 'always' | 'never';
  /** hero + גיליון מעוגל כהה (iOS sheet) */
  sheet?: boolean;
  hero?: React.ReactNode;
};

export function Screen({
  children,
  edges = ['top'],
  scroll = false,
  contentStyle,
  keyboardShouldPersistTaps = 'handled',
  sheet = false,
  hero,
}: Props) {
  /**
   * גלילת עמוד שלם: hero + כרטיס מעוגל יחד —
   * לא ScrollView פנימי ש״כולא״ את התוכן בתוך הגיליון.
   */
  const page = sheet ? (
    <View style={styles.sheetRoot}>
      {hero ? <View style={styles.heroPad}>{hero}</View> : null}
      <View style={styles.sheet}>
        <View style={[styles.sheetInner, contentStyle]}>{children}</View>
      </View>
    </View>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.root, DIR]}>
      <View style={styles.bgLayer} pointerEvents="none">
        <LinearGradient
          colors={[...colors.gradient]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.orb, styles.orbA]} />
        <View style={[styles.orb, styles.orbB]} />
      </View>
      <SafeAreaView style={styles.safe} edges={edges}>
        {scroll ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={sheet ? styles.pageScroll : undefined}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bounces
            overScrollMode="never"
            horizontal={false}
          >
            {page}
          </ScrollView>
        ) : (
          page
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    width: '100%',
    maxWidth: '100%',
  },
  bgLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  safe: { flex: 1, width: '100%' },
  scroll: { flex: 1, width: '100%' },
  pageScroll: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: layout.contentBottomPad,
    width: '100%',
    maxWidth: '100%',
  },
  sheetRoot: {
    flexGrow: 1,
    width: '100%',
  },
  heroPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  /**
   * גיליון אטום + פינות עליונות — גובה לפי תוכן (לא flex קשיח עם scroll פנימי).
   */
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: 'hidden',
    marginTop: -8,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    minHeight: 320,
  },
  sheetInner: {
    padding: spacing.lg,
    paddingTop: spacing.lg + 6,
    paddingBottom: layout.contentBottomPad,
    width: '100%',
  },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.22 },
  orbA: {
    width: 220,
    height: 220,
    top: -70,
    end: -60,
    backgroundColor: colors.orbA,
  },
  orbB: {
    width: 160,
    height: 160,
    bottom: 200,
    start: -70,
    backgroundColor: colors.orbB,
    opacity: 0.16,
  },
});
