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
  Linking,
  useWindowDimensions,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCloseButton } from './Glass';
import { InlineLoader } from './LoadingScreen';
import { useMotionEnabled } from '../hooks/useMotionEnabled';
import { NATIVE_DRIVER } from '../utils/motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BOT_NAME, friendWord, t } from '../utils/copy';
import { NOAM_AI_DISCLOSURE_LINE } from '../constants/noamDisclosure';
import { currentPeriod, defaultDateFor, formatPeriod } from '../utils/history';
import { parseMoney } from '../utils/money';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';
import { DIR, rtlDomProps } from '../rtl';
import {
  QUICK_STARTS,
  buildNoamContext,
  clearAllThreads,
  kindLabel,
  loadThreads,
  messagesForModel,
  msgId,
  newThreadId,
  NoamHttpError,
  saveThreads,
  sendToNoam,
  type ChatMessage,
  type ChatThread,
  type ConfirmedProposal,
  type ProposedEntry,
} from '../ai/noam';
import { noamChatWelcome } from '../utils/noamCompanion';
import { entriesLabel } from '../utils/plural';
import { formatRelativeTime } from '../utils/relativeTime';
import { entriesForPeriod } from '../utils/ledger';
import { resolvePeriodTotals } from '../utils/totalsAdvanced';
import { RichMessageText } from './RichMessageText';
import { PRIVACY_LINK_LABEL, privacyPageUrl } from '../constants/privacy';
import { useNoamChat } from '../navigation/NoamChatContext';

type ViewMode = 'home' | 'chat' | 'history';

/** N-17: דסקטופ — פאנל צד ~400px ליד עמודת האפליקציה */
const DESKTOP_BREAKPOINT = 1000;
const DESKTOP_CHAT_WIDTH = 400;

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

function TypingDots({ slowHint }: { slowHint?: boolean }) {
  const run = useMotionEnabled();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!run) {
      a.setValue(0.55);
      b.setValue(0.55);
      c.setValue(0.55);
      return;
    }
    const bounce = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: NATIVE_DRIVER, easing: Easing.out(Easing.quad) }),
          Animated.timing(v, { toValue: 0, duration: 280, useNativeDriver: NATIVE_DRIVER, easing: Easing.in(Easing.quad) }),
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
  }, [a, b, c, run]);

  const lift = (v: Animated.Value) => ({
    transform: [
      {
        translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }),
      },
    ],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
  });

  return (
    <View style={styles.typingRow} accessibilityLabel={slowHint ? 'רק רגע…' : `${BOT_NAME} מקליד`}>
      <NoamAvatar size={28} />
      <View style={styles.typingBubble}>
        {slowHint ? (
          <Text style={styles.typingHint}>רק רגע…</Text>
        ) : (
          <>
            <Animated.View style={[styles.dot, lift(a)]} />
            <Animated.View style={[styles.dot, lift(b)]} />
            <Animated.View style={[styles.dot, lift(c)]} />
          </>
        )}
      </View>
    </View>
  );
}

function formatMoney(n: number) {
  return `₪${Math.round(n).toLocaleString('he-IL')}`;
}

/** N-17: פס סכומים קבוע — אותם מספרים כמו במסך הבית */
function TotalsBar({
  obligation,
  tzedaka,
  remaining,
}: {
  obligation: number;
  tzedaka: number;
  remaining: number;
}) {
  return (
    <View
      style={styles.totalsBar}
      accessibilityRole="summary"
      accessibilityLabel={`חובה ${formatMoney(obligation)}, ניתן ${formatMoney(tzedaka)}, נותר ${formatMoney(remaining)}`}
    >
      <View style={styles.totalsCell}>
        <Text style={styles.totalsLabel}>חובה</Text>
        <Text style={styles.totalsValue} testID="chat-obligation">
          {formatMoney(obligation)}
        </Text>
      </View>
      <View style={styles.totalsSep} />
      <View style={styles.totalsCell}>
        <Text style={styles.totalsLabel}>ניתן</Text>
        <Text style={styles.totalsValue} testID="chat-tzedaka">
          {formatMoney(tzedaka)}
        </Text>
      </View>
      <View style={styles.totalsSep} />
      <View style={styles.totalsCell}>
        <Text style={styles.totalsLabel}>נותר</Text>
        <Text style={[styles.totalsValue, styles.totalsRemain]} testID="chat-remaining">
          {formatMoney(remaining)}
        </Text>
      </View>
    </View>
  );
}

