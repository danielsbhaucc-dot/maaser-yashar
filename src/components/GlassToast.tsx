import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { colors, fonts, radii, spacing, type } from '../theme';

export type ToastTone = 'success' | 'error' | 'warn' | 'info';

export type ToastItem = {
  id: string;
  kind: 'toast' | 'confirm';
  title: string;
  message?: string;
  tone: ToastTone;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
};

const TONE = {
  success: {
    accent: colors.success,
    bg: 'rgba(126, 200, 227, 0.18)',
    border: 'rgba(126, 200, 227, 0.45)',
    icon: '✓',
  },
  error: {
    accent: colors.expense,
    bg: 'rgba(240, 168, 184, 0.20)',
    border: 'rgba(240, 168, 184, 0.50)',
    icon: '!',
  },
  warn: {
    accent: colors.gold,
    bg: 'rgba(240, 198, 116, 0.18)',
    border: 'rgba(240, 198, 116, 0.45)',
    icon: '✦',
  },
  info: {
    accent: colors.primary,
    bg: 'rgba(139, 155, 255, 0.20)',
    border: 'rgba(139, 155, 255, 0.45)',
    icon: 'i',
  },
} as const;

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const tone = TONE[item.tone];
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-18, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      {Platform.OS !== 'web' ? (
        <BlurView
          intensity={28}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius: radii.xl }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radii.xl,
              backgroundColor: 'rgba(18, 16, 42, 0.55)',
            } as object,
            Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                } as object)
              : null,
          ]}
        />
      )}

      <View style={styles.row}>
        <View style={[styles.iconWrap, { borderColor: tone.accent, backgroundColor: `${tone.accent}33` }]}>
          <Text style={[styles.icon, { color: tone.accent }]}>{tone.icon}</Text>
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{item.title}</Text>
          {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
        </View>
        {item.kind === 'toast' ? (
          <Pressable onPress={() => onDismiss(item.id)} hitSlop={10} style={styles.close}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {item.kind === 'confirm' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => item.onCancel?.()}
          >
            <Text style={styles.btnGhostTxt}>{item.cancelLabel ?? 'ביטול'}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.btn,
              styles.btnSolid,
              {
                backgroundColor: item.tone === 'error' ? 'rgba(240,168,184,0.55)' : 'rgba(139,155,255,0.55)',
                borderColor: tone.accent,
              },
            ]}
            onPress={() => item.onConfirm?.()}
          >
            <Text style={styles.btnSolidTxt}>{item.confirmLabel ?? 'אישור'}</Text>
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

export function GlassToastHost({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!items.length) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: Math.max(insets.top, 12) + 8 }]}
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: spacing.lg,
    gap: 10,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 12px 40px rgba(0,0,0,0.35)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 16,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    ...type.emphasis,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  message: {
    ...type.bodySm,
    color: colors.inkMuted,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 20,
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeTxt: { color: colors.inkSoft, fontSize: 12, fontFamily: fonts.bold },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  btn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  btnGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  btnGhostTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.inkMuted,
  },
  btnSolid: {},
  btnSolidTxt: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
});
