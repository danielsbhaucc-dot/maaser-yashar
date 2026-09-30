import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass, GlassPill } from '../components/Glass';
import { InlineLoader } from '../components/LoadingScreen';
import { Accordion } from '../components/Accordion';
import { useMotionEnabled } from '../hooks/useMotionEnabled';
import { NATIVE_DRIVER } from '../utils/motion';
import { useApp } from '../context/AppContext';
import { BOT_NAME, friendWord, type Gender, t } from '../utils/copy';
import { NOAM_AI_DISCLOSURE_LINE } from '../constants/noamDisclosure';
import {
  EXPLAIN,
  GENDER_ASK,
  afterGender,
  afterMarital,
  afterName,
  afterRate,
  displayFallbackName,
  introBubble,
  pick,
  welcomeDone,
} from '../utils/chatScript';
import {
  MAX_ONBOARD_CLARIFY,
  ONBOARD_DEFAULTS,
  confirmNameAsk,
  isNoPhrase,
  isYesPhrase,
  parseOnboardStep,
  refuseFieldForStep,
  skipNameContinue,
  type RefuseField,
} from '../ai/onboardApi';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';
import { DIR, rtlDomProps } from '../rtl';
import { RichMessageText } from '../components/RichMessageText';
import type { MaaserRate, MaritalStatus } from '../types';
import {
  parseRatePercentInput,
  rateLabelFull,
} from '../utils/rateLabel';

type Msg = { id: string; from: 'bot' | 'me'; text: string };

/** 0 שם · 1 מגדר · 2 משפחה · 3 שיעור · 4 סיום חגיגי (דורש לחיצה) */
const STORY_COUNT = 5;

function StoryBars({ step }: { step: number }) {
  const motionOk = useMotionEnabled();
  const anims = useRef(
    Array.from({ length: STORY_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    anims.forEach((a, i) => {
      if (i < step) {
        a.setValue(1);
      } else if (i > step) {
        a.setValue(0);
      } else if (!motionOk) {
        a.setValue(step === STORY_COUNT - 1 ? 1 : 0.55);
      } else {
        a.setValue(0);
        Animated.timing(a, {
          toValue: step === STORY_COUNT - 1 ? 1 : 0.55,
          duration: step === STORY_COUNT - 1 ? 700 : 9000,
          easing: Easing.linear,
          useNativeDriver: false,
        }).start();
      }
    });
  }, [step, anims, motionOk]);

  return (
    <View style={styles.storyBars}>
      {anims.map((a, i) => (
        <View key={i} style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              {
                width: a.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function TypingRow() {
  const motionOk = useMotionEnabled();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!motionOk) {
      a.setValue(0.55);
      b.setValue(0.55);
      c.setValue(0.55);
      return;
    }
    const bounce = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 260,
            useNativeDriver: NATIVE_DRIVER,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 260,
            useNativeDriver: NATIVE_DRIVER,
            easing: Easing.in(Easing.quad),
          }),
          Animated.delay(180),
        ])
      );
    const l1 = bounce(a, 0);
    const l2 = bounce(b, 110);
    const l3 = bounce(c, 220);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [a, b, c, motionOk]);

  const lift = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
    ],
  });

  return (
    <View style={styles.typingRow} accessibilityLabel={`${BOT_NAME} מקליד`}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.dot, lift(a)]} />
        <Animated.View style={[styles.dot, lift(b)]} />
        <Animated.View style={[styles.dot, lift(c)]} />
      </View>
    </View>
  );
}

