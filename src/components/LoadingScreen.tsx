import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radii, spacing } from '../theme';
import { DIR } from '../rtl';
import { useMotionEnabled } from '../hooks/useMotionEnabled';

type Variant = 'boot' | 'app' | 'overlay';

type Props = {
  /** כותרת מתחת ללוגו */
  message?: string;
  /** boot = טעינת פונטים / app = נתונים / overlay = מעל מסך */
  variant?: Variant;
  /** כפיית כיבוי אנימציה (למשל מבדיקות) */
  animate?: boolean;
};

/**
 * מסך טעינה ממותג — אורבים, כוכב זהב, פס התקדמות.
 * מכבד stopAnimations / reduceMotion מתפריט הנגישות.
 */
export function LoadingScreen({
  message = 'טוען…',
  variant = 'boot',
  animate,
}: Props) {
  const motionOk = useMotionEnabled();
  const run = animate ?? motionOk;
  /** לפני טעינת פונטים — בלי משפחות מותאמות */
  const systemFonts = variant === 'boot';

  const orbA = useRef(new Animated.Value(0)).current;
  const orbB = useRef(new Animated.Value(0)).current;
  const orbC = useRef(new Animated.Value(0)).current;
  const starScale = useRef(new Animated.Value(run ? 0.86 : 1)).current;
  const starGlow = useRef(new Animated.Value(run ? 0.35 : 0.7)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(run ? 0 : 1)).current;
  const bar = useRef(new Animated.Value(run ? 0.12 : 0.55)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!run) {
      fadeIn.setValue(1);
      starScale.setValue(1);
      starGlow.setValue(0.7);
      bar.setValue(0.55);
      return;
    }

    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();

    const breathe = (v: Animated.Value, duration: number, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
          Animated.timing(v, {
            toValue: 0,
            duration,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
        ])
      );

    const starPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(starScale, {
            toValue: 1.08,
            duration: 1100,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(starGlow, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ]),
        Animated.parallel([
          Animated.timing(starScale, {
            toValue: 0.94,
            duration: 1100,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(starGlow, {
            toValue: 0.4,
            duration: 1100,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ]),
      ])
    );

    const spin = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );

    const progress = Animated.loop(
      Animated.sequence([
        Animated.timing(bar, {
          toValue: 0.88,
          duration: 1600,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.cubic),
        }),
        Animated.timing(bar, {
          toValue: 0.22,
          duration: 1200,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.cubic),
        }),
      ])
    );

    const shine = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      })
    );

    const a = breathe(orbA, 4200);
    const b = breathe(orbB, 5200, 400);
    const c = breathe(orbC, 4800, 200);
    a.start();
    b.start();
    c.start();
    starPulse.start();
    spin.start();
    progress.start();
    shine.start();

    return () => {
      a.stop();
      b.stop();
      c.stop();
      starPulse.stop();
      spin.stop();
      progress.stop();
      shine.stop();
    };
  }, [run, orbA, orbB, orbC, starScale, starGlow, ring, fadeIn, bar, shimmer]);

  const orbDrift = (v: Animated.Value, dx: number, dy: number) => ({
    transform: [
      {
        translateX: v.interpolate({
          inputRange: [0, 1],
          outputRange: [-dx, dx],
        }),
      },
      {
        translateY: v.interpolate({
          inputRange: [0, 1],
          outputRange: [-dy, dy],
        }),
      },
      {
        scale: v.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.12],
        }),
      },
    ],
    opacity: v.interpolate({
      inputRange: [0, 1],
      outputRange: [0.18, 0.38],
    }),
  });

  const spinDeg = ring.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const barWidth = bar.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const rootStyle =
    variant === 'overlay'
      ? [styles.root, styles.overlay]
      : [styles.root, styles.fill];

  return (
    <View
      style={[rootStyle, DIR]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <LinearGradient
        colors={[...colors.gradient]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbA, orbDrift(orbA, 18, 28)]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbB, orbDrift(orbB, 22, 16)]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbC, orbDrift(orbC, 14, 22)]}
      />

      <Animated.View style={[styles.center, { opacity: fadeIn }]}>
        <View style={styles.markWrap}>
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ rotate: spinDeg }],
                opacity: starGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 0.95],
                }),
              },
            ]}
          />

          <Animated.View
            style={[
              styles.starGlow,
              {
                opacity: starGlow,
                transform: [{ scale: starScale }],
              },
            ]}
          />

          <Animated.View style={{ transform: [{ scale: starScale }] }}>
            <LinearGradient
              colors={[...colors.primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.starBadge}
            >
              <Text style={styles.starGlyph}>✦</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <Text style={[styles.brand, systemFonts && styles.brandSystem]}>מעשר ישר</Text>
        <Text style={[styles.message, systemFonts && styles.messageSystem]}>{message}</Text>

        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFillWrap, { width: barWidth }]}>
            <LinearGradient
              colors={[colors.primary, colors.accent2, colors.gold]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.barFill}
            />
          </Animated.View>
          {run ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.barShimmer,
                {
                  opacity: shimmer.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.55, 0],
                  }),
                  transform: [
                    {
                      translateX: shimmer.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-40, 160],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
        </View>

        <View style={styles.dotsRow}>
          <PulseDot delay={0} run={run} />
          <PulseDot delay={160} run={run} />
          <PulseDot delay={320} run={run} />
        </View>
      </Animated.View>
    </View>
  );
}

