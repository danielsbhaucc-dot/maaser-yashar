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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass, GlassPill } from '../components/Glass';
import { Accordion } from '../components/Accordion';
import { useApp } from '../context/AppContext';
import { BOT_NAME, type Gender, t } from '../utils/copy';
import {
  ASK_NAME,
  EXPLAIN,
  GENDER_JOKES,
  INTROS,
  afterGender,
  afterMarital,
  afterName,
  afterRate,
  pick,
  welcomeDone,
} from '../utils/chatScript';
import { askOnboardAi, skipNameContinue } from '../ai/onboardApi';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';
import { DIR } from '../rtl';
import type { MaaserRate } from '../types';

type Msg = { id: string; from: 'bot' | 'me'; text: string };

/** 0 שם · 1 מגדר · 2 משפחה · 3 שיעור · 4 סיום חגיגי (דורש לחיצה) */
const STORY_COUNT = 5;

function StoryBars({ step }: { step: number }) {
  const anims = useRef(
    Array.from({ length: STORY_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    anims.forEach((a, i) => {
      if (i < step) {
        a.setValue(1);
      } else if (i > step) {
        a.setValue(0);
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
  }, [step, anims]);

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
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
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
  }, [a, b, c]);

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
      bit.anim.setValue(0);
      Animated.timing(bit.anim, {
        toValue: 1,
        duration: 1400,
        delay: bit.delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start();
    });
  }, [bits]);

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

export default function OnboardingScreen() {
  const { profile, setProfile } = useApp();
  const intro = useMemo(() => pick(INTROS), []);
  const askName = useMemo(
    () =>
      `${pick(ASK_NAME)}\n\n(אפשר גם לשאול אותי משהו קטן על מעשר — ואם ממש מעדיפים בלי שם, תגידו במפורש.)`,
    []
  );

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [skippedName, setSkippedName] = useState(false);
  const [draft, setDraft] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [marital, setMarital] = useState<'single' | 'married'>('single');
  const [includeSpouse, setIncludeSpouse] = useState(false);
  const [rate, setRate] = useState<MaaserRate>(0.1);
  const [finishing, setFinishing] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 'i1', from: 'bot', text: intro },
    { id: 'i2', from: 'bot', text: askName },
  ]);
  const scrollRef = useRef<ScrollView>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const celebrateScale = useRef(new Animated.Value(0.86)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  useEffect(() => {
    const tmr = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(tmr);
  }, [msgs, step, thinking]);

  useEffect(() => {
    if (step !== 4) return;
    celebrateScale.setValue(0.86);
    celebrateOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(celebrateScale, { toValue: 1, friction: 7, useNativeDriver: true }),
      Animated.timing(celebrateOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [step, celebrateScale, celebrateOpacity]);

  const push = (from: 'bot' | 'me', text: string) => {
    setMsgs((m) => [...m, { id: `${Date.now()}-${Math.random()}`, from, text }]);
  };

  const handleFreeText = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft('');
    push('me', text);
    setThinking(true);

    try {
      const result = await askOnboardAi({
        text,
        step,
        knownName: name,
      });

      if (step === 0) {
        if (result.intent === 'name' && result.name) {
          const reply =
            result.reply ||
            afterName(result.name);
          push('bot', `${reply}\n\n${pick(GENDER_JOKES)}`);
          setName(result.name);
          setSkippedName(false);
          setStep(1);
          return;
        }
        if (result.intent === 'skip_name') {
          push(
            'bot',
            `${result.reply}\n\n${skipNameContinue('male')}\n\n${pick(GENDER_JOKES)}`
          );
          setName('');
          setSkippedName(true);
          setStep(1);
          return;
        }
        if (result.intent === 'gibberish') {
          push(
            'bot',
            result.reply ||
              'זה לא נשמע כמו שם 😅 שם פרטי אמיתי — או במפורש «בלי שם».'
          );
          return;
        }
        // question / other — עונים ונשארים על שלב השם
        push(
          'bot',
          result.reply ||
            `שאלה טובה. ואחרי זה — איך קוראים לך? (או תגיד במפורש «בלי שם».)`
        );
        return;
      }

      // בשלבים מתקדמים — רק שאלות/שיחה קלה, בלי לדרוס בחירות
      push(
        'bot',
        result.reply ||
          t(
            gender,
            'קיבלתי. אפשר גם לבחור מהכפתורים למטה — זה הכי מדויק.',
            'קיבלתי. אפשר גם לבחור מהכפתורים למטה — זה הכי מדויק.'
          )
      );
    } catch {
      push('bot', 'רגע של גליץ׳ קטן. נסה שוב — או בחר מהכפתורים.');
    } finally {
      setThinking(false);
    }
  };

  const pickGender = (g: Gender) => {
    if (thinking) return;
    setGender(g);
    push('me', g === 'male' ? 'זכר' : 'נקבה');
    const display = name.trim() || t(g, 'חבר', 'חברה');
    setTimeout(() => {
      push('bot', afterGender(display, g));
      setStep(2);
    }, 280);
  };

  const pickMarital = (m: 'single' | 'married', joint?: boolean) => {
    if (thinking) return;
    setMarital(m);
    if (m === 'married') setIncludeSpouse(!!joint);
    push(
      'me',
      m === 'single'
        ? t(gender, 'רווק', 'רווקה')
        : joint
          ? t(gender, 'נשוי — חישוב ביחד', 'נשואה — חישוב ביחד')
          : t(gender, 'נשוי — רק שלי', 'נשואה — רק שלי')
    );
    setTimeout(() => {
      push('bot', afterMarital(gender));
      setStep(3);
    }, 280);
  };

  const pickRate = (r: MaaserRate) => {
    if (thinking) return;
    setRate(r);
    push('me', r === 0.1 ? 'מעשר 10%' : 'חומש 20%');
    const display = name.trim() || t(gender, 'חבר', 'חברה');
    setTimeout(() => {
      push('bot', afterRate(display, gender, r));
      setTimeout(() => setStep(4), 500);
    }, 280);
  };

  /** נכנסים לאפליקציה רק אחרי לחיצה מפורשת */
  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    await setProfile({
      ...profile,
      onboardingDone: true,
      displayName: name.trim() || t(gender, 'חבר', 'חברה'),
      gender,
      maritalStatus: marital,
      includeSpouse: marital === 'married' ? includeSpouse : false,
      rate,
      hasSalary: true,
      hasBusiness: true,
      joinedAt: new Date().toISOString(),
    });
  };

  const displayName = name.trim() || t(gender, 'חבר', 'חברה');
  const rateLabel = rate === 0.2 ? 'חומש 20%' : 'מעשר 10%';
  const maritalLabel =
    marital === 'single'
      ? t(gender, 'רווק', 'רווקה')
      : includeSpouse
        ? t(gender, 'נשוי · ביחד', 'נשואה · ביחד')
        : t(gender, 'נשוי · בנפרד', 'נשואה · בנפרד');
  const showComposer = step < 4;

  return (
    <View style={[styles.root, DIR]}>
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
        <View style={[styles.orb, styles.orbC]} />
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
              {thinking ? 'מקליד…' : 'החבר שלך למעשר · עכשיו פעיל ✦'}
            </Text>
          </View>
          <GlassPill gold>
            <Text style={styles.brandMini}>מעשר ישר</Text>
          </GlassPill>
        </View>

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
              <Text style={styles.celebrateTitle}>
                {t(gender, 'הפנקס שלך מוכן', 'הפנקס שלך מוכן')}
              </Text>
              <Text style={styles.celebrateName}>{displayName}</Text>
              {skippedName ? (
                <Text style={styles.skippedHint}>
                  בלי שם אישי — לגמרי בסדר. אפשר לעדכן בהגדרות מתי שרוצים.
                </Text>
              ) : (
                <Text style={styles.celebrateHello}>
                  {t(
                    gender,
                    `${BOT_NAME} שמח להכיר אותך`,
                    `${BOT_NAME} שמח להכיר אותך`
                  )}
                </Text>
              )}
              <Text style={styles.celebrateBody}>{welcomeDone(displayName, gender, rate)}</Text>

              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLbl}>שיעור</Text>
                  <Text style={styles.summaryVal}>{rateLabel}</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLbl}>מצב</Text>
                  <Text style={styles.summaryVal}>{maritalLabel}</Text>
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
                accessibilityLabel={t(gender, 'כניסה לפנקס', 'כניסה לפנקס')}
              >
                {finishing ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.ctaText}>
                    {t(gender, 'יאללה, נכנסים לפנקס ✦', 'יאללה, נכנסות לפנקס ✦')}
                  </Text>
                )}
              </Pressable>
              <Text style={styles.celebrateHint}>
                לא נכנסים אוטומטית — רק כשאתה לוחץ. בקצב שלך.
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
                    <Text style={[styles.msg, m.from === 'me' ? styles.msgMe : styles.msgBot]}>
                      {m.text}
                    </Text>
                  </View>
                </View>
              ))}

              {thinking ? <TypingRow /> : null}

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
                    <Text style={styles.optText}>{t(gender, 'רווק', 'רווקה')}</Text>
                  </Pressable>
                  <Pressable style={styles.optWide} onPress={() => pickMarital('married', true)}>
                    <Text style={styles.optText}>
                      {t(gender, 'נשוי — חישוב ביחד', 'נשואה — חישוב ביחד')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.optWide, styles.optWideAlt]}
                    onPress={() => pickMarital('married', false)}
                  >
                    <Text style={styles.optText}>
                      {t(gender, 'נשוי — רק שלי', 'נשואה — רק שלי')}
                    </Text>
                  </Pressable>
                </Glass>
              )}

              {step === 3 && !thinking && (
                <Glass style={styles.panel}>
                  <Text style={styles.panelTitle}>מעשר או חומש?</Text>
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
                </Glass>
              )}
            </ScrollView>

            {showComposer ? (
              <View style={styles.composer}>
                <Pressable
                  style={[
                    styles.send,
                    (!draft.trim() || thinking) && styles.sendDisabled,
                    shadow.float,
                  ]}
                  onPress={() => void handleFreeText()}
                  disabled={!draft.trim() || thinking}
                >
                  <Text style={styles.sendLabel}>{thinking ? '…' : 'שלח'}</Text>
                </Pressable>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={
                    step === 0
                      ? 'שם פרטי, שאלה, או «בלי שם»…'
                      : 'שאלה לנועם…'
                  }
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  textAlign="right"
                  onSubmitEditing={() => void handleFreeText()}
                  returnKeyType="send"
                  autoCorrect={false}
                  editable={!thinking}
                />
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
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.32 },
  orbA: {
    width: 260,
    height: 260,
    top: -40,
    end: -50,
    backgroundColor: colors.orbA,
  },
  orbB: {
    width: 220,
    height: 220,
    bottom: 120,
    start: -70,
    backgroundColor: colors.orbB,
  },
  orbC: {
    width: 180,
    height: 180,
    top: '40%',
    end: -40,
    backgroundColor: colors.orbC,
    opacity: 0.22,
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
  headerText: { flex: 1, alignItems: 'flex-start' },
  botName: { ...type.h3, color: '#fff' },
  botMeta: {
    ...type.caption,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  brandMini: {
    fontFamily: fonts.semi,
    fontSize: 11,
    color: colors.gold,
  },
  chat: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 24,
    gap: 10,
  },
  row: { width: '100%' },
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
  msgBot: { color: '#F8FAFC' },
  msgMe: { ...type.chatMe, color: colors.ink },
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
  optText: { ...type.emphasis, color: '#fff', fontSize: 14, textAlign: 'center' },
  optNum: {
    fontFamily: fonts.numBold,
    fontSize: 26,
    color: '#fff',
    letterSpacing: -0.5,
  },
  composer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(10,14,28,0.55)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1.5,
    borderColor: colors.glassGoldBorder,
    writingDirection: 'rtl',
    textAlign: 'right',
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
