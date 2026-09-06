import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ViewStyle,
  Platform,
  StyleProp,
} from 'react-native';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';
import { DIR } from '../rtl';
import { Glass } from './Glass';

export function formatMoney(value: number): string {
  return `${value.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₪`;
}

export function parseMoney(text: string): number {
  const cleaned = text.replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function Card({
  children,
  style,
  padded = true,
  light,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  light?: boolean;
}) {
  return (
    <Glass light={light} style={[padded && styles.cardPad, style]}>
      {children}
    </Glass>
  );
}

export function ScreenTitle({
  title,
  subtitle,
  light,
}: {
  title: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <View style={styles.screenTitleWrap}>
      <Text style={[styles.screenTitle, light && styles.inkDark]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.screenSub, light && styles.inkMutedDark]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value === 0 ? '' : String(value)}
        onChangeText={(t) => onChange(parseMoney(t))}
        placeholder="0"
        placeholderTextColor={colors.inkSoft}
        textAlign="center"
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  fill,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** רוחב שווה בשורה מפולגת */
  fill?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, fill && styles.chipFill, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** שורת בחירה מפולגת וממורכזת בסגנון iOS */
export function SegmentedRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.segmentRow}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryBtn, shadow.float, disabled && { opacity: 0.45 }]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export function Banner({
  text,
  tone = 'info',
  light,
}: {
  text: string;
  tone?: 'info' | 'warn' | 'ok';
  light?: boolean;
}) {
  const accent =
    tone === 'warn' ? colors.danger : tone === 'ok' ? colors.success : colors.gold;
  const bg =
    tone === 'warn'
      ? colors.dangerSoft
      : tone === 'ok'
        ? colors.successSoft
        : colors.accentSoft;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: bg, borderColor: `${accent}55` },
        light && styles.bannerLight,
      ]}
    >
      <View style={[styles.bannerBar, { backgroundColor: accent }]} />
      <Text style={[styles.bannerText, light && styles.bannerTextLight]}>✦  {text}</Text>
    </View>
  );
}

export function StatHero({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Glass dark gold style={styles.statHero}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </Glass>
  );
}

export function SectionHeader({
  title,
  light: _light,
}: {
  title: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardPad: { padding: spacing.md },
  screenTitleWrap: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  screenTitle: {
    ...type.h1,
    color: colors.ink,
    textAlign: 'center',
  },
  screenSub: {
    ...type.bodySm,
    color: colors.inkSoft,
    marginTop: 6,
    textAlign: 'center',
  },
  inkDark: { color: colors.sheetInk },
  inkMutedDark: { color: colors.sheetMuted },
  field: { marginBottom: spacing.md, alignItems: 'center' },
  label: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.goldDeep,
    marginBottom: 6,
    textAlign: 'center',
    width: '100%',
  },
  hint: {
    ...type.caption,
    fontFamily: fonts.regular,
    color: colors.sheetMuted,
    marginBottom: 6,
    textAlign: 'center',
    width: '100%',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontFamily: fonts.num,
    fontSize: 18,
    color: colors.sheetInk,
    writingDirection: 'rtl',
    textAlign: 'center',
    width: '100%',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginEnd: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipFill: {
    flex: 1,
    marginEnd: 0,
    marginBottom: 0,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...type.caption,
    fontFamily: fonts.semi,
    color: colors.sheetInk,
    textAlign: 'center',
  },
  chipTextSelected: { color: colors.primaryOn, fontFamily: fonts.bold },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 155, 255, 0.82)',
    borderRadius: radii.lg,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  primaryBtnText: {
    ...type.button,
    color: colors.ink,
  },
  banner: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingEnd: spacing.md,
    paddingStart: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    minHeight: 20,
  },
  bannerText: {
    ...type.bodySm,
    fontFamily: fonts.medium,
    color: colors.ink,
    flex: 1,
  },
  bannerLight: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerTextLight: {
    color: colors.sheetInk,
  },
  statHero: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  statLabel: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.gold,
    textAlign: 'center',
  },
  statValue: {
    ...type.moneyHero,
    fontSize: 34,
    color: colors.ink,
    marginTop: 4,
    textAlign: 'center',
  },
  statHint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionHead: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...DIR,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  sectionTitle: {
    ...type.eyebrow,
    color: colors.gold,
    textAlign: 'center',
  },
});
