import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useMotionEnabled } from '../hooks/useMotionEnabled';
import { fonts } from '../theme';

function formatN(n: number) {
  return `₪${Math.round(n).toLocaleString('he-IL')}`;
}

/** מספר שמשתנה בהדרגה — מכבד reduce-motion, <400ms */
export function AnimatedMoney({
  value,
  style,
  accessibilityLabel,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const motionOk = useMotionEnabled();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!motionOk || fromRef.current === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const to = value;
    const start = Date.now();
    const dur = 360;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, motionOk]);

  return (
    <Text
      style={[styles.base, style]}
      accessibilityLabel={accessibilityLabel ?? formatN(Math.round(display))}
    >
      {formatN(display)}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.numBold,
    fontVariant: ['tabular-nums'],
  },
});
