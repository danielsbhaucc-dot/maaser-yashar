import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BOT_NAME } from '../utils/copy';
import { useNoamChat } from '../navigation/NoamChatContext';
import { colors, fonts } from '../theme';

/** כפתור נועם בכותרת — פותח צ'אט בלי בועה צפה */
export function NoamHeaderButton() {
  const { openChat } = useNoamChat();
  return (
    <Pressable
      onPress={openChat}
      accessibilityRole="button"
      accessibilityLabel={`פתח צ'אט עם ${BOT_NAME}`}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
      hitSlop={8}
    >
      <LinearGradient
        colors={[...colors.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.grad}
      >
        <Text style={styles.letter}>נ</Text>
      </LinearGradient>
      <View style={styles.dot} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
