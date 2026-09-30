import React, { useEffect, useId } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCloseButton } from './Glass';
import { colors, fonts, spacing, type } from '../theme';
import { DIR } from '../rtl';
import { dialogDomProps, useDialogFocus } from '../hooks/useDialogFocus';
import { useShellLayout } from '../hooks/useShellLayout';
import { useSheetSwipeDismiss } from '../hooks/useSheetSwipeDismiss';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

/** מגירת iOS בסגנון תגובות טיקטוק: ידית, גרירה עם האצבע, זריקה לסגירה */
export function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const shell = useShellLayout();
  const sheetMax = shell.mode === 'compact' ? 480 : shell.sheetMaxWidth;
  const centeredSheet = shell.isWeb && shell.mode !== 'compact';
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12) + 12;
  const reactId = useId().replace(/:/g, '');
  const dialogId = `maaser-sheet-${reactId}`;

  const { translateY, backdrop, panHandlers, dismiss, animateIn } = useSheetSwipeDismiss({
    onDismiss: onClose,
    enabled: !centeredSheet,
  });

  useDialogFocus({ open: visible, onClose: dismiss, dialogId });

  useEffect(() => {
    if (visible) animateIn();
  }, [visible, animateIn]);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismiss}>
      <View style={[styles.root, centeredSheet && styles.rootCentered, DIR]}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdrop.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="סגור"
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.sheetAnchor,
            centeredSheet && styles.sheetAnchorCentered,
            { maxWidth: sheetMax },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            nativeID={dialogId}
            {...dialogDomProps}
            style={[
              styles.sheet,
              centeredSheet && styles.sheetCentered,
              {
                transform: [{ translateY: centeredSheet ? 0 : translateY }],
                paddingBottom: safeBottom,
                maxWidth: sheetMax,
              },
            ]}
            accessibilityRole="summary"
            accessibilityViewIsModal
            accessibilityLabel={title || 'חלון'}
          >
            {!centeredSheet ? (
              <View
                style={styles.handleHit}
                accessibilityLabel="גרור לסגירה"
                {...panHandlers}
              >
                <View style={styles.handle} />
              </View>
            ) : (
              <View style={{ height: 12 }} />
            )}

            <View style={styles.head}>
              {title ? (
                <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                  {title}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <GlassCloseButton onPress={dismiss} />
            </View>

            <View style={styles.body}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rootCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheetAnchor: {
    maxHeight: '92%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  sheetAnchorCentered: {
    maxHeight: '88%',
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomWidth: 0,
    backgroundColor: colors.sheetSolid,
    maxHeight: '100%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        backgroundColor: colors.sheetSolidAlpha,
      } as object,
      default: {},
    }),
  },
  sheetCentered: {
    borderRadius: 28,
    borderBottomWidth: 1,
  },
  handleHit: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 36,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 12,
  },
  title: {
    ...type.h2,
    fontFamily: fonts.displayExtra,
    color: colors.ink,
    flex: 1,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: { userSelect: 'none', caretColor: 'transparent' } as object,
      default: {},
    }),
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
});
