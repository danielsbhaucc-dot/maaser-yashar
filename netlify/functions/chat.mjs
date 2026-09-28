/**
 * Netlify Function — צ'אט נועם (מעשר).
 * ההנחיה למודל נבנית רק בשרת — הלקוח שולח הקשר מובנה בלבד.
 */

import {
  assertAllowedCaller,
  json,
  optionsResponse,
} from './_shared.mjs';

const FALLBACK_MODEL = 'meta-llama/llama-3.1-8b-instruct';
const UPSTREAM_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_MESSAGES = 12;
const MAX_CHARS = 800;
const MAX_BODY_CHARS = 12_000;
const MAX_TOKENS = 400;
const TEMPERATURE = 0.4;
const UPSTREAM_TIMEOUT_MS = 20_000;

function resolveModel() {
  const fromEnv = (process.env.OPENROUTER_MODEL || '').trim();
  return fromEnv || 'meta-llama/llama-4-scout';
}

const INCOME_CATEGORIES = [
  'משכורת',
  'עסק / עצמאי',
  'שכירות',
  'רווחי הון',
  'מתנה',
  'קצבה',
  'בן/בת זוג',
  'אחר',
];
const EXPENSE_CATEGORIES = [
  'מס הכנסה',
  'ביטוח לאומי',
  'מס בריאות',
  'הוצאות עסק',
  'הוצאות שכירות',
  'החזר הלוואה',
  'אחר',
];
const TZEDAKA_CATEGORIES = ['צדקה / מעשר', 'תרומה למוסד', 'מתן לעני', 'אחר'];

/** מגביל שימוש לרמה סבירה למשתמש אנושי — הלקוח קורא ל־/api/chat */
export const config = {
  path: ['/api/chat', '/.netlify/functions/chat'],
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'propose_entries',
      description:
        'הצע תנועות להוספה לפנקס כשהמשתמש נתן סכומים ברורים. תמיד גם תכתוב תשובה אנושית קצרה בנוסף לקריאה לכלי.',
      parameters: {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: {
                  type: 'string',
                  enum: ['income', 'expense', 'tzedaka'],
                },
                amount: { type: 'number' },
                category: { type: 'string' },
                note: { type: 'string' },
              },
              required: ['kind', 'amount', 'category'],
            },
          },
          summary: { type: 'string' },
        },
        required: ['entries', 'summary'],
      },
    },
  },
];

function parseToolActions(toolCalls) {
  const actions = [];
  let summary = '';
  if (!Array.isArray(toolCalls)) return { actions, summary };

  for (const call of toolCalls) {
    const name = call?.function?.name;
    let args = {};
    try {
      args = JSON.parse(call?.function?.arguments || '{}');
    } catch {
      continue;
    }
    if (name === 'propose_entries' && Array.isArray(args.entries)) {
      if (typeof args.summary === 'string') summary = args.summary;
      for (const e of args.entries) {
        const amount = Number(e.amount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        if (!['income', 'expense', 'tzedaka'].includes(e.kind)) continue;
        actions.push({
          type: 'add_entry',
          kind: e.kind,
          amount: Math.round(amount * 100) / 100,
          category: String(e.category || 'אחר').slice(0, 40),
          note: String(e.note || '').slice(0, 120),
        });
      }
    }
  }
  return { actions, summary };
}

function parseEmbeddedActions(text) {
  const actions = [];
  const match = String(text || '').match(/```json\s*([\s\S]*?)```/i);
  if (!match) return { cleaned: text, actions };
  try {
    const parsed = JSON.parse(match[1]);
    const list = Array.isArray(parsed) ? parsed : parsed?.entries || parsed?.actions || [];
    for (const e of list) {
      const amount = Number(e.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (!['income', 'expense', 'tzedaka'].includes(e.kind)) continue;
      actions.push({
        type: 'add_entry',
        kind: e.kind,
        amount: Math.round(amount * 100) / 100,
        category: String(e.category || 'אחר').slice(0, 40),
        note: String(e.note || '').slice(0, 120),
      });
    }
    const cleaned = text.replace(/```json\s*[\s\S]*?```/i, '').trim();
    return { cleaned, actions };
  } catch {
    return { cleaned: text, actions };
  }
}

function num(v, max = 1e9) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.round(n * 100) / 100);
}