export default function NoamChat() {
  const { profile, ledger, addEntries, patchProfile } = useApp();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { open, openChat, closeChat } = useNoamChat();
  const [mode, setMode] = useState<ViewMode>('home');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [pending, setPending] = useState<ProposedEntry[]>([]);
  const [applying, setApplying] = useState(false);
  /** נעילת שליחה אחרי 429 (60 שניות) */
  const [sendLockedUntil, setSendLockedUntil] = useState(0);
  const [sendLockTick, setSendLockTick] = useState(0);
  /** N-17 מובייל: חצי מסך שניתן להרחבה */
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const threadsRef = useRef<ChatThread[]>(threads);
  const sendingRef = useRef(false);
  const pendingSeedRef = useRef<{ text: string; threadId: string } | null>(null);
  /** N-03: תמיד הפנקס העדכני — גם מיד אחרי אישור כרטיס / מחיקה בבית */
  const ledgerRef = useRef(ledger);
  const profileRef = useRef(profile);
  /** NEW-1: עד 3 תנועות שאושרו בכרטיסים בשיחה הנוכחית */
  const confirmedRef = useRef<ConfirmedProposal[]>([]);
  const motionOk = useMotionEnabled();

  const isDesktopDock =
    Platform.OS === 'web' && windowWidth >= DESKTOP_BREAKPOINT;

  useEffect(() => {
    ledgerRef.current = ledger;
  }, [ledger]);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const sendLocked = sendLockedUntil > Date.now();
  useEffect(() => {
    if (!sendLockedUntil) return;
    const left = sendLockedUntil - Date.now();
    if (left <= 0) {
      setSendLockedUntil(0);
      return;
    }
    const t = setTimeout(() => {
      setSendLockedUntil(0);
      setSendLockTick((n) => n + 1);
    }, left);
    return () => clearTimeout(t);
  }, [sendLockedUntil, sendLockTick]);

  /** N-18: אחרי 5ש׳ בלי תשובה — «רק רגע…» */
  useEffect(() => {
    if (!typing) {
      setSlowHint(false);
      return;
    }
    const tmr = setTimeout(() => setSlowHint(true), 5000);
    return () => clearTimeout(tmr);
  }, [typing]);

  const setOpen = (v: boolean) => {
    if (v) openChat();
    else closeChat();
  };

  const name = profile.displayName || friendWord(profile.gender);
  const active = useMemo(
    () => threads.find((th) => th.id === activeId) || null,
    [threads, activeId]
  );
  const messages = active?.messages ?? [];

  /** N-17: סכומים חיים מהפנקס — מתעדכנים אחרי אישור כרטיס */
  const liveTotals = useMemo(() => {
    const period = currentPeriod();
    return resolvePeriodTotals(
      ledger,
      period,
      profile,
      !!profile.carryForwardSurplus
    );
  }, [ledger, profile]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    loadThreads().then((list) => {
      if (profileRef.current.saveChatHistory === false) {
        setThreads([]);
        void clearAllThreads();
        return;
      }
      setThreads(list);
    });
  }, []);

  /** N-16: כשכיבוי שמירה — מנקים בסגירת חלון / רקע */
  useEffect(() => {
    const saveOn = profile.saveChatHistory !== false;
    if (saveOn) return;

    const wipe = () => {
      threadsRef.current = [];
      setThreads([]);
      setActiveId(null);
      void clearAllThreads();
    };

    const onAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') wipe();
    };
    const sub = AppState.addEventListener('change', onAppState);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onHide = () => wipe();
      window.addEventListener('pagehide', onHide);
      window.addEventListener('beforeunload', onHide);
      return () => {
        sub.remove();
        window.removeEventListener('pagehide', onHide);
        window.removeEventListener('beforeunload', onHide);
      };
    }

    return () => sub.remove();
  }, [profile.saveChatHistory]);

  useEffect(() => {
    if (!open || mode !== 'chat') return;
    const tmr = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: motionOk }),
      80
    );
    return () => clearTimeout(tmr);
  }, [messages, typing, pending, open, mode, motionOk]);

  useEffect(() => {
    if (!open) setSheetExpanded(false);
  }, [open]);

  const persist = useCallback(async (next: ChatThread[]) => {
    threadsRef.current = next;
    setThreads(next);
    if (profileRef.current.saveChatHistory === false) {
      await clearAllThreads();
      return;
    }
    await saveThreads(next);
  }, []);

  const deleteThread = useCallback(
    (id: string) => {
      toast.confirm({
        title: 'למחוק את השיחה?',
        message: 'השיחה תימחק מהמכשיר ולא תופיע אחרי רענון.',
        confirmLabel: 'מחק',
        onConfirm: async () => {
          const next = threadsRef.current.filter((th) => th.id !== id);
          if (activeId === id) {
            setActiveId(null);
            setMode('history');
          }
          await persist(next);
          toast.info('השיחה נמחקה');
        },
      });
    },
    [activeId, persist, toast]
  );

  const deleteAllThreads = useCallback(() => {
    toast.confirm({
      title: 'למחוק את כל השיחות?',
      message: 'כל היסטוריית הצ׳אט עם נועם תימחק מהמכשיר.',
      confirmLabel: 'מחק הכל',
      onConfirm: async () => {
        setActiveId(null);
        setMode('history');
        await persist([]);
        toast.info('כל השיחות נמחקו');
      },
    });
  }, [persist, toast]);

  const closeMessenger = () => {
    setOpen(false);
    setTyping(false);
    setDraft('');
    sendingRef.current = false;
    if (profileRef.current.saveChatHistory === false) {
      threadsRef.current = [];
      setThreads([]);
      setActiveId(null);
      void clearAllThreads();
    }
  };

  const startNewChat = (seed?: string) => {
    const id = newThreadId();
    const period = currentPeriod();
    const month = entriesForPeriod(ledger, period);
    const totals = resolvePeriodTotals(
      ledger,
      period,
      profile,
      !!profile.carryForwardSurplus
    );
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
    const next = [th, ...threadsRef.current];
    void persist(next);
    setActiveId(id);
    setMode('chat');
    setPending([]);
    confirmedRef.current = [];
    // זרע הודעה רק אחרי הסכמה — אחרת מסך ההסכמה יופיע קודם
    if (seed) {
      if (profile.chatConsentDone) {
        setTimeout(() => void sendText(seed, id), 320);
      } else {
        pendingSeedRef.current = { text: seed, threadId: id };
      }
    }
  };

  const openThread = (id: string) => {
    setActiveId(id);
    setMode('chat');
    setPending([]);
    confirmedRef.current = [];
  };

  const patchThread = useCallback(
    (threadId: string, updater: (th: ChatThread) => ChatThread) => {
      const list = threadsRef.current;
      const next = list.map((th) => (th.id === threadId ? updater(th) : th));
      threadsRef.current = next;
      setThreads(next);
      if (profileRef.current.saveChatHistory === false) {
        void clearAllThreads();
      } else {
        void saveThreads(next);
      }
      return next;
    },
    []
  );

  const sendText = async (
    text: string,
    threadId?: string,
    opts?: { shareTotals?: boolean }
  ) => {
    const trimmed = text.trim();
    if (!trimmed || typing || sendingRef.current || sendLockedUntil > Date.now()) return;
    if (!profile.chatConsentDone && opts?.shareTotals === undefined) {
      // ממתין למסך הסכמה
      return;
    }
    const tid = threadId || activeId;
    if (!tid) return;

    const list = threadsRef.current;
    const th = list.find((x) => x.id === tid);
    if (!th) return;

    sendingRef.current = true;
    const userMsg: ChatMessage = {
      id: msgId(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const withUser = patchThread(tid, (cur) => ({
      ...cur,
      title: cur.messages.length <= 1 ? trimmed.slice(0, 28) : cur.title,
      updatedAt: new Date().toISOString(),
      messages: [...cur.messages, userMsg],
    }));
    setDraft('');
    setPending([]);
    setTyping(true);

    try {
      const fresh = withUser.find((x) => x.id === tid)!;
      // N-02: הודעות system מהאפליקציה לא חוזרות למודל כנועם
      const apiMsgs = messagesForModel(fresh.messages);
      // N-03: context מהפנקס החי (refs) — מקור אמת יחיד בכל בקשה
      const liveProfile = profileRef.current;
      const liveLedger = ledgerRef.current;
      const share = opts?.shareTotals ?? liveProfile.chatShareTotals;
      const context = share
        ? buildNoamContext({
            profile: liveProfile,
            ledger: liveLedger,
            period: currentPeriod(),
          })
        : null;
      const confirmed = share ? confirmedRef.current.slice(0, 3) : null;
      const { reply, actions } = await sendToNoam({
        messages: apiMsgs,
        context,
        gender: liveProfile.gender,
        confirmed,
      });

      const botMsg: ChatMessage = {
        id: msgId(),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      // תמיד על בסיס threadsRef — לא סוגרים על state ישן
      patchThread(tid, (cur) => {
        const alreadyHasUser = cur.messages.some((m) => m.id === userMsg.id);
        const baseMsgs = alreadyHasUser ? cur.messages : [...cur.messages, userMsg];
        return {
          ...cur,
          updatedAt: new Date().toISOString(),
          messages: [...baseMsgs, botMsg],
        };
      });
      // D.4: כרטיס רק לסכומים חיוביים תקינים
      setPending(
        actions.filter(
          (a) => Number.isFinite(a.amount) && a.amount > 0 && a.amount < 1e8
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      const httpErr = err instanceof NoamHttpError ? err : null;
      if (httpErr?.status === 429) {
        setSendLockedUntil(Date.now() + 60_000);
      }
      const offline = msg === 'אין חיבור';
      const retry = msg === 'נסה שוב' || /נסה שוב/i.test(msg);
      // 429 / ai_disabled / ai_daily_limit — טקסט השרת כבועה רגילה (בלי «אופס —»)
      const content = httpErr?.asBubble
        ? msg
        : offline
          ? 'אין חיבור'
          : retry
            ? 'נסה שוב'
            : `אופס — ${msg}`;
      const botMsg: ChatMessage = {
        id: msgId(),
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
      };
      patchThread(tid, (cur) => {
        const alreadyHasUser = cur.messages.some((m) => m.id === userMsg.id);
        const baseMsgs = alreadyHasUser ? cur.messages : [...cur.messages, userMsg];
        return {
          ...cur,
          messages: [...baseMsgs, botMsg],
        };
      });
    } finally {
      setTyping(false);
      sendingRef.current = false;
    }
  };

  const acceptChatConsent = async (shareTotals: boolean) => {
    await patchProfile({ chatConsentDone: true, chatShareTotals: shareTotals });
    const pending = pendingSeedRef.current;
    pendingSeedRef.current = null;
    if (pending) {
      setTimeout(() => void sendText(pending.text, pending.threadId, { shareTotals }), 220);
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
      const fallbackPeriod = currentPeriod();
      const noteBase = `נועם · צ'אט`;
      const payloads = batch
        .map((a) => {
          const parsed = parseMoney(String(a.amount));
          if (!parsed.ok) return null;
          const period =
            a.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(a.period)
              ? a.period
              : fallbackPeriod;
          return {
            period,
            kind: a.kind,
            category: a.category,
            amount: parsed.value,
            note: a.note || noteBase,
            date: defaultDateFor(period),
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null);
      if (!payloads.length) {
        toast.error('סכום לא תקין', 'לא ניתן להוסיף תנועה עם סכום שלילי או אפס');
        setPending([]);
        return;
      }
      // A: מקור אמת יחיד — snapshot לפני await; אם ledgerRef גדל בזמן ה־await
      // (useEffect אחרי persist) משתמשים בו לבד, אחרת ממזגים פעם אחת מ־addEntries.
      const snapshotLen = ledgerRef.current.length;
      const fromAdd = await addEntries(payloads);
      const nextLedger =
        ledgerRef.current.length > snapshotLen
          ? ledgerRef.current
          : fromAdd;
      ledgerRef.current = nextLedger;
      const afterCtx = buildNoamContext({
        profile: profileRef.current,
        ledger: nextLedger,
        period: fallbackPeriod,
      });
      // B: שמירת עד 3 תנועות שאושרו בשיחה (בלי הערות)
      const justConfirmed: ConfirmedProposal[] = payloads.map((p) => ({
        kind: p.kind,
        category: p.category,
        amount: p.amount,
        period: p.period,
      }));
      confirmedRef.current = [...justConfirmed, ...confirmedRef.current].slice(
        0,
        3
      );
      toast.success('נרשם בפנקס ✦', entriesLabel(payloads.length));
      setPending([]);
      if (activeId) {
        // N-02: שורת מערכת מהאפליקציה — לא נשלחת למודל כהודעת נועם
        const lines = payloads.map((p) => {
          return `נוסף לפנקס: ${kindLabel(p.kind, profile.gender)} · ${p.category} · ${formatMoney(p.amount)} · נרשם ל: ${formatPeriod(p.period)}`;
        });
        lines.push(`נותר עכשיו לפי הפנקס: ${formatMoney(afterCtx.remaining)}`);
        const sysMsg: ChatMessage = {
          id: msgId(),
          role: 'system',
          content: lines.join('\n'),
          createdAt: new Date().toISOString(),
        };
        patchThread(activeId, (cur) => ({
          ...cur,
          messages: [...cur.messages, sysMsg],
        }));
      }
    } catch {
      toast.error('לא נשמר', 'נסה שוב בעוד רגע');
    } finally {
      setApplying(false);
    }
  };

  if (!profile.onboardingDone) return null;

  const sheetBody = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.sheet,
        isDesktopDock
          ? styles.sheetDock
          : {
              paddingBottom: Math.max(insets.bottom, 10),
              maxHeight: sheetExpanded ? '94%' : '52%',
              minHeight: sheetExpanded ? '72%' : '48%',
              maxWidth: 480,
              width: '100%',
              alignSelf: 'center',
            },
      ]}
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

      {!isDesktopDock ? (
        <Pressable
          onPress={() => setSheetExpanded((v) => !v)}
          style={styles.expandHandle}
          accessibilityRole="button"
          accessibilityLabel={sheetExpanded ? 'הקטן את חלון הצ׳אט' : 'הרחב את חלון הצ׳אט'}
        >
          <View style={styles.expandPill} />
          <Text style={styles.expandHint}>
            {sheetExpanded ? 'הקטן' : 'הרחב'}
          </Text>
        </Pressable>
      ) : null}

      <TotalsBar
        obligation={liveTotals.obligation}
        tzedaka={liveTotals.tzedaka}
        remaining={liveTotals.remaining}
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
          onDelete={deleteThread}
          onDeleteAll={deleteAllThreads}
        />
      ) : null}

      {mode === 'chat' ? (
        <ChatPane
          name={name}
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          typing={typing}
          slowHint={slowHint}
          pending={pending}
          applying={applying}
          sendLocked={sendLocked}
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
          needsConsent={!profile.chatConsentDone}
          defaultShareTotals={profile.chatShareTotals !== false}
          onConsent={(share) => void acceptChatConsent(share)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );

  // N-17 דסקטופ: פאנל צד בלי Modal שמכסה את הפנקס
  if (isDesktopDock) {
    if (!open) return null;
    return (
      <View
        style={[styles.dockRoot, DIR]}
        {...rtlDomProps}
        accessibilityViewIsModal
      >
        {sheetBody}
      </View>
    );
  }

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={closeMessenger}
      statusBarTranslucent
    >
      <View style={[styles.modalRoot, DIR]} {...rtlDomProps}>
        <Pressable style={styles.backdrop} onPress={closeMessenger} />
        {sheetBody}
      </View>
    </Modal>
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
  gender: 'male' | 'female' | 'unspecified';
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
        {QUICK_STARTS.slice(0, 3).map((q) => (
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
  onDelete,
  onDeleteAll,
}: {
  threads: ChatThread[];
  onClose: () => void;
  onBack: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
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
            <View key={th.id} style={styles.histRow}>
              <Pressable
                onPress={() => onOpen(th.id)}
                style={styles.histRowMain}
                accessibilityRole="button"
                accessibilityLabel={th.title}
              >
                <NoamAvatar size={36} />
                <View style={styles.histMeta}>
                  <Text style={styles.histTitle} numberOfLines={1}>
                    {th.title}
                  </Text>
                  <Text style={styles.histDate}>{formatRelativeTime(th.updatedAt)}</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => onDelete(th.id)}
                style={styles.histDeleteBtn}
                accessibilityRole="button"
                accessibilityLabel={`מחק שיחה ${th.title}`}
              >
                <Text style={styles.histDeleteTxt}>מחק</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
      {threads.length > 0 ? (
        <Pressable
          onPress={onDeleteAll}
          style={styles.deleteAllBtn}
          accessibilityRole="button"
          accessibilityLabel="מחק את כל השיחות"
        >
          <Text style={styles.deleteAllTxt}>מחק את כל השיחות</Text>
        </Pressable>
      ) : null}
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
  slowHint,
  pending,
  applying,
  sendLocked,
  scrollRef,
  onClose,
  onBack,
  onSend,
  onQuick,
  onApply,
  onReject,
  gender,
  needsConsent,
  defaultShareTotals,
  onConsent,
}: {
  name: string;
  messages: ChatMessage[];
  draft: string;
  setDraft: (s: string) => void;
  typing: boolean;
  slowHint: boolean;
  pending: ProposedEntry[];
  applying: boolean;
  sendLocked: boolean;
  scrollRef: React.RefObject<ScrollView | null>;
  onClose: () => void;
  onBack: () => void;
  onSend: () => void;
  onQuick: (q: string) => void;
  onApply: () => void;
  onReject: () => void;
  gender: 'male' | 'female' | 'unspecified';
  needsConsent: boolean;
  defaultShareTotals: boolean;
  onConsent: (shareTotals: boolean) => void;
}) {
  const [shareChoice, setShareChoice] = useState(defaultShareTotals);

  /** N-17: Enter שולח, Shift+Enter שורה חדשה */
  const onComposerKey = (e: {
    nativeEvent?: { key?: string; shiftKey?: boolean };
    key?: string;
    shiftKey?: boolean;
    preventDefault?: () => void;
  }) => {
    const key = e?.nativeEvent?.key ?? e?.key;
    const shift = e?.nativeEvent?.shiftKey ?? e?.shiftKey;
    if (key === 'Enter' && !shift) {
      e.preventDefault?.();
      onSend();
    }
  };

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
                <Text style={styles.onlineTxt}>זמין · נועם · מנטור מעשר</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onBack} style={styles.headerIconBtn} accessibilityLabel="חזרה">
            <Text style={styles.headerIconTxt}>›</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <Text style={styles.aiDisclosure}>{NOAM_AI_DISCLOSURE_LINE}</Text>

      {needsConsent ? (
        <View style={styles.consentBox}>
          <Text style={styles.consentTitle}>לפני שמתחילים</Text>
          <Text style={styles.consentBody}>
            ההודעות נשלחות לשרת האפליקציה ואז לעיבוד ב־OpenRouter. לא נשלחים שם, הערות
            או רשימת תנועות בודדות. אפשר לבחור אם לצרף גם סיכום סכומי החודש (חובה / נותר וכו').
          </Text>
          <Pressable
            onPress={() => setShareChoice(true)}
            style={[styles.consentOpt, shareChoice && styles.consentOptOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: shareChoice }}
          >
            <Text style={styles.consentOptTxt}>שלח גם את סיכום החודש (מומלץ)</Text>
          </Pressable>
          <Pressable
            onPress={() => setShareChoice(false)}
            style={[styles.consentOpt, !shareChoice && styles.consentOptOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: !shareChoice }}
          >
            <Text style={styles.consentOptTxt}>רק את ההודעה שלי</Text>
          </Pressable>
          <Pressable
            onPress={() => onConsent(shareChoice)}
            style={styles.consentCta}
            accessibilityRole="button"
            accessibilityLabel="המשך לצ'אט"
          >
            <Text style={styles.consentCtaTxt}>הבנתי, בואו נדבר</Text>
          </Pressable>
          <Pressable
            onPress={() => void Linking.openURL(privacyPageUrl())}
            accessibilityRole="link"
            accessibilityLabel={PRIVACY_LINK_LABEL}
          >
            <Text style={styles.privacyLink}>{PRIVACY_LINK_LABEL} ‹</Text>
          </Pressable>
        </View>
      ) : null}
      {!needsConsent ? (
        <>
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
          if (m.role === 'system') {
            return (
              <View key={m.id} style={styles.systemRow} accessibilityRole="text">
                <Text style={styles.systemTxt}>{m.content}</Text>
              </View>
            );
          }
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
                <RichMessageText
                  content={m.content}
                  tone={isMe ? 'me' : 'bot'}
                  style={isMe ? styles.bubbleTxtMe : styles.bubbleTxt}
                />
              </View>
            </View>
          );
        })}

        {typing ? <TypingDots slowHint={slowHint} /> : null}
      </ScrollView>

      {/* N-01: כרטיס אישור מעל השדה — לא נגלל מחוץ למסך */}
      {pending.filter((a) => Number.isFinite(a.amount) && a.amount > 0).length >
      0 ? (
        <View style={styles.proposeCardSticky}>
          <Text style={styles.proposeTitle}>להוסיף לפנקס?</Text>
          {pending
            .filter((a) => Number.isFinite(a.amount) && a.amount > 0)
            .map((a, i) => {
            const p =
              a.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(a.period)
                ? a.period
                : currentPeriod();
            return (
              <Text key={`${a.kind}-${i}`} style={styles.proposeLine}>
                · {kindLabel(a.kind, gender)} · {a.category} · {formatMoney(a.amount)}
                {'\n'}נרשם ל: {formatPeriod(p)}
              </Text>
            );
          })}
          <View style={styles.proposeActions}>
            <Pressable
              onPress={onApply}
              disabled={applying}
              style={[styles.proposeYes, applying && { opacity: 0.6 }]}
            >
              {applying ? (
                <InlineLoader color={colors.primaryOn} size={16} label="מוסיף תנועות" />
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

      {!typing && messages.length <= 2 && pending.length === 0 ? (
        <View style={styles.quickRow}>
          {QUICK_STARTS.slice(2).map((q) => (
            <Pressable key={q} onPress={() => onQuick(q)} style={styles.quickChip}>
              <Text style={styles.quickChipTxt}>{q}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.privacy}>
        {'⚠ ההודעות נשלחות לשרת לעיבוד AI. לא נשלחים שם, הערות או רשימת תנועות. '}
        {'סיכום סכומי החודש — רק אם אישרת בהגדרות/בהסכמה.'}
      </Text>
      <Pressable
        onPress={() => void Linking.openURL(privacyPageUrl())}
        accessibilityRole="link"
        accessibilityLabel={PRIVACY_LINK_LABEL}
        style={styles.privacyLinkBtn}
      >
        <Text style={styles.privacyLink}>{PRIVACY_LINK_LABEL} ‹</Text>
      </Pressable>
      <View style={styles.inputRow}>
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
          returnKeyType="send"
          // @ts-expect-error RN-web Enter/Shift+Enter
          onKeyDown={Platform.OS === 'web' ? onComposerKey : undefined}
        />
        <Pressable
          onPress={onSend}
          disabled={!draft.trim() || typing || sendLocked}
          style={[styles.sendBtn, (!draft.trim() || typing || sendLocked) && styles.sendDisabled]}
          accessibilityLabel="שלח"
        >
          <Text style={styles.sendGlyph}>➤</Text>
        </Pressable>
      </View>
      <Text style={styles.inputHint}>
        {name} · Enter לשליחה · Shift+Enter לשורה חדשה
      </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dockRoot: {
    width: DESKTOP_CHAT_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    maxHeight: '100%',
    borderRadius: radii.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(14,18,34,0.92)',
  },
  sheetDock: {
    flex: 1,
    maxHeight: '100%',
    minHeight: 0,
    width: '100%',
    maxWidth: DESKTOP_CHAT_WIDTH,
    borderRadius: 0,
    marginHorizontal: 0,
  },
  expandHandle: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 4,
  },
  expandPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  expandHint: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: colors.inkSoft,
  },
  totalsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  totalsCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  totalsLabel: {
    fontFamily: fonts.semi,
    fontSize: 11,
    color: colors.inkSoft,
  },
  totalsValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  totalsRemain: {
    color: colors.gold,
  },
  totalsSep: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.separator,
  },
  typingHint: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.inkMuted,
  },
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
    fontSize: 13,
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
    fontSize: 13,
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
  aiDisclosure: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.gold,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 216, 138, 0.10)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  consentBox: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: 10,
  },
  consentTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
  },
  consentBody: {
    ...type.bodySm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  consentOpt: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  consentOptOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  consentOptTxt: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  consentCta: {
    marginTop: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  consentCtaTxt: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primaryOn,
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
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  bubbleTxtMe: {
    ...type.chatMe,
    color: colors.chatMeText,
    textAlign: 'start',
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

  systemRow: {
    alignSelf: 'center',
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  systemTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  proposeCardSticky: {
    marginHorizontal: spacing.md,
    marginBottom: 6,
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
    fontSize: 13,
    color: colors.gold,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: 4,
    opacity: 0.9,
  },
  privacyLinkBtn: {
    alignSelf: 'center',
    marginBottom: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  privacyLink: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
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
    fontSize: 16,
    textAlign: 'start',
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
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  histRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  histMeta: { flex: 1, minWidth: 0 },
  histTitle: {
    fontFamily: fonts.semi,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'start',
  },
  histDate: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'start',
    marginTop: 2,
  },
  histDeleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(220,80,100,0.45)',
    backgroundColor: 'rgba(220,80,100,0.18)',
  },
  histDeleteTxt: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: '#FCA5A5',
  },
  deleteAllBtn: {
    marginHorizontal: spacing.md,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(220,80,100,0.4)',
    backgroundColor: 'rgba(220,80,100,0.12)',
  },
  deleteAllTxt: {
    fontFamily: fonts.semi,
    fontSize: 14,
    color: '#FCA5A5',
    writingDirection: 'rtl',
  },
});
