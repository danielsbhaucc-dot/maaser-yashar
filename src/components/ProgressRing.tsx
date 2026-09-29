import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { useMotionEnabled } from '../hooks/useMotionEnabled';

export type Ring =
  | { kind: 'empty' }
  | { kind: 'none' }
  | { kind: 'progress'; percent: number };

type Props = {
  ring: Ring;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  /** הצג ✔ כשהיתרה כוסתה */
  celebrate?: boolean;
  /** תווית קורא־מסך מלאה (למשל יתרה/חובה דינמיים). כשמועבר — מחליף את ברירת המחדל */
  accessibilityLabel?: string;
  /** כשההורה כבר מכריז — מסתירים את הטבעת מעץ הנגישות */
  accessibilityHidden?: boolean;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** טבעת התקדמות / מצב אין-חובה / חודש ריק */
export function ProgressRing({
  ring,
  size = 78,
  stroke = 5.5,
  color = colors.primary,
  trackColor = 'rgba(255,255,255,0.12)',
  celebrate = false,
  accessibilityLabel: a11yLabel,
  accessibilityHidden = false,
}: Props) {
  const motionOk = useMotionEnabled();
  const pct =
    ring.kind === 'progress' ? Math.max(0, Math.min(100, ring.percent)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  const anim = useRef(new Animated.Value(pct)).current;
  const check = useRef(new Animated.Value(celebrate ? 1 : 0)).current;

  useEffect(() => {
    if (!motionOk) {
      anim.setValue(pct);
      return;
    }
    Animated.timing(anim, {
      toValue: pct,
      duration: 360,
      useNativeDriver: false,
    }).start();
  }, [pct, anim, motionOk]);

  useEffect(() => {
    if (!celebrate) {
      check.setValue(0);
      return;
    }
    if (!motionOk) {
      check.setValue(1);
      return;
    }
    check.setValue(0);
    Animated.timing(check, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [celebrate, check, motionOk]);

  const offset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [c, 0],
  });

  const main =
    celebrate
      ? '✔'
      : ring.kind === 'progress'
        ? `${pct}%`
        : ring.kind === 'none'
          ? '—'
          : '—';
  const label =
    celebrate
      ? 'כוסה'
      : ring.kind === 'progress'
        ? 'ניתן'
        : ring.kind === 'none'
          ? 'אין חובה'
          : 'ריק';

  const defaultLabel = celebrate
    ? 'החודש כוסה'
    : ring.kind === 'progress'
      ? `${pct} אחוז ניתן`
      : ring.kind === 'none'
        ? 'אין חובה החודש'
        : 'חודש ריק';

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible={!accessibilityHidden}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityHidden ? undefined : a11yLabel ?? defaultLabel}
      accessibilityElementsHidden={accessibilityHidden}
      importantForAccessibility={accessibilityHidden ? 'no-hide-descendants' : 'yes'}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        {ring.kind === 'progress' || celebrate ? (
          <AnimatedCircle
            cx={center}
            cy={center}
            r={r}
            stroke={celebrate ? colors.success : color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={motionOk ? offset : c * (1 - pct / 100)}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      <Animated.View style={{ opacity: celebrate ? check : 1, transform: [{ scale: celebrate ? check.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) : 1 }] }}>
        <Text style={[styles.pct, ring.kind !== 'progress' && !celebrate && styles.pctMuted, celebrate && styles.pctOk]}>
          {main}
        </Text>
      </Animated.View>
      <Text style={styles.lbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pct: {
    fontFamily: fonts.numBold,
    fontSize: 17,
    color: '#fff',
    lineHeight: 20,
  },
  pctMuted: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.inkSoft,
  },
  pctOk: {
    color: colors.success,
    fontSize: 22,
  },
  lbl: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 1,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