function ConfettiBurst() {
  const motionOk = useMotionEnabled();
  const bits = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      x: (i % 6) * 16 - 40,
      delay: i * 40,
      color: [colors.gold, colors.primary, colors.accent, colors.success][i % 4]!,
      anim: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    bits.forEach((bit) => {
      if (!motionOk) {
        bit.anim.setValue(1);
        return;
      }
      bit.anim.setValue(0);
      Animated.timing(bit.anim, {
        toValue: 1,
        duration: 1400,
        delay: bit.delay,
        useNativeDriver: NATIVE_DRIVER,
        easing: Easing.out(Easing.cubic),
      }).start();
    });
  }, [bits, motionOk]);

  return (
    <View style={styles.confetti} pointerEvents="none">
      {bits.map((bit, i) => (
        <Animated.View
          key={i}
          style={[
            styles.confettiBit,
            {
              backgroundColor: bit.color,
              transform: [
                {
                  translateX: bit.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, bit.x],
                  }),
                },
                {
                  translateY: bit.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 70 + (i % 3) * 18],
                  }),
                },
                {
                  rotate: bit.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${120 + i * 20}deg`],
                  }),
                },
              ],
              opacity: bit.anim.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0, 1, 0],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

function StepNav({
  onBack,
  onSkip,
  showBack,
  disabled,
}: {
  onBack: () => void;
  onSkip: () => void;
  showBack: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={styles.stepNav}>
      {showBack ? (
        <Pressable
          style={[styles.navBtn, disabled && { opacity: 0.45 }]}
          onPress={onBack}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
        >
          <Text style={styles.navBtnText}>חזרה</Text>
        </Pressable>
      ) : (
        <View style={styles.navBtnSpacer} />
      )}
      <Pressable
        style={[styles.navBtn, styles.navBtnSkip, disabled && { opacity: 0.45 }]}
        onPress={onSkip}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="דילוג"
      >
        <Text style={styles.navBtnSkipText}>דילוג</Text>
      </Pressable>
    </View>
  );
}

export default function OnboardingScreen() {
  const { profile, setProfile } = useApp();
  const insets = useSafeAreaInsets();
  const opening = useMemo(() => introBubble(), []);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [skippedName, setSkippedName] = useState(false);
  const [draft, setDraft] = useState('');
  /** עד בחירה — unspecified (פנייה ניטרלית, N-14) */
  const [gender, setGender] = useState<Gender>('unspecified');
  const [marital, setMarital] = useState<MaritalStatus>('unknown');
  const [includeSpouse, setIncludeSpouse] = useState(false);
  const [rate, setRate] = useState<MaaserRate>(0.1);
  const [customRateOpen, setCustomRateOpen] = useState(false);
  const [customRateText, setCustomRateText] = useState('');
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateExplainOpen, setRateExplainOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [thinking, setThinking] = useState(false);
  /** צ׳יפ ביטול אחרי דילוג מיידי — 5 שניות */
  const [undoChip, setUndoChip] = useState<null | {
    label: string;
    snap: {
      step: number;
      name: string;
      skippedName: boolean;
      gender: Gender;
      marital: MaritalStatus;
      includeSpouse: boolean;
      rate: MaaserRate;
      msgs: Msg[];
      clarifyCount: number;
    };
  }>(null);
  const [clarifyCount, setClarifyCount] = useState(0);
  /** שם חשוד שמחכים לאישור מפורש («כן») */
  const [pendingName, setPendingName] = useState<string | null>(null);
  /** N-14: בועה אחת בפתיחה */
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 'i1', from: 'bot', text: opening },
  ]);
  const scrollRef = useRef<ScrollView>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const celebrateScale = useRef(new Animated.Value(0.86)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;
  const motionOk = useMotionEnabled();
  const inputQueueRef = useRef<string[]>([]);
  const transitioningRef = useRef(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!motionOk) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1200, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, motionOk]);

  useEffect(() => {
    const tmr = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: motionOk }),
      60
    );
    return () => clearTimeout(tmr);
  }, [msgs, step, thinking, motionOk]);

  useEffect(() => {
    if (step !== 4) return;
    if (!motionOk) {
      celebrateScale.setValue(1);
      celebrateOpacity.setValue(1);
      return;
    }
    celebrateScale.setValue(0.86);
    celebrateOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(celebrateScale, { toValue: 1, friction: 7, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(celebrateOpacity, { toValue: 1, duration: 420, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [step, celebrateScale, celebrateOpacity, motionOk]);

  const push = (from: 'bot' | 'me', text: string) => {
    setMsgs((m) => [...m, { id: `${Date.now()}-${Math.random()}`, from, text }]);
  };

  const goToGenderStep = (botLead: string) => {
    // N-14: בועת בוט אחת לכל מעבר שלב
    push('bot', `${botLead}\n\n${pick(GENDER_ASK)}`);
    setClarifyCount(0);
    setStep(1);
  };

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const takeSnap = () => ({
    step,
    name,
    skippedName,
    gender,
    marital,
    includeSpouse,
    rate,
    msgs: [...msgs],
    clarifyCount,
  });

  const applySnap = (snap: NonNullable<typeof undoChip>['snap']) => {
    setStep(snap.step);
    setName(snap.name);
    setSkippedName(snap.skippedName);
    setGender(snap.gender);
    setMarital(snap.marital);
    setIncludeSpouse(snap.includeSpouse);
    setRate(snap.rate);
    setMsgs(snap.msgs);
    setClarifyCount(snap.clarifyCount);
  };

  const showUndo = (label: string, snap: ReturnType<typeof takeSnap>) => {
    clearUndoTimer();
    setUndoChip({ label, snap });
    undoTimerRef.current = setTimeout(() => setUndoChip(null), 5000);
  };

  const applyRefuseDefaults = (field: RefuseField) => {
    setClarifyCount(0);
    if (field === 'name') {
      setName(ONBOARD_DEFAULTS.displayName);
      setSkippedName(true);
      goToGenderStep(skipNameContinue());
      return;
    }
    if (field === 'gender') {
      applyGender(ONBOARD_DEFAULTS.gender, false);
      return;
    }
    if (field === 'marital') {
      applyMarital(ONBOARD_DEFAULTS.maritalStatus, false, false);
      return;
    }
    if (field === 'rate') {
      applyRate(ONBOARD_DEFAULTS.rate, false);
    }
  };

  /** דילוג מיידי עם ברירת מחדל + צ׳יפ ביטול (ללא אישור «כן») */
  const skipImmediately = (field: RefuseField, fromButton?: boolean) => {
    if (thinking || finishing) return;
    const snap = takeSnap();
    if (fromButton) push('me', 'דילוג');
    applyRefuseDefaults(field);
    showUndo('בטל דילוג', snap);
  };

  const nudgeAfterClarify = (base: string) => {
    const next = clarifyCount + 1;
    setClarifyCount(next);
    if (next >= MAX_ONBOARD_CLARIFY) {
      return `${base}\n\nכדי להתקדם — בחרו מהכפתורים, או דילוג.`;
    }
    return base;
  };

  const flushInputQueue = () => {
    const next = inputQueueRef.current.shift();
    if (!next) return;
    setTimeout(() => {
      processFreeText(next);
    }, 0);
  };

  const processFreeText = (text: string) => {
    if (!text || finishing) return;
    if (thinking || transitioningRef.current) {
      inputQueueRef.current.push(text);
      return;
    }
    push('me', text);
    setThinking(true);
    transitioningRef.current = true;

    try {
      // אישור / דחייה של שם חשוד
      if (step === 0 && pendingName) {
        if (isYesPhrase(text) || /זה (באמת )?השם/i.test(text)) {
          const accepted = pendingName;
          setPendingName(null);
          setName(accepted);
          setSkippedName(false);
          setClarifyCount(0);
          goToGenderStep(afterName(accepted));
          return;
        }
        if (isNoPhrase(text)) {
          setPendingName(null);
          push(
            'bot',
            nudgeAfterClarify('בסדר — אז איך באמת קוראים לך? או במפורש בלי שם.')
          );
          return;
        }
        // ניסיון שם חדש / דילוג — ממשיכים לפרסור רגיל
        setPendingName(null);
      }

      const result = parseOnboardStep(step, text);

      if (step === 0) {
        if (result.intent === 'name' && result.name) {
          const reply = result.reply || afterName(result.name);
          setName(result.name);
          setSkippedName(false);
          setPendingName(null);
          setClarifyCount(0);
          goToGenderStep(reply);
          return;
        }
        if (result.intent === 'confirm_name' && result.name) {
          setPendingName(result.name);
          push(
            'bot',
            nudgeAfterClarify(result.reply || confirmNameAsk(result.name))
          );
          return;
        }
        if (result.intent === 'skip_name') {
          setPendingName(null);
          skipImmediately('name', false);
          return;
        }
        if (result.intent === 'gibberish') {
          setPendingName(null);
          push(
            'bot',
            nudgeAfterClarify(
              result.reply ||
                'זה לא נשמע כמו שם 😅 שם פרטי אמיתי — או במפורש בלי שם.'
            )
          );
          return;
        }
        push(
          'bot',
          nudgeAfterClarify(
            result.reply ||
              `שאלה טובה. ואחרי זה — איך קוראים לך? (או במפורש בלי שם.)`
          )
        );
        return;
      }

      if (result.intent === 'gender' && result.gender) {
        setClarifyCount(0);
        applyGender(result.gender, false);
        return;
      }

      if (result.intent === 'marital' && result.maritalStatus) {
        setClarifyCount(0);
        applyMarital(
          result.maritalStatus,
          result.maritalStatus === 'married' ? !!result.includeSpouse : false,
          false
        );
        return;
      }

      if (result.intent === 'rate_explain') {
        setRateExplainOpen(true);
        push('bot', EXPLAIN.rate);
        return;
      }

      if (result.intent === 'rate' && result.rate != null) {
        setClarifyCount(0);
        applyRate(result.rate, false);
        return;
      }

      if (result.intent === 'skip_step') {
        const field = refuseFieldForStep(step);
        if (field) skipImmediately(field, false);
        return;
      }

      if (result.intent === 'gibberish') {
        push(
          'bot',
          nudgeAfterClarify(
            result.reply ||
              'זה לא נשמע כמו תשובה לשלב הזה 😅 בחרו מהכפתורים — או דילוג.'
          )
        );
        return;
      }

      push(
        'bot',
        nudgeAfterClarify(
          result.reply ||
            'קיבלתי. אפשר גם לבחור מהכפתורים למטה — או לדלג על השלב.'
        )
      );
    } finally {
      setThinking(false);
      transitioningRef.current = false;
      flushInputQueue();
    }
  };

  const handleFreeText = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    processFreeText(text);
  };

  const applyGender = (g: Gender, fromButton: boolean) => {
    if (thinking) return;
    setGender(g);
    if (fromButton) {
      push(
        'me',
        g === 'male' ? 'זכר' : g === 'female' ? 'נקבה' : 'מעדיפים לא לומר'
      );
    }
    const display = displayFallbackName(name, g);
    setTimeout(() => {
      push('bot', afterGender(display, g));
      setClarifyCount(0);
      setStep(2);
    }, fromButton ? 280 : 0);
  };

  const pickGender = (g: Gender) => applyGender(g, true);

  const maritalLabelFor = (m: MaritalStatus, joint?: boolean) => {
    if (m === 'single') {
      return t(gender, 'רווק', 'רווקה', 'רווק/ה');
    }
    if (m === 'divorced') {
      return t(gender, 'גרוש', 'גרושה', 'גרוש/ה');
    }
    if (m === 'widowed') {
      return t(gender, 'אלמן', 'אלמנה', 'אלמן/ה');
    }
    if (m === 'unknown') return 'מדלגים על מצב משפחתי';
    if (joint) {
      return t(gender, 'נשוי — חישוב ביחד', 'נשואה — חישוב ביחד', 'נשוי/אה — חישוב ביחד');
    }
    return t(gender, 'נשוי — רק שלי', 'נשואה — רק שלי', 'נשוי/אה — רק שלי');
  };

  const applyMarital = (m: MaritalStatus, joint: boolean, fromButton: boolean) => {
    if (thinking) return;
    setMarital(m);
    const spouse = m === 'married' ? joint : false;
    setIncludeSpouse(spouse);
    if (fromButton) {
      push('me', maritalLabelFor(m, spouse));
    }
    setTimeout(() => {
      push('bot', afterMarital(gender));
      setClarifyCount(0);
      setStep(3);
    }, fromButton ? 280 : 0);
  };

  const pickMarital = (m: MaritalStatus, joint?: boolean) =>
    applyMarital(m, !!joint, true);

  const applyRate = (r: MaaserRate, fromButton: boolean) => {
    if (thinking) return;
    setRateError(null);
    setCustomRateOpen(false);
    setRateExplainOpen(false);
    setRate(r);
    if (fromButton) {
      push('me', rateLabelFull(r));
    }
    const display = displayFallbackName(name, gender);
    setTimeout(() => {
      push('bot', afterRate(display, gender, r));
      setTimeout(() => {
        setClarifyCount(0);
        setStep(4);
      }, 500);
    }, fromButton ? 280 : 0);
  };

  const pickRate = (r: MaaserRate) => applyRate(r, true);

  const confirmCustomRate = () => {
    if (thinking) return;
    const parsed = parseRatePercentInput(customRateText);
    if (!parsed.ok) {
      setRateError(parsed.error);
      return;
    }
    pickRate(parsed.rate);
  };

  const goBack = () => {
    if (thinking || finishing || step <= 0) return;
    setCustomRateOpen(false);
    setRateExplainOpen(false);
    setRateError(null);
    setClarifyCount(0);
    setStep((s) => Math.max(0, s - 1));
  };

  /** דילוג על השלב — מיידי עם ברירת מחדל + צ׳יפ ביטול */
  const skipCurrentStep = (fromButton: boolean) => {
    const field = refuseFieldForStep(step);
    if (!field) return;
    skipImmediately(field, fromButton);
  };

  /** נכנסים לאפליקציה רק אחרי לחיצה מפורשת */
  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    const savedName =
      name.trim() ||
      (skippedName ? ONBOARD_DEFAULTS.displayName : friendWord(gender));
    await setProfile({
      ...profile,
      onboardingDone: true,
      displayName: savedName,
      gender,
      maritalStatus: marital === 'unknown' ? ONBOARD_DEFAULTS.maritalStatus : marital,
      includeSpouse: marital === 'married' ? includeSpouse : false,
      rate,
      joinedAt: new Date().toISOString(),
      skippedSetup: false,
    });
  };

  /** דילוג ישר לחשבון — פרופיל ברירת מחדל (M19) */
  const skipToAccount = async () => {
    if (finishing) return;
    setFinishing(true);
    await setProfile({
      ...profile,
      onboardingDone: true,
      displayName: ONBOARD_DEFAULTS.displayName,
      gender: ONBOARD_DEFAULTS.gender,
      maritalStatus: ONBOARD_DEFAULTS.maritalStatus,
      includeSpouse: false,
      rate: ONBOARD_DEFAULTS.rate,
      joinedAt: new Date().toISOString(),
      skippedSetup: true,
      tuneCardDismissed: false,
    });
  };

  const displayName = displayFallbackName(name, gender);
  const rateSummary = rateLabelFull(rate);
  const maritalLabel = maritalLabelFor(
    marital,
    marital === 'married' ? includeSpouse : false
  );
  const showComposer = step < 4;

  return (
    <View style={[styles.root, DIR]} {...rtlDomProps}>
      <View style={styles.bgLayer} pointerEvents="none">
        <LinearGradient
          colors={[...colors.gradient]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.orb, styles.orbA]} />
        <View style={[styles.orb, styles.orbB]} />
      </View>

      <SafeAreaView style={styles.safe}>
        <StoryBars step={step} />

        <View style={styles.header}>
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulse }] }]}>
            <View style={styles.avatarRing}>
              <LinearGradient colors={[...colors.primaryGradient]} style={styles.avatar}>
                <Text style={styles.avatarLetter}>נ</Text>
              </LinearGradient>
            </View>
            <View style={styles.liveDot} />
          </Animated.View>
          <View style={styles.headerText}>
            <Text style={styles.botName}>{BOT_NAME}</Text>
            <Text style={styles.botMeta}>
              {thinking ? 'מקליד…' : 'העוזר ה-AI של מעשר ישר · עכשיו פעיל ✦'}
            </Text>
          </View>
          <GlassPill gold>
            <Text style={styles.brandMini}>מעשר ישר</Text>
          </GlassPill>
        </View>

        <Text style={styles.aiDisclosure}>{NOAM_AI_DISCLOSURE_LINE}</Text>

        {step === 4 ? (
          <Animated.View
            style={[
              styles.celebrateWrap,
              { opacity: celebrateOpacity, transform: [{ scale: celebrateScale }] },
            ]}
          >
            <Glass dark gold style={styles.celebrateCard}>
              <ConfettiBurst />
              <Text style={styles.celebrateEmoji}>✦</Text>
              <Text style={styles.celebrateTitle}>הפנקס מוכן</Text>
              <Text style={styles.celebrateName}>{displayName}</Text>
              {skippedName ? (
                <Text style={styles.skippedHint}>
                  בלי שם אישי — לגמרי בסדר. אפשר לעדכן בהגדרות מתי שרוצים.
                </Text>
              ) : (
                <Text style={styles.celebrateHello}>
                  {`${BOT_NAME} שמח להכיר`}
                </Text>
              )}
              <Text style={styles.celebrateBody}>{welcomeDone(displayName, gender, rate)}</Text>

              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLbl}>שיעור</Text>
                  <Text style={styles.summaryVal}>{rateSummary}</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLbl}>מצב</Text>
                  <Text style={styles.summaryVal}>
                    {marital === 'unknown' ? '—' : maritalLabel}
                  </Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLbl}>חישוב</Text>
                  <Text style={styles.summaryVal}>מהנטו</Text>
                </View>
              </View>

              <Pressable
                style={[styles.cta, finishing && { opacity: 0.55 }, shadow.float]}
                onPress={finish}
                disabled={finishing}
                accessibilityRole="button"
                accessibilityLabel="כניסה לפנקס"
              >
                {finishing ? (
                  <InlineLoader color={colors.ink} size={18} label="שומר פרופיל" />
                ) : (
                  <Text style={styles.ctaText}>יאללה, נכנסים לפנקס ✦</Text>
                )}
              </Pressable>
              <Text style={styles.celebrateHint}>
                לא נכנסים אוטומטית — רק בלחיצה. בקצב שלך.
              </Text>
            </Glass>
          </Animated.View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              ref={scrollRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chat}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              horizontal={false}
            >
              {msgs.map((m) => (
                <View
                  key={m.id}
                  style={[styles.row, m.from === 'me' ? styles.rowMe : styles.rowBot]}
                >
                  <View
                    style={[styles.bubble, m.from === 'me' ? styles.bubbleMe : styles.bubbleBot]}
                  >
                    <RichMessageText
                      content={m.text}
                      tone={m.from === 'me' ? 'me' : 'bot'}
                      style={m.from === 'me' ? styles.msgMe : styles.msgBot}
                    />
                  </View>
                </View>
              ))}

              {thinking ? <TypingRow /> : null}

              {undoChip ? (
                <Pressable
                  style={styles.undoChip}
                  onPress={() => {
                    clearUndoTimer();
                    applySnap(undoChip.snap);
                    setUndoChip(null);
                    push('bot', 'ביטלתי את הדילוג — אפשר להמשיך מהשלב.');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={undoChip.label}
                  testID="onboard-undo-skip"
                >
                  <Text style={styles.undoChipText}>{undoChip.label}</Text>
                </Pressable>
              ) : null}

              {step === 1 && !thinking && (
                <Glass style={styles.panel}>
                  <Text style={styles.panelTitle}>מה המגדר שלך?</Text>
                  <Accordion
                    items={[
                      {
                        id: 'gender',
                        question: 'למה זה חשוב?',
                        answer: EXPLAIN.gender,
                      },
                    ]}
                  />
                  <View style={styles.two}>
                    <Pressable
                      style={[styles.opt, styles.optBlue]}
                      onPress={() => pickGender('male')}
                    >
                      <Text style={styles.optText}>זכר</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.opt, styles.optRose]}
                      onPress={() => pickGender('female')}
                    >
                      <Text style={styles.optText}>נקבה</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    style={[styles.optWide, styles.optWideAlt]}
                    onPress={() => pickGender('unspecified')}
                    accessibilityRole="button"
                    accessibilityLabel="מעדיפים לא לומר"
                  >
                    <Text style={styles.optText}>מעדיפים לא לומר</Text>
                  </Pressable>
                  <StepNav
                    showBack
                    onBack={goBack}
                    onSkip={() => skipCurrentStep(true)}
                    disabled={thinking}
                  />
                </Glass>
              )}

              {step === 2 && !thinking && (
                <Glass style={styles.panel}>
                  <Text style={styles.panelTitle}>מצב משפחתי</Text>
                  <Accordion
                    items={[
                      {
                        id: 'marital',
                        question: 'ביחד או בנפרד?',
                        answer: EXPLAIN.marital,
                      },
                    ]}
                  />
                  <Pressable style={styles.optWide} onPress={() => pickMarital('single')}>
                    <Text style={styles.optText}>
                      {t(gender, 'רווק', 'רווקה', 'רווק/ה')}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.optWide} onPress={() => pickMarital('married', true)}>
                    <Text style={styles.optText}>
                      {t(
                        gender,
                        'נשוי — חישוב ביחד',
                        'נשואה — חישוב ביחד',
                        'נשוי/אה — חישוב ביחד'
                      )}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.optWide, styles.optWideAlt]}
                    onPress={() => pickMarital('married', false)}
                  >
                    <Text style={styles.optText}>
                      {t(
                        gender,
                        'נשוי — רק שלי',
                        'נשואה — רק שלי',
                        'נשוי/אה — רק שלי'
                      )}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.optWide} onPress={() => pickMarital('divorced')}>
                    <Text style={styles.optText}>
                      {t(gender, 'גרוש', 'גרושה', 'גרוש/ה')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.optWide, styles.optWideAlt]}
                    onPress={() => pickMarital('widowed')}
                  >
                    <Text style={styles.optText}>
                      {t(gender, 'אלמן', 'אלמנה', 'אלמן/ה')}
                    </Text>
                  </Pressable>
                  <StepNav
                    showBack
                    onBack={goBack}
                    onSkip={() => skipCurrentStep(true)}
                    disabled={thinking}
                  />
                </Glass>
              )}

              {step === 3 && !thinking && (
                <Glass style={styles.panel}>
                  <Text style={styles.panelTitle}>מעשר, חומש או אחר?</Text>
                  <Pressable
                    style={styles.diffBtn}
                    onPress={() => {
                      if (rateExplainOpen) {
                        setRateExplainOpen(false);
                        return;
                      }
                      setRateExplainOpen(true);
                      push('me', 'מה ההבדל?');
                      push('bot', EXPLAIN.rate);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="מה ההבדל"
                  >
                    <Text style={styles.diffBtnText}>מה ההבדל?</Text>
                  </Pressable>
                  <Accordion
                    items={[
                      {
                        id: 'rate',
                        question: 'הסבר הלכתי על 10% / 20%',
                        answer: EXPLAIN.rate,
                      },
                      {
                        id: 'net',
                        question: 'למה מחשבים מהנטו?',
                        answer: EXPLAIN.net,
                      },
                    ]}
                  />
                  <View style={styles.two}>
                    <Pressable
                      style={[styles.opt, styles.optPrimary]}
                      onPress={() => pickRate(0.1)}
                    >
                      <Text style={styles.optNum}>10%</Text>
                      <Text style={styles.optText}>מעשר</Text>
                    </Pressable>
                    <Pressable style={[styles.opt, styles.optGold]} onPress={() => pickRate(0.2)}>
                      <Text style={styles.optNum}>20%</Text>
                      <Text style={styles.optText}>חומש</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    style={[styles.optWide, customRateOpen && styles.optWideAlt]}
                    onPress={() => {
                      setCustomRateOpen(true);
                      if (!customRateText) setCustomRateText('15');
                    }}
                  >
                    <Text style={styles.optText}>אחר — אחוז מותאם</Text>
                  </Pressable>
                  {customRateOpen ? (
                    <View style={styles.customRateBox}>
                      <Text style={styles.customRateHint}>בין 1% ל־50% (ספרה אחת)</Text>
                      <TextInput
                        style={styles.customRateInput}
                        value={customRateText}
                        onChangeText={(txt) => {
                          setCustomRateText(txt);
                          if (rateError) setRateError(null);
                        }}
                        keyboardType="decimal-pad"
                        placeholder="15"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        textAlign="center"
                        accessibilityLabel="אחוז נתינה מותאם"
                      />
                      {rateError ? (
                        <Text style={styles.rateError} accessibilityRole="alert">
                          {rateError}
                        </Text>
                      ) : null}
                      <Pressable
                        style={[styles.optWide, styles.optPrimary]}
                        onPress={confirmCustomRate}
                      >
                        <Text style={styles.optText}>
                          אשר {customRateText ? `${customRateText}%` : 'שיעור'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <StepNav
                    showBack
                    onBack={goBack}
                    onSkip={() => skipCurrentStep(true)}
                    disabled={thinking}
                  />
                </Glass>
              )}
            </ScrollView>

            {showComposer ? (
              <View style={[styles.composerCol, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
                {step === 0 ? (
                  <Pressable
                    style={[styles.skipBtn, finishing && { opacity: 0.55 }]}
                    onPress={() => void skipToAccount()}
                    disabled={finishing || thinking}
                    accessibilityRole="button"
                    accessibilityLabel="דלג ישר לחשבון"
                  >
                    <Text style={styles.skipBtnText}>דלג ישר לחשבון</Text>
                  </Pressable>
                ) : null}
                <View style={styles.composer}>
                  <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={
                      step === 0
                        ? 'שם פרטי, שאלה, או בלי שם…'
                        : 'שאלה לנועם…'
                    }
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    textAlign="start"
                    onSubmitEditing={() => void handleFreeText()}
                    returnKeyType="send"
                    autoCorrect={false}
                    editable={!finishing}
                  />
                  <Pressable
                    style={[
                      styles.send,
                      (!draft.trim() || finishing) && styles.sendDisabled,
                      shadow.float,
                    ]}
                    onPress={() => void handleFreeText()}
                    disabled={!draft.trim() || thinking || finishing}
                    accessibilityRole="button"
                    accessibilityLabel="שלח"
                  >
                    <Text style={styles.sendLabel}>{thinking ? '…' : 'שלח'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    width: '100%',
  },
  bgLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  safe: { flex: 1, width: '100%', overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.18 },
  orbA: {
    width: 180,
    height: 180,
    top: -50,
    end: -40,
    backgroundColor: colors.orbA,
  },
  orbB: {
    width: 140,
    height: 140,
    bottom: 180,
    start: -50,
    backgroundColor: colors.orbB,
    opacity: 0.14,
  },
  storyBars: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    width: '100%',
  },
  chatScroll: { flex: 1, width: '100%' },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    borderRadius: 18,
    padding: 2,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.primarySoft,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.displayExtra,
    fontSize: 22,
    color: '#fff',
  },
  liveDot: {
    position: 'absolute',
    end: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  headerText: { flex: 1, alignItems: 'flex-start', minWidth: 0 },
  botName: { ...type.h3, color: '#fff', writingDirection: 'rtl', textAlign: 'start' },
  botMeta: {
    ...type.caption,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  aiDisclosure: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.gold,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginHorizontal: spacing.md,
    marginBottom: 4,
    backgroundColor: 'rgba(255, 216, 138, 0.10)',
    borderRadius: radii.md,
    writingDirection: 'rtl',
  },
  brandMini: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.gold,
    writingDirection: 'rtl',
  },
  chat: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 24,
    gap: 10,
    width: '100%',
  },
  row: { width: '100%' },
  // start = ימין בעברית (נועם), end = שמאל (אני)
  rowBot: { alignItems: 'flex-start' },
  rowMe: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '86%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  bubbleBot: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderBottomStartRadius: 5,
  },
  bubbleMe: {
    backgroundColor: 'rgba(139, 155, 255, 0.82)',
    borderBottomEndRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...shadow.soft,
  },
  msg: { ...type.chat },
  msgBot: { color: '#F8FAFC', writingDirection: 'rtl', textAlign: 'start' },
  msgMe: { ...type.chatMe, color: colors.ink, writingDirection: 'rtl', textAlign: 'start' },
  typingRow: { alignSelf: 'flex-start' },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
  },
  panel: { padding: spacing.md, marginTop: 6 },
  panelTitle: { ...type.h2, color: '#fff', textAlign: 'center' },
  undoChip: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,216,138,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,216,138,0.45)',
  },
  undoChipText: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.gold,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  stepNav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  navBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  navBtnSpacer: { flex: 1 },
  navBtnSkip: {
    borderColor: 'rgba(255,216,138,0.35)',
    backgroundColor: 'rgba(255,216,138,0.10)',
  },
  navBtnText: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    writingDirection: 'rtl',
  },
  navBtnSkipText: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.gold,
    writingDirection: 'rtl',
  },
  diffBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,216,138,0.4)',
    backgroundColor: 'rgba(255,216,138,0.12)',
  },
  diffBtnText: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.gold,
    writingDirection: 'rtl',
  },
  two: { flexDirection: 'row', gap: 10, marginTop: 14 },
  opt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 2,
  },
  optBlue: { backgroundColor: 'rgba(123,140,255,0.28)' },
  optRose: { backgroundColor: 'rgba(240,168,184,0.28)' },
  optPrimary: { backgroundColor: 'rgba(123,140,255,0.32)' },
  optGold: { backgroundColor: 'rgba(232,192,122,0.28)' },
  optWide: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(123,140,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  optWideAlt: { backgroundColor: 'rgba(184,164,255,0.2)' },
  customRateBox: {
    marginTop: 12,
    gap: 8,
    alignItems: 'center',
  },
  customRateHint: {
    ...type.caption,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  customRateInput: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.numBold,
    fontSize: 28,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,216,138,0.35)',
    textAlign: 'center',
  },
  rateError: {
    ...type.caption,
    fontFamily: fonts.medium,
    color: colors.danger,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  optText: { ...type.emphasis, color: '#fff', fontSize: 14, textAlign: 'center' },
  optNum: {
    fontFamily: fonts.numBold,
    fontSize: 26,
    color: '#fff',
    letterSpacing: -0.5,
  },
  composerCol: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(10,14,28,0.55)',
    width: '100%',
    paddingTop: 10,
    gap: 8,
  },
  skipBtn: {
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skipBtnText: {
    fontFamily: fonts.semi,
    fontSize: 15,
    color: colors.gold,
    writingDirection: 'rtl',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    width: '100%',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1.5,
    borderColor: colors.glassGoldBorder,
    writingDirection: 'rtl',
    textAlign: 'start',
  },
  send: {
    backgroundColor: 'rgba(139, 155, 255, 0.82)',
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { ...type.button, color: colors.ink },
  celebrateWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  celebrateCard: {
    padding: spacing.xl,
    alignItems: 'center',
    borderRadius: radii.xxl,
    overflow: 'hidden',
  },
  confetti: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    paddingTop: 24,
  },
  confettiBit: {
    position: 'absolute',
    top: 20,
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  celebrateEmoji: {
    fontSize: 36,
    color: colors.gold,
    marginBottom: 8,
  },
  celebrateTitle: {
    ...type.h2,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  celebrateName: {
    ...type.highlight,
    color: colors.gold,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  celebrateHello: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 8,
  },
  skippedHint: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  celebrateBody: {
    ...type.bodySm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
    width: '100%',
  },
  summaryChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryLbl: { ...type.caption, color: colors.inkSoft },
  summaryVal: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    marginTop: 4,
    textAlign: 'center',
  },
  cta: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingVertical: 16,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(139, 155, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  ctaText: { ...type.button, color: colors.ink },
  celebrateHint: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 14,
  },
});