function PulseDot({ delay, run }: { delay: number; run: boolean }) {
  const v = useRef(new Animated.Value(run ? 0 : 0.55)).current;

  useEffect(() => {
    if (!run) {
      v.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(v, {
          toValue: 0.25,
          duration: 420,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, run, v]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5],
              }),
            },
          ],
        },
      ]}
    />
  );
}

/** לועדר קטן לכפתורים / צ׳אט — עם כיבוד נגישות */
export function InlineLoader({
  color = colors.primary,
  size = 18,
  label,
}: {
  color?: string;
  size?: number;
  label?: string;
}) {
  const run = useMotionEnabled();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!run) {
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [run, spin]);

  const rot = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      style={styles.inlineRoot}
      accessibilityLabel={label ?? 'טוען'}
      accessibilityRole="progressbar"
    >
      {run ? (
        <Animated.View
          style={[
            styles.inlineRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderTopColor: color,
              borderRightColor: color,
              transform: [{ rotate: rot }],
            },
          ]}
        />
      ) : (
        <View style={styles.inlineDots}>
          <View style={[styles.inlineDot, { backgroundColor: color, opacity: 0.85 }]} />
          <View style={[styles.inlineDot, { backgroundColor: color, opacity: 0.55 }]} />
          <View style={[styles.inlineDot, { backgroundColor: color, opacity: 0.35 }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 200,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbA: {
    width: 260,
    height: 260,
    top: -80,
    end: -70,
    backgroundColor: colors.orbA,
  },
  orbB: {
    width: 200,
    height: 200,
    bottom: 120,
    start: -90,
    backgroundColor: colors.orbB,
  },
  orbC: {
    width: 140,
    height: 140,
    top: '42%',
    end: 24,
    backgroundColor: colors.orbC,
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 360,
    width: '100%',
  },
  markWrap: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ring: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2.5,
    borderTopColor: colors.gold,
    borderRightColor: 'rgba(139,155,255,0.45)',
    borderBottomColor: colors.accent2,
    borderLeftColor: 'rgba(255,216,138,0.15)',
    backgroundColor: 'transparent',
  },
  starGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.goldSoft,
  },
  starBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  starGlyph: {
    fontFamily: fonts.displayExtra,
    fontSize: 28,
    color: '#fff',
    lineHeight: 32,
  },
  brand: {
    fontFamily: fonts.displayExtra,
    fontSize: 28,
    lineHeight: 36,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  brandSystem: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontWeight: '800',
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  messageSystem: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontWeight: '500',
  },
  barTrack: {
    width: '72%',
    maxWidth: 220,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  barFillWrap: {
    height: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  barFill: {
    flex: 1,
  },
  barShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  inlineRoot: {
    width: 28,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineRing: {
    borderWidth: 2.5,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  inlineDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  inlineDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
