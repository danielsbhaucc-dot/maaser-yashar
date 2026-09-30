import { useCallback, useMemo, useRef } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';
import { NATIVE_DRIVER } from '../utils/motion';

const SCREEN_H = Dimensions.get('window').height;

/** סף מרחק לסגירה בסגנון תגובות טיקטוק */
export const SHEET_DISMISS_Y = 88;
/** סף מהירות (dy/ms בערך מ־gesture) */
export const SHEET_DISMISS_V = 0.9;

type Options = {
  onDismiss: () => void;
  enabled?: boolean;
  /** כמה למתוח למעלה עם rubber-band */
  rubberBand?: number;
};

/**
 * גרירת מגירה כמו בתגובות טיקטוק: נצמד לאצבע, רקע דועך, זריקה בסגירה.
 */
export function useSheetSwipeDismiss({
  onDismiss,
  enabled = true,
  rubberBand = 0.16,
}: Options) {
  const translateY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const resetPosition = useCallback(() => {
    translateY.setValue(0);
    backdrop.setValue(0);
  }, [backdrop, translateY]);

  const animateIn = useCallback(() => {
    translateY.setValue(42);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: NATIVE_DRIVER,
        bounciness: 5,
        speed: 16,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 240,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]).start();
  }, [backdrop, translateY]);

  const dismiss = useCallback(
    (fromY = 0, velocity = 1.4) => {
      const remaining = Math.max(160, SCREEN_H * 0.55 - Math.max(0, fromY));
      const v = Math.max(0.9, Math.abs(velocity));
      const duration = Math.min(300, Math.max(150, remaining / (v * 1.15)));
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H * 0.72,
          duration,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: Math.max(120, duration - 30),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]).start(({ finished }) => {
        if (finished) onDismissRef.current();
      });
    },
    [backdrop, translateY]
  );

  const snapBack = useCallback(
    (velocity = 0) => {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          velocity: Math.min(0, -Math.abs(velocity) * 0.35),
          useNativeDriver: NATIVE_DRIVER,
          bounciness: 4,
          speed: 16,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 180,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]).start();
    },
    [backdrop, translateY]
  );

  const panHandlers = useMemo(() => {
    const pan = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (!enabledRef.current) return false;
        return g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1;
      },
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (!enabledRef.current) return false;
        return g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.35;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dy >= 0) {
          translateY.setValue(g.dy);
          const progress = Math.min(1, g.dy / (SCREEN_H * 0.38));
          backdrop.setValue(1 - progress * 0.88);
        } else {
          translateY.setValue(g.dy * rubberBand);
          backdrop.setValue(1);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > SHEET_DISMISS_Y || g.vy > SHEET_DISMISS_V) {
          dismiss(g.dy, g.vy || 1.2);
        } else {
          snapBack(g.vy);
        }
      },
      onPanResponderTerminate: (_, g) => {
        if (g.dy > SHEET_DISMISS_Y || g.vy > SHEET_DISMISS_V) {
          dismiss(g.dy, g.vy || 1.2);
        } else {
          snapBack(g.vy);
        }
      },
    });
    return pan.panHandlers;
  }, [backdrop, dismiss, rubberBand, snapBack, translateY]);

  return {
    translateY,
    backdrop,
    panHandlers,
    dismiss: () => dismiss(0, 1.5),
    animateIn,
    resetPosition,
  };
}
