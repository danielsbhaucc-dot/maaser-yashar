import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';

type Props = {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
};

/** טבעת התקדמות אמיתית בסגנון ההשראה */
export function ProgressRing({
  percent,
  size = 78,
  stroke = 5.5,
  color = colors.primary,
  trackColor = 'rgba(255,255,255,0.12)',
  label = 'ניתן',
}: Props) {
  const pct = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
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
      </Svg>
      <Text style={styles.pct}>{pct}%</Text>
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
  lbl: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: 1,
  },
});