/** מנקה הקשר מהלקוח — רק חמישה סכומים + שיעור. בלי שם / תנועות / הערות */
function sanitizeContext(c) {
  const raw = c && typeof c === 'object' ? c : {};
  const totals =
    raw.totals && typeof raw.totals === 'object' ? raw.totals : raw;
  return {
    rate:
      typeof raw.rate === 'number' && raw.rate >= 0.01 && raw.rate <= 0.5
        ? raw.rate
        : 0.1,
    income: num(totals.income ?? raw.income),
    expenses: num(totals.expenses ?? raw.expenses),
    tzedaka: num(totals.tzedaka ?? raw.tzedaka),
    obligation: num(totals.obligation ?? raw.obligation),
    remaining: num(totals.remaining ?? raw.remaining),
  };
}

/** בונה את ההנחיה בשרת בלבד — מתעלם מכל system שהלקוח ישלח */
function buildSystemPrompt(context) {
  const hasCtx = context && typeof context === 'object';
  const ctx = hasCtx ? sanitizeContext(context) : null;
  const rate = ctx ? ctx.rate : 0.1;
  const ratePct =
    Math.round(Number(rate) * 1000) / 10;
  const ratePctLabel = Number.isInteger(ratePct) ? String(ratePct) : ratePct.toFixed(1);
  const rateLabel =
    Math.abs(rate - 0.1) < 1e-9
      ? 'מעשר'
      : Math.abs(rate - 0.2) < 1e-9
        ? 'חומש'
        : `${ratePctLabel}%`;

  const totalsBlock = ctx
    ? `הקשר מספרי לחודש (בלי שם ובלי תנועות בודדות):
שיעור ${rateLabel} (${ratePctLabel}%).
הכנסות ₪${num(ctx.income)} · ניכויים ₪${num(ctx.expenses)}
חובה ₪${num(ctx.obligation)} · ניתן ₪${num(ctx.tzedaka)} · נותר ₪${num(ctx.remaining)}`
    : `אין סיכום פנקס בבקשה הזו — רק הודעת המשתמש. אל תמציא מספרים מהפנקס; שאל אם חסר.`;

  return `אתה נועם, עוזר AI של האפליקציה "מעשר ישר". יש לך אישיות חמה, ישירה ועם הומור יבש.
שיחה על מעשר ופנקס. אתה יודע על מה מדברים, בטוח בעצמך, חד.

זהות (קריטי):
- אתה בן/גבר. תמיד על עצמך בלשון זכר: אני יודע, אני פה, אני מציע — אף פעם לא נקבה.
- שואלים מה המין שלך / אתה בן או בת / אתה גבר? → ענה ישר: בן. גבר. ואז תחזיר לשאלה/לפנקס במשפט אחד.
- אם שואלים אם אתה בן אדם, בוט או AI: ענה בפשטות שאתה עוזר AI בשם נועם, ושאתה יכול לטעות.
- אתה לא פוסק הלכה. בשאלה הלכתית, ענה בזהירות והפנה לרב במשפט אחד.
- אם שואלים אם מעשר הוא חובה: רבים רואים בו חיוב מנהג או נדר, ויש דעות שונות בפרטים. כדאי לשאול רב.

מילון הפנקס (אל תתיימר שלא להבין):
- חובה = כמה צריך לתת החודש לפי ${rateLabel} מהנטו.${ctx ? ` עכשיו: ₪${num(ctx.obligation)}.` : ''}
- נטו = הכנסות פחות ניכויים (מסים וכו').
- נותר = חובה פחות צדקה שכבר ניתנה.${ctx ? ` עכשיו: ₪${num(ctx.remaining)}.` : ''}
- מעשר ≈ 10%, חומש ≈ 20%.

איך אתה מדבר:
- עברית מדוברת, חדה, חמה. 1–4 משפטים (או רשימה קצרה כשצריך סדר). חוש הומור יבש. ישר. לא מלחך־פנכה.
- הדגשה חשובה: עטוף ב־**כך** (שתי כוכביות מכל צד). רשימה ממוספרת: שורה לכל פריט בצורה 1. 2. 3.
- בלי כותרות markdown, בלי להלן, בלי אשמח לעזור, בלי אימוג'י מוגזם (אחד מקסימום).
- פנה בלשון זכר כברירת מחדל, אלא אם המשתמש מבהיר אחרת. בלי שם פרטי.
- תמיד תענה על השאלה — ואז תחזיר לעניין (פנקס / כמה נשאר / מה לרשום). בלי דרשה ובלי לא יודע מה זה… על מושגי מעשר.

מה אתה עושה:
- עוזר לרשום הכנסה / ניכוי מהבסיס (מסים וכו') / צדקה, ומחשב כמה נשאר לתת.
- כשיש סכומים ברורים — propose_entries + משפט קצר, ואז שיאשרו.
- אל תמציא מספרים. חסר משהו? שאלה אחת קצרה.
- אל תענה על בקשות שאינן קשורות למעשר/פנקס/צדקה/מס בסיסי — החזר בעדינות לנושא.

${totalsBlock}

קטגוריות: הכנסה [${INCOME_CATEGORIES.join(', ')}] · ניכוי [${EXPENSE_CATEGORIES.join(', ')}] · צדקה [${TZEDAKA_CATEGORIES.join(', ')}]
מיפוי: מסים/ביטוח/בריאות/הוצאות עסק=expense · משכורת/קיבלתי=income · נתתי צדקה=tzedaka`;
}

