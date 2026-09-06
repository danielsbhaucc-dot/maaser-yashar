import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Platform,
  Text,
  Pressable,
  StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radii, shadow, fonts } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  gold?: boolean;
  /** @deprecated — נשאר תואם לאחור; ממופה לזכוכית כהה */
  light?: boolean;
  /** כרטיס זכוכית כהה */
  dark?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'none' | 'text' | 'summary' | 'header';
};

function resolveRadius(style?: StyleProp<ViewStyle>): number {
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const r = flat?.borderRadius;
  return typeof r === 'number' ? r : radii.xl;
}

export function Glass({
  children,
  style,
  strong,
  gold,
  light,
  dark,
  accessibilityLabel,
  accessibilityRole,
}: Props) {
  const elevated = dark || light;
  const useBlur = Platform.OS !== 'web';
  const radius = resolveRadius(style);
  const round = { borderRadius: radius } as ViewStyle;
  const webRoundClip =
    Platform.OS === 'web'
      ? ({ clipPath: `inset(0 round ${radius}px)` } as ViewStyle)
      : null;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[
        styles.wrap,
        round,
        strong && styles.wrapStrong,
        gold && styles.wrapGold,
        elevated && styles.wrapDark,
        elevated && gold && styles.wrapDarkGold,
        shadow.card,
        style,
        styles.clip,
        round,
        webRoundClip,
      ]}
    >
      {useBlur ? (
        <BlurView
          intensity={Platform.OS === 'ios' ? (strong ? 55 : 40) : strong ? 32 : 22}
          tint="systemChromeMaterialDark"
          style={[StyleSheet.absoluteFill, round, styles.clip]}
        />
      ) : null}
      {/* שכבת זכוכית — אותן פינות כמו המסגרת (לא מרובעת) */}
      <View
        pointerEvents="none"
        style={[
          styles.tint,
          round,
          styles.clip,
          webRoundClip,
          strong && styles.tintStrong,
          elevated && styles.tintDark,
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              } as ViewStyle)
            : null,
        ]}
      />
      <View
        style={[styles.shine, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function GlassCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityLabel="סגור"
      style={({ pressed }) => [styles.closeWrap, pressed && styles.closePressed]}
    >
      <Text style={styles.closeX}>✕</Text>
    </Pressable>
  );
}

export function GlassPill({
  children,
  style,
  gold,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gold?: boolean;
}) {
  return (
    <View style={[styles.pill, gold && styles.pillGold, styles.clip, style]}>
      <View style={styles.pillInner}>{children}</View>
    </View>
  );
}

export function GlassNumber({
  n,
  color,
  size = 36,
}: {
  n: number | string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.numCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          backgroundColor: `${color}28`,
        },
      ]}
    >
      <Text style={[styles.numText, { color, fontSize: size * 0.42 }]}>{n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  clip: {
    overflow: 'hidden',
  },
  wrapStrong: { backgroundColor: colors.glassStrong },
  wrapGold: { borderColor: colors.glassGoldBorder },
  wrapDark: {
    backgroundColor: colors.glassDark,
    borderColor: colors.glassDarkBorder,
  },
  wrapDarkGold: { borderColor: colors.glassGoldBorder },
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tintStrong: { backgroundColor: 'rgba(255,255,255,0.045)' },
  tintDark: { backgroundColor: 'rgba(167, 139, 250, 0.04)' },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
    zIndex: 2,
  },
  content: { position: 'relative', zIndex: 1 },
  closeWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.25)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  closePressed: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ scale: 0.96 }],
  },
  closeX: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
    lineHeight: 18,
    textAlign: 'center',
    includeFontPadding: false,
  },
  pill: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillGold: { borderColor: colors.glassGoldBorder },
  pillInner: { paddingHorizontal: 14, paddingVertical: 8 },
  numCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  numText: {
    fontFamily: fonts.extra,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
