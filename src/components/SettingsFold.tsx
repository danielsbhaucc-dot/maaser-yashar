import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Glass } from './Glass';
import { colors, fonts, radii, spacing, type } from '../theme';
import { DIR } from '../rtl';
import { useMotionEnabled } from '../hooks/useMotionEnabled';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  title: string;
  hint?: string;
  children: React.ReactNode;
  /** פתוח בהתחלה (לא־מבוקר) */
  defaultOpen?: boolean;
  /** מצב מבוקר — כשמועבר, פתיחה/סגירה חיצונית */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  gold?: boolean;
  testID?: string;
};

/**
 * סקשן מתקפל להגדרות — מפחית עומס; רק כותרת גלויה עד לפתיחה.
 * כברירת מחדל סגור.
 */
export function SettingsFold({
  title,
  hint,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  gold,
  testID,
}: Props) {
  const controlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlled ? !!openProp : internalOpen;
  const motionOk = useMotionEnabled();

  const toggle = () => {
    if (motionOk) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    const next = !open;
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Glass light strong gold={gold} style={styles.wrap}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        testID={testID}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {hint && !open ? (
            <Text style={styles.hint} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.chevron, open && styles.chevronOpen]}>
          {open ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {open ? <View style={[styles.body, DIR]}>{children}</View> : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    borderRadius: radii.xxl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  headerText: { flex: 1, gap: 2 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.sheetInk,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  hint: {
    ...type.caption,
    color: colors.sheetMuted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chevron: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.sheetMuted,
    width: 22,
    textAlign: 'center',
  },
  chevronOpen: { color: colors.gold },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: spacing.md,
  },
});
