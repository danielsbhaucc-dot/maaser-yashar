import React from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, spacing } from '../theme';
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
  const scrollBody = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        sheet ? styles.sheetContent : styles.content,
        contentStyle,
      ]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      horizontal={false}
    >
      {children}
    </ScrollView>
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
        <View style={[styles.orb, styles.orbC]} />
      </View>
      <SafeAreaView style={styles.safe} edges={edges}>
        {sheet ? (
          <View style={styles.sheetRoot}>
            {hero ? <View style={styles.heroPad}>{hero}</View> : null}
            <View style={styles.sheet}>
              {scroll ? scrollBody : children}
            </View>
          </View>
        ) : scroll ? (
          scrollBody
        ) : (
          children
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
  content: {
    padding: spacing.lg,
    paddingBottom: 148,
    width: '100%',
    maxWidth: '100%',
  },
  sheetRoot: { flex: 1 },
  heroPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  /**
   * גיליון אטום מספיק + פינות עליונות גדולות.
   * חפיפה קלה על ה-hero כדי שהקשת תיראה בלי תפר חד.
   */
  sheet: {
    flex: 1,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: 'hidden',
    marginTop: -8,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  sheetContent: {
    padding: spacing.lg,
    paddingTop: spacing.lg + 6,
    paddingBottom: 148,
    width: '100%',
  },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.28 },
  orbA: {
    width: 280,
    height: 280,
    top: -60,
    end: -70,
    backgroundColor: colors.orbA,
  },
  orbB: {
    width: 220,
    height: 220,
    bottom: 160,
    start: -80,
    backgroundColor: colors.orbB,
  },
  orbC: {
    width: 170,
    height: 170,
    top: '40%',
    end: -50,
    backgroundColor: colors.orbC,
    opacity: 0.18,
  },
});
