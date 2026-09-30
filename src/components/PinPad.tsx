import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useMotionEnabled } from '../hooks/useMotionEnabled';

export const PIN_MIN = 4;
export const PIN_MAX = 6;

const KEYS: (string | 'back' | 'ok')[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['back', '0', 'ok'],
];

function digitsOnly(text: string, max = PIN_MAX) {
  return text.replace(/\D/g, '').slice(0, max);
}

type PinDotsProps = {
  length: number;
  max?: number;
  /** true = צבע שגיאה על הנקודות */
  error?: boolean;
  /** מספר עולה — מפעיל רעד בכל ניסיון שגוי */
  errorKey?: number;
  compact?: boolean;
};

export function PinDots({ length, max = PIN_MAX, error, errorKey = 0, compact }: PinDotsProps) {
  const motionOk = useMotionEnabled();
  const shake = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(1)).current;
  const prevLen = React.useRef(length);

  React.useEffect(() => {
    if (!errorKey || !motionOk) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 48, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 48, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 48, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 48, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 48, useNativeDriver: true }),
    ]).start();
  }, [errorKey, motionOk, shake]);

  React.useEffect(() => {
    if (length > prevLen.current && motionOk) {
      pulse.setValue(1.18);
      Animated.spring(pulse, {
        toValue: 1,
        friction: 5,
        tension: 160,
        useNativeDriver: true,
      }).start();
    }
    prevLen.current = length;
  }, [length, motionOk, pulse]);

  const translateX = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10],
  });

  const size = compact ? 12 : 14;
  const gap = compact ? 12 : 16;

  return (
    <Animated.View
      style={[
        styles.dotsRow,
        { gap, transform: [{ translateX }, { scale: pulse }] },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`הוזנו ${length} מתוך עד ${max} ספרות`}
      accessibilityLiveRegion="polite"
    >
      {Array.from({ length: max }, (_, i) => {
        const filled = i < length;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
              filled ? styles.dotFilled : styles.dotEmpty,
              error && filled ? styles.dotError : null,
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

type KeyProps = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
  accent?: boolean;
  compact?: boolean;
};

function PadKey({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  muted,
  accent,
  compact,
}: KeyProps) {
  const motionOk = useMotionEnabled();
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = (to: number) => {
    if (!motionOk) {
      scale.setValue(to);
      return;
    }
    Animated.spring(scale, {
      toValue: to,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const diameter = compact ? 64 : 76;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animateTo(0.92)}
      onPressOut={() => animateTo(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.keyHit, { width: diameter + 8, height: diameter + 8 }]}
    >
      <Animated.View
        style={[
          styles.keyFace,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            transform: [{ scale }],
            opacity: disabled ? 0.35 : 1,
          },
          muted && styles.keyMuted,
          accent && styles.keyAccent,
        ]}
      >
        <Text
          style={[
            styles.keyLabel,
            compact && styles.keyLabelCompact,
            muted && styles.keyLabelMuted,
            accent && styles.keyLabelAccent,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  /** נקרא כשלוחצים אישור (≥ min) או כשמגיעים ל־max */
  onSubmit?: (pin: string) => void;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
  error?: boolean;
  /** מספר עולה לרעד נקודות בכל כישלון */
  errorKey?: number;
  /** מציג מקש אישור — ברירת מחדל true */
  showConfirm?: boolean;
  /** שליחה אוטומטית כשמגיעים ל־maxLength */
  autoSubmitAtMax?: boolean;
  compact?: boolean;
  /** תווית לשדה הנסתר (מקלדת מערכת כמשנית) */
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function PinPad({
  value,
  onChange,
  onSubmit,
  minLength = PIN_MIN,
  maxLength = PIN_MAX,
  disabled,
  error,
  errorKey = 0,
  showConfirm = true,
  autoSubmitAtMax = true,
  compact,
  accessibilityLabel = 'קוד נעילה',
  style,
}: PinPadProps) {
  const inputRef = React.useRef<TextInput>(null);
  const submitting = React.useRef(false);

  const setDigits = React.useCallback(
    (next: string) => {
      const clean = digitsOnly(next, maxLength);
      onChange(clean);
      if (autoSubmitAtMax && onSubmit && clean.length === maxLength && !disabled) {
        if (submitting.current) return;
        submitting.current = true;
        onSubmit(clean);
        requestAnimationFrame(() => {
          submitting.current = false;
        });
      }
    },
    [autoSubmitAtMax, disabled, maxLength, onChange, onSubmit]
  );

  const pressDigit = (d: string) => {
    if (disabled || value.length >= maxLength) return;
    setDigits(value + d);
  };

  const pressBack = () => {
    if (disabled || !value.length) return;
    onChange(value.slice(0, -1));
  };

  const pressOk = () => {
    if (disabled || value.length < minLength || !onSubmit) return;
    onSubmit(value);
  };

  const canOk = !disabled && value.length >= minLength;

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessibilityRole="none"
        style={styles.dotsHit}
      >
        <PinDots
          length={value.length}
          max={maxLength}
          error={error}
          errorKey={errorKey}
          compact={compact}
        />
      </Pressable>

      {/* מקלדת מערכת כמשנית — מוסתרת ויזואלית, זמינה לנגישות / מקלדת חומרה */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={setDigits}
        onSubmitEditing={() => {
          if (canOk && onSubmit) onSubmit(value);
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        secureTextEntry
        maxLength={maxLength}
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel={`${accessibilityLabel}, 4 עד 6 ספרות`}
        accessibilityHint="אפשר גם להשתמש במקלדת המספרים שעל המסך"
        returnKeyType="done"
        editable={!disabled}
      />

      <View
        style={[styles.pad, compact && styles.padCompact]}
        accessibilityLabel="מקלדת מספרים לקוד נעילה"
      >
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((key) => {
              if (key === 'back') {
                return (
                  <PadKey
                    key="back"
                    label="⌫"
                    accessibilityLabel="מחיקת ספרה"
                    onPress={pressBack}
                    disabled={disabled || value.length === 0}
                    muted
                    compact={compact}
                  />
                );
              }
              if (key === 'ok') {
                if (!showConfirm) {
                  return <View key="ok-spacer" style={{ width: compact ? 72 : 84 }} />;
                }
                return (
                  <PadKey
                    key="ok"
                    label="✓"
                    accessibilityLabel="אישור קוד"
                    onPress={pressOk}
                    disabled={!canOk}
                    accent
                    compact={compact}
                  />
                );
              }
              return (
                <PadKey
                  key={key}
                  label={key}
                  accessibilityLabel={`ספרה ${key}`}
                  onPress={() => pressDigit(key)}
                  disabled={disabled || value.length >= maxLength}
                  compact={compact}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: '100%',
  },
  dotsHit: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  dot: {
    borderWidth: 1.5,
  },
  dotEmpty: {
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  dotError: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
    ...Platform.select({
      web: { outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  pad: {
    width: '100%',
    maxWidth: 320,
    gap: 6,
    alignItems: 'center',
  },
  padCompact: {
    maxWidth: 280,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  keyHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyFace: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      } as ViewStyle,
      default: {},
    }),
  },
  keyMuted: {
    backgroundColor: colors.surfaceMuted,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  keyAccent: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(139, 155, 255, 0.45)',
  },
  keyLabel: {
    fontFamily: fonts.num,
    fontSize: 28,
    color: colors.ink,
    textAlign: 'center',
    includeFontPadding: false,
  },
  keyLabelCompact: {
    fontSize: 24,
  },
  keyLabelMuted: {
    fontFamily: fonts.semi,
    fontSize: 22,
    color: colors.inkSoft,
  },
  keyLabelAccent: {
    color: colors.primary,
    fontSize: 26,
  },
});
