import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOT_NAME } from '../utils/copy';
import { useNoamChat } from '../navigation/NoamChatContext';
import { useMotionEnabled } from '../hooks/useMotionEnabled';
import { NATIVE_DRIVER } from '../utils/motion';
import { colors, fonts, shadow } from '../theme';

/** בועת שיחה גיאומטרית — ברורה יותר מאות בלבד */
function ChatBubbleMark({ size = 26, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size * 0.92, alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: size * 0.68,
          borderRadius: size * 0.28,
          borderWidth: 2.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          marginStart: size * 0.18,
          borderLeftWidth: size * 0.12,
          borderRightWidth: size * 0.12,
          borderTopWidth: size * 0.2,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
          alignSelf: 'flex-start',
        }}
      />
    </View>
  );
}

/**
 * כפתור נועם צף — בועת שיחה, מעל הטאב־בר בצד הנגדי לנגישות.
 */
export function NoamHeaderButton() {
  const { openChat, hasOpenedOnce, open } = useNoamChat();
  const motionOk = useMotionEnabled();
  const pulse = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (hasOpenedOnce || !motionOk || open) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasOpenedOnce, motionOk, open, pulse]);

  if (open) return null;

  const fabBottom =
    (Platform.OS === 'ios' ? 22 : 12) + 64 + Math.max(insets.bottom - 8, 0) + 10;

  return (
    <Pressable
      onPress={openChat}
      testID="noam-header-btn"
      accessibilityRole="button"
      accessibilityLabel={`פתח צ'אט עם ${BOT_NAME}`}
      style={({ pressed }) => [
        styles.fab,
        { bottom: fabBottom },
        pressed && { opacity: 0.9 },
      ]}
      hitSlop={4}
    >
      <Animated.View style={[styles.btn, { transform: [{ scale: pulse }] }]}>
        <LinearGradient
          colors={[...colors.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.grad}
        >
          <ChatBubbleMark size={26} color="#fff" />
        </LinearGradient>
        <View
          style={[styles.dot, !hasOpenedOnce && styles.dotPulse]}
          accessibilityElementsHidden
        />
      </Animated.View>
      <Text style={styles.caption} numberOfLines={1}>
        {BOT_NAME}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    end: 14,
    zIndex: 80,
    alignItems: 'center',
    gap: 4,
  },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(79, 95, 217, 0.45)' } as object,
      default: { ...shadow.fab },
    }),
  },
  grad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontFamily: fonts.semi,
    fontSize: 11,
    color: colors.gold,
    textAlign: 'center',
    maxWidth: 64,
  },
  dot: {
    position: 'absolute',
    end: 2,
    bottom: 2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  dotPulse: {
    backgroundColor: colors.gold,
  },
});
