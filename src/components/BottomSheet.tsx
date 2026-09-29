import React, { useCallback, useEffect, useId, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCloseButton } from './Glass';
import { colors, fonts, spacing, type } from '../theme';
import { DIR } from '../rtl';
import { NATIVE_DRIVER } from '../utils/motion';
import { dialogDomProps, useDialogFocus } from '../hooks/useDialogFocus';
import { useShellLayout } from '../hooks/useShellLayout';

const SCREEN_H = Dimensions.get('window').height;
const DISMISS_Y = 110;
const DISMISS_V = 1.15;

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

/** מגירת iOS: ידית, גרירה למטה, איקס זכוכית */
export function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const shell = useShellLayout();
  const sheetMax = shell.mode === 'compact' ? 480 : shell.sheetMaxWidth;
  const centeredSheet = shell.isWeb && shell.mode !== 'compact';
  const translateY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12) + 12;
  const reactId = useId().replace(/:/g, '');
  const dialogId = `maaser-sheet-${reactId}`;

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_H * 0.55,
        duration: 220,
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 200,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [backdrop, onClose, translateY]);

  useDialogFocus({ open: visible, onClose: dismiss, dialogId });

  useEffect(() => {
    if (visible) {
      translateY.setValue(40);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: NATIVE_DRIVER,
          bounciness: 4,
          speed: 14,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [visible, translateY, backdrop]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_Y || g.vy > DISMISS_V) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: NATIVE_DRIVER,
            bounciness: 3,
          }).start();
        }
      },
    })
  ).current;

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
            {...(centeredSheet ? {} : pan.panHandlers)}
            accessibilityRole="summary"
            accessibilityViewIsModal
            accessibilityLabel={title || 'חלון'}
          >
            {!centeredSheet ? (
              <View style={styles.handleHit} accessibilityLabel="גרור לסגירה">
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
    backgroundColor: '#141B30',
    maxHeight: '100%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        backgroundColor: 'rgba(20, 27, 48, 0.94)',
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
    paddingBottom: 6,
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
    color: '#fff',
    flex: 1,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: { userSelect: 'none' } as object,
      default: {},
    }),
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
});
