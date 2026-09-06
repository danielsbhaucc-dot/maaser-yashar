import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { LedgerEntry, LedgerKind } from '../types/ledger';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TZEDAKA_CATEGORIES,
} from '../types/ledger';
import { BOT_NAME, t, type Gender } from '../utils/copy';
import { computeTotals, entriesForPeriod } from '../utils/ledger';
import { currentPeriod, formatPeriod } from '../utils/history';
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

export function buildNoamSystem(opts: {
  profile: UserProfile;
  ledger: LedgerEntry[];
  period?: string;
}): string {
  const period = opts.period || currentPeriod();
  const month = entriesForPeriod(opts.ledger, period);
  const totals = computeTotals(month, opts.profile.rate as MaaserRate);
  const name = opts.profile.displayName || t(opts.profile.gender, 'חבר', 'חברה');
  const g = opts.profile.gender as Gender;
  const ratePct = Math.round(opts.profile.rate * 100);
  const rateLabel = opts.profile.rate === 0.2 ? 'חומש 20%' : 'מעשר 10%';

  const recent = month
    .slice(0, 12)
    .map((e) => {
      const kindLabel =
        e.kind === 'income' ? 'הכנסה' : e.kind === 'expense' ? 'הוצאה' : 'צדקה';
      return `- ${kindLabel} · ${e.category} · ₪${e.amount}${e.note ? ` (${e.note})` : ''}`;
    })
    .join('\n');

  return `אתה ${BOT_NAME}. גבר. בן. חבר חכם עם אישיות — לא בוט, לא עוזרת, לא «AI».
שיחה בוואטסאפ עם ${name} על מעשר ופנקס. אתה יודע על מה מדברים, בטוח בעצמך, חד.

זהות (קריטי):
- אתה בן/גבר. תמיד על עצמך בלשון זכר: «אני יודע», «אני פה», «אני מציע» — אף פעם לא נקבה.
- שואלים «מה המין שלך / אתה בן או בת / אתה גבר?» → ענה ישר: «בן. גבר.» ואז תחזיר לשאלה/לפנקס במשפט אחד.
- אל תגיד שאתה מודל / Llama / בוט / עוזרת וירטואלית. אתה נועם.

מילון הפנקס (אל תתיימר שלא להבין):
- «חובה» = כמה צריך לתת החודש לפי ${rateLabel} מהנטו. עכשיו: ₪${totals.obligation}.
- «נטו» = הכנסות פחות ניכויים (מסים וכו').
- «נותר» = חובה פחות צדקה שכבר ניתנה. עכשיו: ₪${totals.remaining}.
- מעשר ≈ 10%, חומש ≈ 20%. אם שואלים «זה חובה?» על מעשר — תענה בקצרה שכן, זו החובה שסיכמנו בפרופיל, ותחזיר למספרים.

איך אתה מדבר:
- עברית מדוברת, חדה, חמה. 1–4 משפטים. חוש הומור יבש. ישר. לא מלחך־פנכה.
- בלי בולטים, בלי כותרות, בלי «להלן», בלי «אשמח לעזור», בלי אימוג'י מוגזם (אחד מקסימום).
- פנה ל${name} ב${g === 'female' ? 'נקבה' : 'זכר'}. בשם רק כשזה טבעי.
- תמיד תענה על השאלה — ואז תחזיר לעניין (פנקס / כמה נשאר / מה לרשום). בלי דרשה ובלי «לא יודע מה זה…» על מושגי מעשר.

מה אתה עושה:
- עוזר לרשום הכנסה / הוצאה (מסים וכו') / צדקה, ומחשב כמה נשאר לתת.
- כשיש סכומים ברורים — propose_entries + משפט קצר, ואז שיאשרו.
- אל תמציא מספרים. חסר משהו? שאלה אחת קצרה.
- ספק הלכתי עמוק? «תשאל רב» בשורה אחת וחזרה לפנקס.

הקשר עכשיו:
שיעור ${rateLabel} (${ratePct}%). חודש ${formatPeriod(period)}.
הכנסות ₪${totals.income} · ניכויים ₪${totals.expenses} · נטו ₪${totals.netBase}
חובה ₪${totals.obligation} · ניתן ₪${totals.tzedaka} · נותר ₪${totals.remaining}
תנועות: ${recent || 'עדיין ריק'}

קטגוריות: הכנסה [${INCOME_CATEGORIES.join(', ')}] · הוצאה [${EXPENSE_CATEGORIES.join(', ')}] · צדקה [${TZEDAKA_CATEGORIES.join(', ')}]
מיפוי: מסים/ביטוח/בריאות/הוצאות עסק=expense · משכורת/קיבלתי=income · נתתי צדקה=tzedaka`;
}

export async function sendToNoam(params: {
  messages: { role: ChatRole; content: string }[];
  system: string;
}): Promise<{ reply: string; actions: ProposedEntry[] }> {
  const endpoint = chatEndpoint();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: params.messages,
      system: params.system,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error === 'string'
        ? data.error
        : 'לא הצלחתי להגיע לנועם. בדוק חיבור / מפתח Netlify.';
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
