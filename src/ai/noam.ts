import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { LedgerEntry, LedgerKind } from '../types/ledger';
import { t, type Gender } from '../utils/copy';
import { resolvePeriodTotals } from '../utils/totalsAdvanced';
import { currentPeriod } from '../utils/history';
import type { UserProfile } from '../utils/profile';

/** system = שורת אפליקציה (N-02) — לא נשלחת למודל כהודעת נועם */
export type ChatRole = 'user' | 'assistant' | 'system';

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

/** כתובת ה־API — בפריסה ב־Netlify זה עובד יחסית לאתר דרך /api/chat */
export function chatEndpoint(): string {
  const fromEnv = process.env.EXPO_PUBLIC_CHAT_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/api/chat`;
  }
  return 'https://maaser-yashar.netlify.app/api/chat';
}

/** הקשר מזערי לשרת — בלי שם, בלי הערות, בלי רשימת תנועות */
export type NoamChatContext = {
  rate: number;
  income: number;
  expenses: number;
  tzedaka: number;
  obligation: number;
  remaining: number;
};

export function buildNoamContext(opts: {
  profile: UserProfile;
  ledger: LedgerEntry[];
  period?: string;
}): NoamChatContext {
  const period = opts.period || currentPeriod();
  const totals = resolvePeriodTotals(
    opts.ledger,
    period,
    opts.profile,
    !!opts.profile.carryForwardSurplus
  );

  return {
    rate: Number.isFinite(opts.profile.rate) ? opts.profile.rate : 0.1,
    income: totals.income,
    expenses: totals.expenses,
    tzedaka: totals.tzedaka,
    obligation: totals.obligation,
    remaining: totals.remaining,
  };
}

export async function sendToNoam(params: {
  messages: { role: ChatRole; content: string }[];
  /** אם undefined — נשלחת רק ההודעה, בלי סיכום חודש */
  context?: NoamChatContext | null;
}): Promise<{ reply: string; actions: ProposedEntry[] }> {
  const endpoint = chatEndpoint();
  const body: Record<string, unknown> = {
    messages: params.messages,
  };
  if (params.context) {
    body.context = params.context;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('אין חיבור');
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('אין חיבור');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error === 'string'
        ? data.error
        : 'לא הצלחתי להגיע לנועם. בדוק חיבור / מפתח בשרת.';
    throw new Error(msg);
  }

  /** N-06: expense רק לקטגוריות ניכוי שמותר ל־AI להציע */
  const AI_EXPENSE = new Set([
    'מס הכנסה',
    'ביטוח לאומי',
    'מס בריאות',
    'הוצאות עסק',
    'הוצאות שכירות',
  ]);

  const actions = Array.isArray(data.actions)
    ? (data.actions as ProposedEntry[]).filter((a) => {
        if (a?.type !== 'add_entry') return false;
        if (!['income', 'expense', 'tzedaka'].includes(a.kind)) return false;
        if (!Number.isFinite(Number(a.amount))) return false;
        if (!(Number(a.amount) > 0) || Number(a.amount) >= 1e8) return false;
        if (a.kind === 'expense' && !AI_EXPENSE.has(String(a.category || ''))) {
          return false;
        }
        return true;
      })
    : [];

  return {
    reply: String(data.reply || '').trim() || '…',
    actions: actions.slice(0, 3),
  };
}

/** הודעות שנשלחות למודל — בלי system מהאפליקציה */
export function messagesForModel(
  messages: ChatMessage[]
): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

export function kindLabel(kind: LedgerKind, gender?: Gender): string {
  if (kind === 'income') return 'הכנסה';
  if (kind === 'expense') return 'ניכוי מהבסיס';
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
