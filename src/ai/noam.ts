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
  /** YYYY-MM — חודש יעד (N-10 / T-13); חסר = חודש נוכחי */
  period?: string;
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
  /** N-11 — מגדר מהפרופיל לפנייה נכונה (תמיד נשלח) */
  gender?: Gender;
}): Promise<{ reply: string; actions: ProposedEntry[] }> {
  const endpoint = chatEndpoint();
  const body: Record<string, unknown> = {
    messages: params.messages,
    gender: params.gender === 'female' ? 'female' : 'male',
  };
  if (params.context) {
    body.context = params.context;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('אין חיבור');
  }

  /** N-18: timeout 20ש׳ → «נסה שוב»; לוג זמן תגובה */
  const CLIENT_TIMEOUT_MS = 20_000;
  const started = Date.now();
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
    : null;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (err) {
    const ms = Date.now() - started;
    console.info(`[noam] client_ms=${ms} error=network`);
    const name =
      err && typeof err === 'object' && 'name' in err
        ? String((err as { name?: string }).name)
        : '';
    if (name === 'AbortError') {
      throw new Error('נסה שוב');
    }
    throw new Error('אין חיבור');
  } finally {
    if (timer) clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  const ms = Date.now() - started;
  console.info(
    `[noam] client_ms=${ms} status=${res.status} model=${typeof data?.model === 'string' ? data.model : '?'}`
  );
  if (!res.ok) {
    const msg =
      typeof data?.error === 'string'
        ? data.error
        : 'לא הצלחתי להגיע לנועם. בדוק חיבור / מפתח בשרת.';
    // שגיאות timeout מהשרת גם מקבלות ניסוח ידידותי
    if (/timeout|ETIMEDOUT|aborted|זמן/i.test(msg)) {
      throw new Error('נסה שוב');
    }
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
    ? (data.actions as ProposedEntry[])
        .filter((a) => {
          if (a?.type !== 'add_entry') return false;
          if (!['income', 'expense', 'tzedaka'].includes(a.kind)) return false;
          if (!Number.isFinite(Number(a.amount))) return false;
          if (!(Number(a.amount) > 0) || Number(a.amount) >= 1e8) return false;
          if (a.kind === 'expense' && !AI_EXPENSE.has(String(a.category || ''))) {
            return false;
          }
          return true;
        })
        .map((a) => {
          const raw = typeof a.period === 'string' ? a.period.trim() : '';
          const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : undefined;
          const out: ProposedEntry = {
            type: 'add_entry',
            kind: a.kind,
            amount: Number(a.amount),
            category: String(a.category || ''),
            note: typeof a.note === 'string' ? a.note : '',
          };
          if (period) out.period = period;
          return out;
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

/** מחיקת כל השיחות מ־localStorage (N-16) */
export async function clearAllThreads(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
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
