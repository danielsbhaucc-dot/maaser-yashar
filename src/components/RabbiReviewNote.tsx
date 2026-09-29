import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle, View, ViewStyle } from 'react-native';
import { RABBI_REVIEW, rabbiReviewLine } from '../constants/rabbiReview';
import { colors, fonts, spacing, type } from '../theme';

/**
 * מציג שורת סקירת רב:
 * — אחרי אישור: «נסקר על ידי הרב …»
 * — לפני אישור: סימון ברור שהסקירה עדיין בתהליך (T-62 / pre-deploy).
 */
export function RabbiReviewNote({
  style,
  textStyle,
}: {
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const line = rabbiReviewLine();
  const text =
    line ??
    (!RABBI_REVIEW.approved
      ? 'התוכן ההלכתי ממתין לסקירת רב — עדיין לא אושר להצגה כמאושר.'
      : null);
  if (!text) return null;
  return (
    <View style={[styles.wrap, style]} accessibilityRole="text">
      <Text
        style={[styles.text, !line && styles.pending, textStyle]}
        testID="rabbi-review-note"
      >
        {text}
      </Text>
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
  pending: {
    color: colors.inkSoft,
  },
});
