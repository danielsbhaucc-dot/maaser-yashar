import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';

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
};

/** טבעת התקדמות / מצב אין-חובה / חודש ריק */
export function ProgressRing({
  ring,
  size = 78,
  stroke = 5.5,
  color = colors.primary,
  trackColor = 'rgba(255,255,255,0.12)',
}: Props) {
  const pct =
    ring.kind === 'progress' ? Math.max(0, Math.min(100, ring.percent)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const center = size / 2;

  const main =
    ring.kind === 'progress'
      ? `${pct}%`
      : ring.kind === 'none'
        ? '—'
        : '—';
  const label =
    ring.kind === 'progress' ? 'ניתן' : ring.kind === 'none' ? 'אין חובה' : 'ריק';

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={
        ring.kind === 'progress'
          ? `${pct} אחוז ניתן`
          : ring.kind === 'none'
            ? 'אין חובה החודש'
            : 'חודש ריק'
      }
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
        {ring.kind === 'progress' ? (
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      <Text style={[styles.pct, ring.kind !== 'progress' && styles.pctMuted]}>{main}</Text>
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
  lbl: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 1,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
