import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import type { SmartInsight, SmartTone } from '../utils/smartInsights';
import { colors, fonts, radii, spacing, type } from '../theme';

const TONE: Record<
  SmartTone,
  { border: string; bg: string; label: string; chip: string }
> = {
  tip: {
    border: 'rgba(139,155,255,0.35)',
    bg: 'rgba(139,155,255,0.10)',
    label: 'טיפ חכם',
    chip: colors.primary,
  },
  warn: {
    border: 'rgba(240,198,116,0.45)',
    bg: 'rgba(240,198,116,0.12)',
    label: 'שים לב',
    chip: colors.gold,
  },
  ok: {
    border: 'rgba(126,200,227,0.4)',
    bg: 'rgba(126,200,227,0.10)',
    label: 'מעולה',
    chip: colors.success,
  },
  action: {
    border: 'rgba(196,181,253,0.4)',
    bg: 'rgba(167,139,250,0.14)',
    label: 'הצעה',
    chip: colors.accent,
  },
};

export function SmartInsights({
  items,
  onAction,
  style,
}: {
  items: SmartInsight[];
  onAction?: (item: SmartInsight) => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (!items.length) return null;

  return (
    <View style={[styles.wrap, style]} accessibilityRole="summary">
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text style={styles.headTitle}>תובנות חכמות</Text>
      </View>
      {items.map((item) => {
        const tone = TONE[item.tone];
        return (
          <View
            key={item.id}
            style={[styles.card, { borderColor: tone.border, backgroundColor: tone.bg }]}
          >
            <Text style={[styles.badge, { color: tone.chip }]}>{tone.label}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            {item.actionLabel && item.actionKind && item.actionKind !== 'none' && onAction ? (
              <Pressable
                onPress={() => onAction(item)}
                style={({ pressed }) => [
                  styles.action,
                  { borderColor: tone.chip },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.actionLabel}
              >
                <Text style={[styles.actionTxt, { color: tone.chip }]}>{item.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  headTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.inkMuted,
    writingDirection: 'rtl',
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  badge: {
    fontFamily: fonts.semi,
    fontSize: 11,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  body: {
    ...type.bodySm,
    color: colors.inkSoft,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 20,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    writingDirection: 'rtl',
  },
});
