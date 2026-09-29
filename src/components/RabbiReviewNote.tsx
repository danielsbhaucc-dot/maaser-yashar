import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle, View, ViewStyle } from 'react-native';
import { rabbiReviewLine } from '../constants/rabbiReview';
import { colors, fonts, spacing, type } from '../theme';

/**
 * מציג את שורת «נסקר על ידי הרב …» רק כש־RABBI_REVIEW.approved === true
 * ויש שם. בלי אישור — לא מציג כלום (T-62).
 */
export function RabbiReviewNote({
  style,
  textStyle,
}: {
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const line = rabbiReviewLine();
  if (!line) return null;
  return (
    <View style={[styles.wrap, style]} accessibilityRole="text">
      <Text style={[styles.text, textStyle]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  text: {
    ...type.caption,
    fontFamily: fonts.semi,
    color: colors.goldDeep,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 20,
  },
});
