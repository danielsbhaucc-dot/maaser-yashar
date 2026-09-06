import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCloseButton } from './Glass';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BOT_NAME, t } from '../utils/copy';
import { currentPeriod } from '../utils/history';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';
import { DIR } from '../rtl';
import {
  QUICK_STARTS,
  buildNoamSystem,
  kindLabel,
  loadThreads,
  msgId,
  newThreadId,
  saveThreads,
  sendToNoam,
  type ChatMessage,
  type ChatThread,
  type ProposedEntry,
} from '../ai/noam';
import { noamChatWelcome } from '../utils/noamCompanion';
import { computeTotals, entriesForPeriod } from '../utils/ledger';
import type { MaaserRate } from '../types';

type ViewMode = 'home' | 'chat' | 'history';

function NoamAvatar({ size = 56, glow }: { size?: number; glow?: boolean }) {
  return (
    <View style={[styles.avatarOuter, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }, glow && styles.avatarGlow]}>
      <LinearGradient
        colors={[...colors.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={[styles.avatarLetter, { fontSize: size * 0.42 }]}>נ</Text>
      </LinearGradient>
      <View style={[styles.onlineDot, { width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11 }]} />
    </View>
  );
}

function TypingDots() {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(v, { toValue: 0, duration: 280, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
          Animated.delay(200),
        ])
      );
    const l1 = bounce(a, 0);
    const l2 = bounce(b, 120);
    const l3 = bounce(c, 240);
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
    transform: [
      {
        translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }),
      },
    ],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
  });

  return (
    <View style={styles.typingRow} accessibilityLabel={`${BOT_NAME} מקליד`}>
      <NoamAvatar size={28} />
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.dot, lift(a)]} />
        <Animated.View style={[styles.dot, lift(b)]} />
        <Animated.View style={[styles.dot, lift(c)]} />
      </View>
    </View>
  );
}

function formatMoney(n: number) {
  return `₪${Math.round(n).toLocaleString('he-IL')}`;
}

