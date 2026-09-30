import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { LedgerKind } from '../types/ledger';
import { t, type Gender } from '../utils/copy';
import {
  type NoamChatContext,
} from './noamContext';

export {
  buildContextFromLedger,
  buildNoamContext,
  type NoamChatContext,
} from './noamContext';

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

/** סיכום תנועה שאושרה בכרטיס — בלי הערות/שמות (NEW-1) */
export type ConfirmedProposal = {
  kind: LedgerKind;
  category: string;
  amount: number;
  period: string;
};

/** שגיאת HTTP מנועם — asBubble=true → להציג כבועת עוזר בלי קידומת «אופס —» */
export class NoamHttpError extends Error {
  status: number;
  code?: string;
  asBubble: boolean;
  constructor(
    message: string,
    status: number,
    code?: string,
    asBubble = false
  ) {
    super(message);
    this.name = 'NoamHttpError';
    this.status = status;
    this.code = code;
    this.asBubble = asBubble;
  }
}

export async function sendToNoam(params: {
  messages: { role: ChatRole; content: string }[];
  /** אם undefined — נשלחת רק ההודעה, בלי סיכום חודש */
  context?: NoamChatContext | null;
  /** N-11 — מגדר מהפרופיל לפנייה נכונה (תמיד נשלח) */
  gender?: Gender;
  /** NEW-1: עד 3 תנועות שאושרו בכרטיסים בשיחה הזו */
  confirmed?: ConfirmedProposal[] | null;
}): Promise<{ reply: string; actions: ProposedEntry[] }> {
  const endpoint = chatEndpoint();
  const body: Record<string, unknown> = {
    messages: params.messages,
    gender: params.gender === 'female' ? 'female' : 'male',
  };
  if (params.context) {
    body.context = params.context;
  }
  if (params.confirmed && params.confirmed.length) {
    body.confirmed = params.confirmed.slice(0, 3);
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

  const rawText = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    throw new Error('נועם לא זמין כרגע. נסה שוב בעוד רגע.');
  }

  const ms = Date.now() - started;
  console.info(
    `[noam] client_ms=${ms} status=${res.status} model=${typeof data?.model === 'string' ? data.model : '?'}`
  );
  if (!res.ok) {
    const msg =
      typeof data?.error === 'string'
        ? data.error
        : 'לא הצלחתי להגיע לנועם. בדוק חיבור / מפתח בשרת.';
    const code = typeof data?.code === 'string' ? data.code : undefined;
    // 429 / תקציב / כיבוי — מציגים את טקסט השרת כבועה רגילה (בלי «אופס —»)
    if (
      res.status === 429 ||
      (res.status === 503 &&
        (code === 'ai_disabled' || code === 'ai_daily_limit'))
    ) {
      throw new NoamHttpError(msg, res.status, code, true);
    }
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
