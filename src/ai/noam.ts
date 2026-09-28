import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { LedgerEntry, LedgerKind } from '../types/ledger';
import { t, type Gender } from '../utils/copy';
import { computeTotals, entriesForPeriod } from '../utils/ledger';
import { currentPeriod } from '../utils/history';
import type { UserProfile } from '../utils/profile';
import type { MaaserRate } from '../types';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ProposedEntry = {
  type: 'add_entry';
  kind: LedgerKind;
  amount: number;
  category: string;
  note: string;
};

export type ChatThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

const HISTORY_KEY = 'noam_chat_threads_v1';

/** כתובת ה־API — בפריסה ב־Netlify זה עובד יחסית לאתר */
export function chatEndpoint(): string {
  const fromEnv = process.env.EXPO_PUBLIC_CHAT_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/.netlify/functions/chat`;
  }
  return 'https://maaser-yashar.netlify.app/.netlify/functions/chat';
}

/** הקשר מובנה לשרת — ההנחיה למודל נבנית שם, לא בלקוח */
export type NoamChatContext = {
  displayName: string;
  gender: Gender;
  rate: number;
  period: string;
  totals: {
    income: number;
    expenses: number;
    netBase: number;
    obligation: number;
    tzedaka: number;
    remaining: number;
  };
  recent: { kind: LedgerKind; category: string; amount: number }[];
};

export function buildNoamContext(opts: {
  profile: UserProfile;
  ledger: LedgerEntry[];
  period?: string;
}): NoamChatContext {
  const period = opts.period || currentPeriod();
  const month = entriesForPeriod(opts.ledger, period);
  const totals = computeTotals(month, opts.profile.rate as MaaserRate);
  const name = opts.profile.displayName || t(opts.profile.gender, 'חבר', 'חברה');

  return {
    displayName: name.slice(0, 40),
    gender: (opts.profile.gender as Gender) || 'male',
    rate: opts.profile.rate === 0.2 ? 0.2 : 0.1,
    period,
    totals: {
      income: totals.income,
      expenses: totals.expenses,
      netBase: totals.netBase,
      obligation: totals.obligation,
      tzedaka: totals.tzedaka,
      remaining: totals.remaining,
    },
    // בלי הערות חופשיות — מצמצם שליחת פרטים מזהים
    recent: month.slice(0, 12).map((e) => ({
      kind: e.kind,
      category: e.category.slice(0, 40),
      amount: e.amount,
    })),
  };
}

export async function sendToNoam(params: {
  messages: { role: ChatRole; content: string }[];
  context: NoamChatContext;
}): Promise<{ reply: string; actions: ProposedEntry[] }> {
  const endpoint = chatEndpoint();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: params.messages,
      context: params.context,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error === 'string'
        ? data.error
        : 'לא הצלחתי להגיע לנועם. בדוק חיבור / מפתח בשרת.';
    throw new Error(msg);
  }

  const actions = Array.isArray(data.actions)
    ? (data.actions as ProposedEntry[]).filter(
        (a) =>
          a?.type === 'add_entry' &&
          ['income', 'expense', 'tzedaka'].includes(a.kind) &&
          Number(a.amount) > 0
      )
    : [];

  return {
    reply: String(data.reply || '').trim() || '…',
    actions,
  };
}

export function kindLabel(kind: LedgerKind, gender?: Gender): string {
  if (kind === 'income') return 'הכנסה';
  if (kind === 'expense') return 'הוצאה';
  return t(gender, 'צדקה שניתנה', 'צדקה שניתנה');
}

export async function loadThreads(): Promise<ChatThread[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveThreads(threads: ChatThread[]): Promise<void> {
  const trimmed = threads.slice(0, 30).map((th) => ({
    ...th,
    messages: th.messages.slice(-60),
  }));
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function newThreadId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function msgId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const QUICK_STARTS = [
  'קיבלתי משכורת — בוא נרשום',
  'כמה נשאר לי לתת החודש?',
  'הוצאתי על מסים, תעזור לעשות סדר',
  'נתתי צדקה — תרשום בפנקס',
] as const;
