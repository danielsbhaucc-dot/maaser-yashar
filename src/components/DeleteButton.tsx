import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
};

/** כפתור מחיקה עגול ומקצועי */
export function DeleteButton({
  onPress,
  size = 34,
  accessibilityLabel = 'מחק',
}: Props) {
  const icon = Math.round(size * 0.42);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View>
        <Svg width={icon} height={icon} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 7h16"
            stroke={colors.expense}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Path
            d="M10 3h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1Z"
            stroke={colors.expense}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Path
            d="M6.5 7l.8 12.2A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.8L17.5 7"
            stroke={colors.expense}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Line
            x1="10"
            y1="11"
            x2="10"
            y2="17"
            stroke={colors.expense}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Line
            x1="14"
            y1="11"
            x2="14"
            y2="17"
            stroke={colors.expense}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 168, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240, 168, 184, 0.35)',
  },
});
