import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';
import { DIR } from '../rtl';

export type TocItem = {
  id: string;
  label: string;
};

type Props = {
  items: TocItem[];
  /** מזהה פעיל (אופציונלי) — null = אין בחירה */
  activeId?: string | null;
  onSelect: (id: string) => void;
  title?: string;
};

/**
 * תוכן עניינים קומפקטי לסקשנים — כותרות קצרות עם סימון פעיל/סגור לתמיכה בקיפול.
 */
export function TableOfContents({
  items,
  activeId = null,
  onSelect,
  title = 'תוכן עניינים',
}: Props) {
  return (
    <View style={[styles.wrap, DIR]} accessibilityRole="summary" accessibilityLabel={title}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.list}>
        {items.map((item) => {
          const active = activeId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={[styles.row, active && styles.rowActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active, expanded: active }}
              accessibilityLabel={item.label}
            >
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    gap: 8,
  },
  title: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  list: {
    gap: 6,
  },
  row: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
  },
  rowActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(240,198,116,0.12)',
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.inkMuted,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  labelActive: {
    fontFamily: fonts.semi,
    color: colors.ink,
  },
});
