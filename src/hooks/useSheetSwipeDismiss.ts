import { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  type GestureResponderHandlers,
} from 'react-native';
import { NATIVE_DRIVER } from '../utils/motion';

const SCREEN_H = () => Dimensions.get('window').height;

/** סף מרחק לסגירה בסגנון תגובות טיקטוק */
export const SHEET_DISMISS_Y = 96;
/** סף מהירות (dy/ms בערך מ־gesture) */
export const SHEET_DISMISS_V = 0.85;
/** סף הרחבה כלפי מעלה */
export const SHEET_EXPAND_Y = -48;

type Options = {
  onDismiss: () => void;
  enabled?: boolean;
  /** כמה למתוח למעלה עם rubber-band */
  rubberBand?: number;
  /** כשגוררים למעלה מעבר לסף — למשל הרחבת מגירה */
  onExpand?: () => void;
  /** כשגוררים למטה מעט בלי סגירה — למשל הקטנה ממצב מורחב */
  onCollapse?: () => void;
  /** האם מצב מורחב כרגע (משפיע על snap) */
  expanded?: boolean;
};

/**
 * גרירת מגירה כמו בתגובות טיקטוק: נצמד לאצבע (למעלה ולמטה),
 * רקע דועך, spring בחזרה, זריקה לסגירה.
 */
export function useSheetSwipeDismiss({
  onDismiss,
  enabled = true,
  rubberBand = 0.22,
  onExpand,
  onCollapse,
  expanded = true,
}: Options) {
  const translateY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const onExpandRef = useRef(onExpand);
  onExpandRef.current = onExpand;
  const onCollapseRef = useRef(onCollapse);
  onCollapseRef.current = onCollapse;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const dragStartY = useRef(0);

  const resetPosition = useCallback(() => {
    translateY.setValue(0);
    backdrop.setValue(0);
  }, [backdrop, translateY]);

  const animateIn = useCallback(() => {
    const h = SCREEN_H();
    translateY.setValue(Math.min(72, h * 0.08));
    backdrop.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: NATIVE_DRIVER,
        bounciness: 4,
        speed: 18,
        velocity: -1.2,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]).start();
  }, [backdrop, translateY]);

  const dismiss = useCallback(
    (fromY = 0, velocity = 1.4) => {
      const h = SCREEN_H();
      const remaining = Math.max(160, h * 0.55 - Math.max(0, fromY));
      const v = Math.max(0.9, Math.abs(velocity));
      const duration = Math.min(280, Math.max(140, remaining / (v * 1.25)));
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: h * 0.78,
          duration,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: Math.max(110, duration - 25),
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
          velocity: Math.min(0, -Math.abs(velocity) * 0.4),
          useNativeDriver: NATIVE_DRIVER,
          bounciness: 3,
          speed: 18,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 160,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]).start();
    },
    [backdrop, translateY]
  );

  const applyDrag = useCallback(
    (dy: number) => {
      if (dy >= 0) {
        translateY.setValue(dy);
        const progress = Math.min(1, dy / (SCREEN_H() * 0.36));
        backdrop.setValue(1 - progress * 0.9);
      } else {
        // מתיחה קלה למעלה (rubber-band) גם כשכבר מורחב
        translateY.setValue(dy * rubberBand);
        backdrop.setValue(1);
      }
    },
    [backdrop, rubberBand, translateY]
  );

  const releaseDrag = useCallback(
    (dy: number, vy: number) => {
      const goingDown = dy > 0 || vy > 0.15;
      const flingDown = vy > SHEET_DISMISS_V;
      const flingUp = vy < -SHEET_DISMISS_V;
      const pullDownFar = dy > SHEET_DISMISS_Y;
      const pullUpFar = dy < SHEET_EXPAND_Y;

      if (flingDown || pullDownFar) {
        if (
          expandedRef.current &&
          onCollapseRef.current &&
          dy < SHEET_DISMISS_Y * 1.65 &&
          !flingDown
        ) {
          // משיכה קצרה במצב מורחב → הקטנה במקום סגירה מיידית
          onCollapseRef.current();
          snapBack(vy);
          return;
        }
        dismiss(Math.max(0, dy), Math.abs(vy) || 1.2);
        return;
      }

      if ((flingUp || pullUpFar) && !expandedRef.current) {
        onExpandRef.current?.();
        snapBack(vy);
        return;
      }

      if (goingDown && expandedRef.current && dy > 36 && onCollapseRef.current) {
        onCollapseRef.current();
      } else if (!goingDown && !expandedRef.current && dy < -20 && onExpandRef.current) {
        onExpandRef.current();
      }
      snapBack(vy);
    },
    [dismiss, snapBack]
  );

  const panHandlers = useMemo((): GestureResponderHandlers => {
    const pan = PanResponder.create({
      // web: חייבים לתפוס כבר ב־start — אחרת הסкроול/דפדפן גונבים את המחווה
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        if (!enabledRef.current) return false;
        return Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 0.85;
      },
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (!enabledRef.current) return false;
        return Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.15;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStartY.current = 0;
        translateY.stopAnimation((v) => {
          dragStartY.current = typeof v === 'number' ? v : 0;
        });
      },
      onPanResponderMove: (_, g) => {
        applyDrag(dragStartY.current + g.dy);
      },
      onPanResponderRelease: (_, g) => {
        releaseDrag(dragStartY.current + g.dy, g.vy);
      },
      onPanResponderTerminate: (_, g) => {
        releaseDrag(dragStartY.current + g.dy, g.vy);
      },
    });
    return pan.panHandlers;
  }, [applyDrag, releaseDrag, translateY]);

  return {
    translateY,
    backdrop,
    panHandlers,
    dismiss: () => dismiss(0, 1.5),
    animateIn,
    resetPosition,
  };
}
