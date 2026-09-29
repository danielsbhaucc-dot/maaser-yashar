import React, { useEffect, useRef } from 'react';
import { Pressable, Text, StyleSheet, View, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BOT_NAME } from '../utils/copy';
import { useNoamChat } from '../navigation/NoamChatContext';
import { useMotionEnabled } from '../hooks/useMotionEnabled';
import { NATIVE_DRIVER } from '../utils/motion';
import { colors, fonts } from '../theme';

/** כפתור נועם בכותרת — פועם עד פתיחה ראשונה של הצ'אט (N-17) */
export function NoamHeaderButton() {
  const { openChat, hasOpenedOnce } = useNoamChat();
  const motionOk = useMotionEnabled();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hasOpenedOnce || !motionOk) {
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
  }, [hasOpenedOnce, motionOk, pulse]);

  return (
    <Pressable
      onPress={openChat}
      accessibilityRole="button"
      accessibilityLabel={`פתח צ'אט עם ${BOT_NAME}`}
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.85 }]}
      hitSlop={2}
    >
      <Animated.View style={[styles.btn, { transform: [{ scale: pulse }] }]}>
        <LinearGradient
          colors={[...colors.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.grad}
        >
          <Text style={styles.letter}>נ</Text>
        </LinearGradient>
        <View
          style={[styles.dot, !hasOpenedOnce && styles.dotPulse]}
          accessibilityElementsHidden
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  grad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: fonts.displayExtra,
    fontSize: 18,
    color: '#fff',
  },
  dot: {
    position: 'absolute',
    end: 1,
    bottom: 1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  dotPulse: {
    backgroundColor: colors.gold,
  },
});
