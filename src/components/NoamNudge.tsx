import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BOT_NAME } from '../utils/copy';
import { colors, fonts, radii, spacing, type } from '../theme';

/** כרטיס ליווי קטן — נועם מדבר בשורה אחת; אופציונלית הסתרה */
export function NoamNudge({
  text,
  style,
  onDismiss,
}: {
  text: string;
  style?: StyleProp<ViewStyle>;
  onDismiss?: () => void;
}) {
  return (
    <View style={[styles.wrap, style]} accessibilityLabel={`${BOT_NAME}: ${text}`}>
      <LinearGradient
        colors={['rgba(139,155,255,0.22)', 'rgba(240,198,116,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.grad}
      >
        <View style={styles.avatar}>
          <Text style={styles.letter}>נ</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>{BOT_NAME}</Text>
          <Text style={styles.text}>{text}</Text>
        </View>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`הסתר כרטיס ${BOT_NAME}`}
            style={styles.dismiss}
          >
            <Text style={styles.dismissTxt}>×</Text>
          </Pressable>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.md,
  },
  grad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: fonts.displayExtra,
    fontSize: 16,
    color: colors.ink,
  },
  body: { flex: 1, gap: 2, minWidth: 0 },
  name: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.gold,
  },
  text: {
    ...type.bodySm,
    color: colors.inkMuted,
    textAlign: 'start',
    writingDirection: 'rtl',
    lineHeight: 20,
  },
  dismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dismissTxt: {
    fontSize: 18,
    color: colors.inkSoft,
    lineHeight: 20,
  },
});