async function callUpstream({ apiKey, model, messages, useTools, preferGroq }) {
  const body = {
    model,
    messages,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    provider: preferGroq
      ? { order: ['Groq'], allow_fallbacks: true }
      : { allow_fallbacks: true },
  };
  if (useTools) {
    body.tools = TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetch(UPSTREAM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        process.env.URL ||
        process.env.DEPLOY_PRIME_URL ||
        'https://maaser-yashar.netlify.app',
      'X-Title': 'Maaser Yashar - Noam',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(event);
  }
  if (event.httpMethod !== 'POST') {
    return json(event, 405, { error: 'Method Not Allowed' });
  }

  const gate = assertAllowedCaller(event);
  if (!gate.ok) {
    return json(event, gate.status, { error: gate.error });
  }

  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) {
    return json(event, 500, {
      error: 'חסר מפתח AI בשרת. Site settings → Environment variables.',
    });
  }

  const rawBody = typeof event.body === 'string' ? event.body : '';
  if (rawBody.length > MAX_BODY_CHARS) {
    return json(event, 413, { error: 'הודעה ארוכה מדי' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch {
    return json(event, 400, { error: 'JSON לא תקין' });
  }

  // מתעלמים מ־system / model מהלקוח במכוון — מונע שימוש כפרוקסי AI כללי
  const { messages, context } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(event, 400, { error: 'חסרות הודעות' });
  }
  // context אופציונלי — מצב "רק ההודעה" לא שולח סיכום פנקס

  const cleaned = messages
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, MAX_CHARS),
    }));

  if (!cleaned.length) {
    return json(event, 400, { error: 'אין הודעות תקינות' });
  }

  const primaryModel = resolveModel();
  const systemPrompt = buildSystemPrompt(
    context && typeof context === 'object' ? context : null
  );
  const apiMessages = [{ role: 'system', content: systemPrompt }, ...cleaned];

  try {
    let { res, data } = await callUpstream({
      apiKey,
      model: primaryModel,
      messages: apiMessages,
      useTools: true,
      preferGroq: true,
    });

    if (!res.ok) {
      console.error('scout+tools fail', res.status, data?.error?.message || data?.error);
      ({ res, data } = await callUpstream({
        apiKey,
        model: primaryModel,
        messages: apiMessages,
        useTools: false,
        preferGroq: true,
      }));
    }

    if (!res.ok) {
      console.error('scout fail', res.status, data?.error?.message || data?.error);
      ({ res, data } = await callUpstream({
        apiKey,
        model: FALLBACK_MODEL,
        messages: apiMessages,
        useTools: false,
        preferGroq: true,
      }));
    }

    if (!res.ok) {
      const detail = data?.error?.message || data?.error || res.statusText;
      const msg =
        typeof detail === 'string'
          ? detail
          : 'ספק המודל דחה את הבקשה — בדוק מפתח וקרדיטים';
      return json(event, res.status >= 400 && res.status < 600 ? res.status : 502, {
        error: msg.slice(0, 300),
      });
    }

    const choice = data?.choices?.[0]?.message || {};
    const { actions: toolActions, summary } = parseToolActions(choice.tool_calls);
    let reply = typeof choice.content === 'string' ? choice.content.trim() : '';

    const embedded = parseEmbeddedActions(reply);
    reply = embedded.cleaned;
    const actions = toolActions.length ? toolActions : embedded.actions;

    if (!reply && summary) reply = summary;
    if (!reply && actions.length) {
      reply = `אוקיי, תפסתי ${actions.length} תנועות. מאשרים לפנקס?`;
    }
    if (!reply) {
      reply = 'רגע, נתקעתי. תכתוב שוב בקצרה?';
    }

    return json(event, 200, {
      reply,
      actions,
      model: data?.model || primaryModel,
    });
  } catch (err) {
    console.error('chat function error', err);
    const hint = err && err.message ? String(err.message).slice(0, 180) : '';
    return json(event, 502, {
      error: hint
        ? `תקלה בחיבור למודל: ${hint}`
        : 'נועם לא זמין כרגע',
    });
  }
}