export default function NoamChat() {
  const { profile, ledger, addEntries } = useApp();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ViewMode>('home');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [pending, setPending] = useState<ProposedEntry[]>([]);
  const [applying, setApplying] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const launcherPulse = useRef(new Animated.Value(1)).current;

  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  const active = useMemo(
    () => threads.find((th) => th.id === activeId) || null,
    [threads, activeId]
  );
  const messages = active?.messages ?? [];

  const tabBottom =
    (Platform.OS === 'ios' ? 22 : 12) + 64 + Math.max(insets.bottom - 8, 0);
  const launcherBottom = tabBottom + 8;

  useEffect(() => {
    loadThreads().then(setThreads);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(launcherPulse, {
          toValue: 1.06,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(launcherPulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [launcherPulse]);

  useEffect(() => {
    if (!open || mode !== 'chat') return;
    const tmr = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(tmr);
  }, [messages, typing, pending, open, mode]);

  const persist = useCallback(async (next: ChatThread[]) => {
    setThreads(next);
    await saveThreads(next);
  }, []);

  const openMessenger = () => {
    setOpen(true);
    setMode('home');
    setPending([]);
  };

  const closeMessenger = () => {
    setOpen(false);
    setTyping(false);
    setDraft('');
  };

  const startNewChat = (seed?: string) => {
    const id = newThreadId();
    const period = currentPeriod();
    const month = entriesForPeriod(ledger, period);
    const totals = computeTotals(month, profile.rate as MaaserRate);
    const welcome: ChatMessage = {
      id: msgId(),
      role: 'assistant',
      content: noamChatWelcome({
        name,
        gender: profile.gender,
        totals,
        entryCount: month.length,
      }),
      createdAt: new Date().toISOString(),
    };
    const th: ChatThread = {
      id,
      title: seed?.slice(0, 28) || `עם ${name}`,
      updatedAt: new Date().toISOString(),
      messages: [welcome],
    };
    const next = [th, ...threads];
    void persist(next);
    setActiveId(id);
    setMode('chat');
    setPending([]);
    if (seed) {
      setTimeout(() => void sendText(seed, id, next), 320);
    }
  };

  const openThread = (id: string) => {
    setActiveId(id);
    setMode('chat');
    setPending([]);
  };

  const patchThread = useCallback(
    (threadId: string, updater: (th: ChatThread) => ChatThread, base?: ChatThread[]) => {
      const list = base ?? threads;
      const next = list.map((th) => (th.id === threadId ? updater(th) : th));
      void persist(next);
      return next;
    },
    [threads, persist]
  );

  const sendText = async (text: string, threadId?: string, baseThreads?: ChatThread[]) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    const tid = threadId || activeId;
    if (!tid) return;

    const userMsg: ChatMessage = {
      id: msgId(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const list = baseThreads ?? threads;
    const th = list.find((x) => x.id === tid);
    if (!th) return;

    const withUser = patchThread(
      tid,
      (cur) => ({
        ...cur,
        title: cur.messages.length <= 1 ? trimmed.slice(0, 28) : cur.title,
        updatedAt: new Date().toISOString(),
        messages: [...cur.messages, userMsg],
      }),
      list
    );
    setDraft('');
    setPending([]);
    setTyping(true);

    try {
      const fresh = withUser.find((x) => x.id === tid)!;
      const apiMsgs = fresh.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const system = buildNoamSystem({ profile, ledger, period: currentPeriod() });
      const { reply, actions } = await sendToNoam({
        messages: apiMsgs,
        system,
      });

      const botMsg: ChatMessage = {
        id: msgId(),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      patchThread(tid, (cur) => ({
        ...cur,
        updatedAt: new Date().toISOString(),
        messages: [...cur.messages, botMsg],
      }));
      setPending(actions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      const botMsg: ChatMessage = {
        id: msgId(),
        role: 'assistant',
        content: `אופס — ${msg}`,
        createdAt: new Date().toISOString(),
      };
      patchThread(tid, (cur) => ({
        ...cur,
        messages: [...cur.messages, botMsg],
      }));
    } finally {
      setTyping(false);
    }
  };

  const rejectPending = () => {
    setPending([]);
    if (!activeId) return;
    const botMsg: ChatMessage = {
      id: msgId(),
      role: 'assistant',
      content: 'בסדר, לא מוסיף כלום. תגיד מה לתקן.',
      createdAt: new Date().toISOString(),
    };
    patchThread(activeId, (cur) => ({
      ...cur,
      messages: [...cur.messages, botMsg],
    }));
  };

  const applyPendingFixed = async () => {
    if (!pending.length || applying) return;
    const batch = [...pending];
    setApplying(true);
    try {
      const period = currentPeriod();
      await addEntries(
        batch.map((a) => ({
          period,
          kind: a.kind,
          category: a.category,
          amount: a.amount,
          note: a.note || `נועם · צ'אט`,
        }))
      );
      toast.success('נרשם בפנקס ✦', `${batch.length} תנועות`);
      setPending([]);
      if (activeId) {
        const botMsg: ChatMessage = {
          id: msgId(),
          role: 'assistant',
          content: t(
            profile.gender,
            `סגור. ${batch.length} תנועות בפנקס. רוצה שנבדוק כמה נשאר לתת?`,
            `סגור. ${batch.length} תנועות בפנקס. רוצה שנבדוק כמה נשאר לתת?`
          ),
          createdAt: new Date().toISOString(),
        };
        patchThread(activeId, (cur) => ({
          ...cur,
          messages: [...cur.messages, botMsg],
        }));
      }
    } catch {
      toast.error('לא נשמר', 'נסה שוב בעוד רגע');
    } finally {
      setApplying(false);
    }
  };

  if (!profile.onboardingDone) return null;

  return (
    <>
      {!open ? (
        <Animated.View
          style={[
            styles.launcherWrap,
            { bottom: launcherBottom, transform: [{ scale: launcherPulse }] },
          ]}
        >
          <Pressable
            onPress={openMessenger}
            accessibilityLabel={`פתח צ'אט עם ${BOT_NAME}`}
            style={({ pressed }) => [styles.launcher, pressed && styles.launcherPressed]}
          >
            <LinearGradient
              colors={[...colors.primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.launcherGrad}
            >
              <Text style={styles.launcherGlyph}>💬</Text>
            </LinearGradient>
            <View style={styles.launcherBadge}>
              <Text style={styles.launcherBadgeTxt}>נ</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={closeMessenger}
        statusBarTranslucent
      >
        <View style={[styles.modalRoot, DIR]}>
          <Pressable style={styles.backdrop} onPress={closeMessenger} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 10) }]}
          >
            {Platform.OS !== 'web' ? (
              <BlurView
                intensity={Platform.OS === 'ios' ? 50 : 28}
                tint="systemChromeMaterialDark"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View
              style={[
                styles.sheetGlass,
                Platform.OS === 'web'
                  ? ({
                      backdropFilter: 'blur(28px)',
                      WebkitBackdropFilter: 'blur(28px)',
                    } as object)
                  : null,
              ]}
            />

            {mode === 'home' ? (
              <HomePane
                name={name}
                gender={profile.gender}
                onClose={closeMessenger}
                onNew={() => startNewChat()}
                onHistory={() => setMode('history')}
                onQuick={(q) => startNewChat(q)}
              />
            ) : null}

            {mode === 'history' ? (
              <HistoryPane
                threads={threads}
                onClose={closeMessenger}
                onBack={() => setMode('home')}
                onOpen={openThread}
                onNew={() => startNewChat()}
              />
            ) : null}

            {mode === 'chat' ? (
              <ChatPane
                name={name}
                messages={messages}
                draft={draft}
                setDraft={setDraft}
                typing={typing}
                pending={pending}
                applying={applying}
                scrollRef={scrollRef}
                onClose={closeMessenger}
                onBack={() => {
                  setMode('home');
                  setPending([]);
                }}
                onSend={() => void sendText(draft)}
                onQuick={(q) => void sendText(q)}
                onApply={() => void applyPendingFixed()}
                onReject={rejectPending}
                gender={profile.gender}
              />
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

function HomePane({
  name,
  gender,
  onClose,
  onNew,
  onHistory,
  onQuick,
}: {
  name: string;
  gender: 'male' | 'female';
  onClose: () => void;
  onNew: () => void;
  onHistory: () => void;
  onQuick: (q: string) => void;
}) {
  return (
    <View style={styles.pane}>
      <LinearGradient
        colors={['rgba(139,155,255,0.55)', 'rgba(167,139,250,0.28)', 'rgba(11,16,32,0)']}
        locations={[0, 0.45, 1]}
        style={styles.homeHero}
      >
        <View style={styles.homeTopRow}>
          <GlassCloseButton onPress={onClose} />
          <View style={styles.onlinePill}>
            <View style={styles.onlineDotSm} />
            <Text style={styles.onlineTxt}>זמין</Text>
          </View>
        </View>
        <View style={styles.homeHeroCenter}>
          <NoamAvatar size={72} glow />
          <Text style={styles.hello}>שלום {name} 👋</Text>
          <Text style={styles.homeTitle}>שיחות עם {BOT_NAME}</Text>
          <Text style={styles.homeSub}>אני מלווה אותך במעשר — עושה סדר במספרים, בקצב שלך</Text>
        </View>
        <View style={styles.seg}>
          <Pressable onPress={onNew} style={[styles.segBtn, styles.segActive]}>
            <Text style={[styles.segTxt, styles.segTxtActive]}>שיחה חדשה</Text>
          </Pressable>
          <Pressable onPress={onHistory} style={styles.segBtn}>
            <Text style={styles.segTxt}>היסטוריה</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.homeBody} showsVerticalScrollIndicator={false}>
        <Text style={styles.wantTalk}>
          {t(gender, `${name}, רוצה לעשות סדר?`, `${name}, רוצה לעשות סדר?`)}
        </Text>
        <Text style={styles.wantSub}>
          תכתוב מה נכנס ומה יצא — {BOT_NAME} מחשב, מסכם, ומציע מה לרשום בפנקס.
        </Text>

        <Pressable onPress={onNew} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaIcon}>✦</Text>
          <Text style={styles.ctaTxt}>התחל שיחה חדשה</Text>
        </Pressable>

        <Text style={styles.orLabel}>או התחילו מ־</Text>
        {QUICK_STARTS.slice(0, 2).map((q) => (
          <Pressable
            key={q}
            onPress={() => onQuick(q)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipTxt}>{q}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function HistoryPane({
  threads,
  onClose,
  onBack,
  onOpen,
  onNew,
}: {
  threads: ChatThread[];
  onClose: () => void;
  onBack: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <View style={styles.pane}>
      <View style={styles.chatHeader}>
        <GlassCloseButton onPress={onClose} />
        <View style={styles.chatHeaderMid}>
          <Text style={styles.chatHeaderTitle}>היסטוריה</Text>
          <Text style={styles.chatHeaderSub}>שיחות קודמות עם {BOT_NAME}</Text>
        </View>
        <Pressable onPress={onBack} style={styles.headerIconBtn} accessibilityLabel="חזרה">
          <Text style={styles.headerIconTxt}>›</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.historyList}>
        {threads.length === 0 ? (
          <Text style={styles.emptyHist}>עדיין אין שיחות. יאללה — שיחה ראשונה.</Text>
        ) : (
          threads.map((th) => (
            <Pressable key={th.id} onPress={() => onOpen(th.id)} style={styles.histRow}>
              <NoamAvatar size={36} />
              <View style={styles.histMeta}>
                <Text style={styles.histTitle} numberOfLines={1}>
                  {th.title}
                </Text>
                <Text style={styles.histDate}>
                  {new Date(th.updatedAt).toLocaleString('he-IL', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
      <Pressable onPress={onNew} style={styles.cta}>
        <Text style={styles.ctaTxt}>שיחה חדשה</Text>
      </Pressable>
    </View>
  );
}

function ChatPane({
  name,
  messages,
  draft,
  setDraft,
  typing,
  pending,
  applying,
  scrollRef,
  onClose,
  onBack,
  onSend,
  onQuick,
  onApply,
  onReject,
  gender,
}: {
  name: string;
  messages: ChatMessage[];
  draft: string;
  setDraft: (s: string) => void;
  typing: boolean;
  pending: ProposedEntry[];
  applying: boolean;
  scrollRef: React.RefObject<ScrollView | null>;
  onClose: () => void;
  onBack: () => void;
  onSend: () => void;
  onQuick: (q: string) => void;
  onApply: () => void;
  onReject: () => void;
  gender: 'male' | 'female';
}) {
  return (
    <View style={styles.pane}>
      <LinearGradient
        colors={['rgba(102,119,240,0.42)', 'rgba(27,22,72,0.92)']}
        style={styles.chatHeaderGrad}
      >
        <View style={styles.chatHeader}>
          <GlassCloseButton onPress={onClose} />
          <View style={styles.chatHeaderPerson}>
            <NoamAvatar size={40} />
            <View>
              <Text style={styles.chatHeaderTitle}>{BOT_NAME}</Text>
              <View style={styles.onlineInline}>
                <View style={styles.onlineDotSm} />
                <Text style={styles.onlineTxt}>זמין · מנטור מעשר</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onBack} style={styles.headerIconBtn} accessibilityLabel="חזרה">
            <Text style={styles.headerIconTxt}>›</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.msgScroll}
        contentContainerStyle={styles.msgList}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.chatIntro}>
          <NoamAvatar size={64} glow />
          <Text style={styles.chatIntroTitle}>אני כאן איתך</Text>
          <Text style={styles.chatIntroSub}>
            כתוב מה נכנס ומה יצא — נבנה יחד את הפנקס, בקצב שלך.
          </Text>
        </View>

        {messages.map((m) => {
          const isMe = m.role === 'user';
          return (
            <View
              key={m.id}
              style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowBot]}
            >
              {!isMe ? (
                <View style={styles.bubbleAvatar}>
                  <NoamAvatar size={28} />
                </View>
              ) : null}
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleBot]}>
                <Text style={[styles.bubbleTxt, isMe && styles.bubbleTxtMe]}>{m.content}</Text>
              </View>
            </View>
          );
        })}

        {typing ? <TypingDots /> : null}

        {pending.length > 0 ? (
          <View style={styles.proposeCard}>
            <Text style={styles.proposeTitle}>להוסיף לפנקס?</Text>
            {pending.map((a, i) => (
              <Text key={`${a.kind}-${i}`} style={styles.proposeLine}>
                · {kindLabel(a.kind, gender)} · {a.category} · {formatMoney(a.amount)}
              </Text>
            ))}
            <View style={styles.proposeActions}>
              <Pressable
                onPress={onApply}
                disabled={applying}
                style={[styles.proposeYes, applying && { opacity: 0.6 }]}
              >
                {applying ? (
                  <ActivityIndicator color={colors.primaryOn} />
                ) : (
                  <Text style={styles.proposeYesTxt}>אשר והוסף</Text>
                )}
              </Pressable>
              <Pressable onPress={onReject} style={styles.proposeNo}>
                <Text style={styles.proposeNoTxt}>לא עכשיו</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {!typing && messages.length <= 2 ? (
        <View style={styles.quickRow}>
          {QUICK_STARTS.slice(2).map((q) => (
            <Pressable key={q} onPress={() => onQuick(q)} style={styles.quickChip}>
              <Text style={styles.quickChipTxt}>{q}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.privacy}>
        ⚠ לפני שליחה: בלי פרטים מזהים. העיבוד דרך ספקי AI בינלאומיים (OpenRouter).
      </Text>

      <View style={styles.inputRow}>
        <Pressable
          onPress={onSend}
          disabled={!draft.trim() || typing}
          style={[styles.sendBtn, (!draft.trim() || typing) && styles.sendDisabled]}
          accessibilityLabel="שלח"
        >
          <Text style={styles.sendGlyph}>➤</Text>
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`כתוב ל${BOT_NAME} מה עובר עליך במספרים…`}
          placeholderTextColor={colors.inkSoft}
          style={styles.input}
          multiline
          maxLength={2000}
          onSubmitEditing={onSend}
          blurOnSubmit={false}
        />
      </View>
      <Text style={styles.inputHint}>{name} · מעשר ישר</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  launcherWrap: {
    position: 'absolute',
    end: 14,
    zIndex: 60,
  },
  launcher: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(102,119,240,0.5)' } as object,
      default: { ...shadow.fab },
    }),
  },
  launcherPressed: { transform: [{ scale: 0.96 }] },
  launcherGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launcherGlyph: { fontSize: 22 },
  launcherBadge: {
    position: 'absolute',
    top: -2,
    start: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  launcherBadgeTxt: {
    fontFamily: fonts.extra,
    fontSize: 11,
    color: colors.inkDark,
  },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '94%',
    minHeight: '72%',
    marginHorizontal: Platform.OS === 'web' ? 8 : 0,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(14,18,34,0.88)',
  },
  sheetGlass: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(196,181,253,0.05)',
  },
  pane: { flex: 1 },

  avatarOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarGlow: {
    ...Platform.select({
      web: { boxShadow: '0 0 28px rgba(139,155,255,0.55)' } as object,
      default: {
        shadowColor: colors.primary,
        shadowOpacity: 0.55,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarLetter: {
    fontFamily: fonts.displayExtra,
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    end: 2,
    bottom: 2,
    backgroundColor: '#5EEAD4',
    borderWidth: 2,
    borderColor: colors.bg,
  },

  homeHero: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  homeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  homeHeroCenter: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 4,
  },
  hello: {
    ...type.body,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },
  homeTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: 26,
    color: colors.ink,
    textAlign: 'center',
  },
  homeSub: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  onlineDotSm: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5EEAD4',
  },
  onlineTxt: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: colors.inkMuted,
  },
  onlineInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: radii.pill,
    padding: 4,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  segActive: {
    backgroundColor: colors.primary,
  },
  segTxt: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.inkSoft,
  },
  segTxtActive: { color: colors.primaryOn },

  homeBody: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'stretch',
    gap: 10,
  },
  wantTalk: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
  },
  wantSub: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'rgba(139,155,255,0.12)',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...Platform.select({
      web: { boxShadow: '0 0 22px rgba(139,155,255,0.35)' } as object,
      default: {
        shadowColor: colors.primary,
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  ctaPressed: { transform: [{ scale: 0.98 }] },
  ctaIcon: { fontSize: 18, color: colors.gold },
  ctaTxt: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
  },
  orLabel: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  chipPressed: { backgroundColor: 'rgba(255,255,255,0.1)' },
  chipTxt: {
    fontFamily: fonts.semi,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
  },

  chatHeaderGrad: {
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  chatHeaderMid: { flex: 1, alignItems: 'center' },
  chatHeaderPerson: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  chatHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  chatHeaderSub: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerIconTxt: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 24,
  },

  msgScroll: { flex: 1 },
  msgList: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: 12,
  },
  chatIntro: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: 6,
  },
  chatIntroTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  chatIntroSub: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '100%',
  },
  bubbleRowBot: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  bubbleRowMe: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    flexDirection: 'row-reverse',
  },
  bubbleAvatar: {
    marginBottom: 2,
    flexShrink: 0,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 1,
    flexGrow: 0,
    maxWidth: '100%',
  },
  bubbleBot: {
    backgroundColor: colors.chatBot,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomStartRadius: 6,
  },
  bubbleMe: {
    backgroundColor: colors.chatMe,
    borderBottomEndRadius: 6,
  },
  bubbleTxt: {
    ...type.chat,
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  bubbleTxtMe: {
    ...type.chatMe,
    color: colors.chatMeText,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.chatBot,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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

  proposeCard: {
    marginTop: 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassGoldBorder,
    backgroundColor: colors.goldSoft,
    padding: spacing.md,
    gap: 4,
  },
  proposeTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.gold,
    marginBottom: 4,
  },
  proposeLine: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  proposeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  proposeYes: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  proposeYesTxt: {
    fontFamily: fonts.bold,
    color: colors.primaryOn,
    fontSize: 14,
  },
  proposeNo: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 12,
    alignItems: 'center',
  },
  proposeNoTxt: {
    fontFamily: fonts.semi,
    color: colors.inkMuted,
    fontSize: 14,
  },

  quickRow: {
    paddingHorizontal: spacing.md,
    gap: 8,
    paddingBottom: 4,
  },
  quickChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  quickChipTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  privacy: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.gold,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: 6,
    opacity: 0.9,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  sendDisabled: { opacity: 0.4 },
  sendGlyph: {
    color: colors.primaryOn,
    fontSize: 18,
    fontFamily: fonts.bold,
    transform: [{ scaleX: -1 }],
  },
  inputHint: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 4,
  },

  historyList: {
    padding: spacing.md,
    gap: 10,
    flexGrow: 1,
  },
  emptyHist: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  histMeta: { flex: 1 },
  histTitle: {
    fontFamily: fonts.semi,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'right',
  },
  histDate: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'right',
    marginTop: 2,
  },
});
