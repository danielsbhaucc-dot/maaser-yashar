/**
 * Netlify Function — צ'אט נועם (מעשר).
 * ההנחיה למודל נבנית רק בשרת — הלקוח שולח הקשר מובנה בלבד.
 *
 * N-01: פלט מובנה לתנועות + validActions + retry כשחסרות actions.
 * N-02: איסור טענות "רשמתי" + סינון SAVE_CLAIM לפני הלקוח.
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
  'ירושה',
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

const CATS = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  tzedaka: TZEDAKA_CATEGORIES,
};

/** N-01 — מאמת כל action לפני החזרה ללקוח. בלי חובה/נותר, בלי סכום ≤0. */
export function validActions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).flatMap((a) => {
    const kind = a?.kind;
    const amount = Math.round(Number(a?.amount) * 100) / 100;
    if (a?.type !== 'add_entry' || !(kind in CATS)) return [];
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e8) return [];
    const category = CATS[kind].includes(a.category) ? a.category : 'אחר';
    const note = typeof a.note === 'string' ? a.note.slice(0, 80) : '';
    return [{ type: 'add_entry', kind, category, amount, note }];
  });
}

/** N-02 — מסיר משפטים שטוענים שהתנועה כבר נרשמה; הכרטיס שואל "להוסיף לפנקס?" */
const SAVE_CLAIM =
  /[^.!?\n]*[.,!?;]?(רשמתי|נרשם|שמרתי|הוספתי לפנקס|יעבור לפנקס|ייעבור לפנקס|עודכן בפנקס)[^.!?\n]*[.,!?;]?/g;

export function stripSaveClaims(text) {
  const cleaned = String(text || '')
    .replace(SAVE_CLAIM, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || 'להוסיף לפנקס? אשר בכפתור למטה';
}

/** האם הטקסט מציע תנועה בלי actions מובנים */
export function textSuggestsEntry(text) {
  const t = String(text || '');
  if (/אני מציע|מציע לרשום|להוסיף לפנקס|תרשום|בואו נרשום|בוא נרשום/.test(t)) {
    return true;
  }
  const hasAmount = /\d[\d,]{1,}(?:\.\d+)?\s*₪|₪\s*\d[\d,]{1,}|\b\d{3,}\b/.test(t);
  const hasKindWord =
    /(משכורת|הכנסה|תרמ|צדקה|תרומ|הוצא|ניכוי|קיבלתי|נתתי)/.test(t);
  return hasAmount && hasKindWord;
}

/** מגביל שימוש לרמה סבירה למשתמש אנושי — הלקוח קורא ל־/api/chat */
export const config = {
  path: ['/api/chat', '/.netlify/functions/chat'],
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};

const ENTRY_ITEM_SCHEMA = {
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
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'propose_entries',
      description:
        'הצע תנועות להוספה לפנקס כשהמשתמש נתן סכומים ברורים. תמיד גם תכתוב תשובה אנושית קצרה בנוסף לקריאה לכלי. רק income/expense/tzedaka — לעולם לא חובה או נותר.',
      parameters: {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: ENTRY_ITEM_SCHEMA,
          },
          summary: { type: 'string' },
        },
        required: ['entries', 'summary'],
      },
    },
  },
];

/** סכמה 6.2 — תשובה + actions מובנים (OpenRouter response_format json_schema) */
const RESPONSE_JSON_SCHEMA = {
  name: 'noam_chat_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['add_entry'] },
            kind: {
              type: 'string',
              enum: ['income', 'expense', 'tzedaka'],
            },
            amount: { type: 'number' },
            category: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['type', 'kind', 'amount', 'category', 'note'],
          additionalProperties: false,
        },
      },
    },
    required: ['reply', 'actions'],
    additionalProperties: false,
  },
};

const STRUCTURED_RETRY_REMINDER =
  'תזכורת קצרה: אם הצעת תנועה לפנקס — החזר גם propose_entries (או JSON עם actions מסוג add_entry בלבד: income/expense/tzedaka, סכום חיובי, קטגוריה מהרשימה). בלי חובה/נותר. אל תטען שכבר נרשם — המשתמש יאשר בכרטיס.';

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
        actions.push({
          type: 'add_entry',
          kind: e.kind,
          amount: e.amount,
          category: e.category,
          note: e.note || '',
        });
      }
    }
  }
  return { actions: validActions(actions), summary };
}

function parseEmbeddedActions(text) {
  const actions = [];
  const match = String(text || '').match(/```json\s*([\s\S]*?)```/i);
  if (!match) return { cleaned: text, actions };
  try {
    const parsed = JSON.parse(match[1]);
    const list = Array.isArray(parsed)
      ? parsed
      : parsed?.entries || parsed?.actions || [];
    for (const e of list) {
      actions.push({
        type: 'add_entry',
        kind: e.kind,
        amount: e.amount,
        category: e.category,
        note: e.note || '',
      });
    }
    const cleaned = text.replace(/```json\s*[\s\S]*?```/i, '').trim();
    return { cleaned, actions: validActions(actions) };
  } catch {
    return { cleaned: text, actions };
  }
}

/** מפרסר תשובת json_schema / JSON גולמי מהמודל */
function parseStructuredContent(content) {
  const raw = String(content || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const reply =
      typeof parsed.reply === 'string'
        ? parsed.reply
        : typeof parsed.summary === 'string'
          ? parsed.summary
          : '';
    const list = Array.isArray(parsed.actions)
      ? parsed.actions
      : Array.isArray(parsed.entries)
        ? parsed.entries.map((e) => ({ ...e, type: 'add_entry' }))
        : [];
    return {
      reply,
      actions: validActions(
        list.map((e) => ({
          type: 'add_entry',
          kind: e.kind,
          amount: e.amount,
          category: e.category,
          note: e.note || '',
        }))
      ),
    };
  } catch {
    return null;
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
  const ratePct = Math.round(Number(rate) * 1000) / 10;
  const ratePctLabel = Number.isInteger(ratePct)
    ? String(ratePct)
    : ratePct.toFixed(1);
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
- חובה ונותר הם סיכומים בלבד — לעולם לא תנועות לרשום בפנקס.

איך אתה מדבר:
- עברית מדוברת, חדה, חמה. 1–4 משפטים (או רשימה קצרה כשצריך סדר). חוש הומור יבש. ישר. לא מלחך־פנכה.
- הדגשה חשובה: עטוף ב־**כך** (שתי כוכביות מכל צד). רשימה ממוספרת: שורה לכל פריט בצורה 1. 2. 3.
- בלי כותרות markdown, בלי להלן, בלי אשמח לעזור, בלי אימוג'י מוגזם (אחד מקסימום).
- פנה בלשון זכר כברירת מחדל, אלא אם המשתמש מבהיר אחרת. בלי שם פרטי.
- תמיד תענה על השאלה — ואז תחזיר לעניין (פנקס / כמה נשאר / מה לרשום). בלי דרשה ובלי לא יודע מה זה… על מושגי מעשר.

מה אתה עושה:
- עוזר לרשום הכנסה / ניכוי מהבסיס (מסים וכו') / צדקה, ומחשב כמה נשאר לתת.
- כשיש סכומים ברורים — חובה לקרוא ל־propose_entries (או להחזיר actions מובנים) + משפט קצר. המשתמש יאשר בכרטיס "להוסיף לפנקס?".
- רק kind: income | expense | tzedaka. לעולם לא kind של "חובה" או "נותר", ולא סכום שלילי/אפס.
- אל תמציא מספרים. חסר משהו? שאלה אחת קצרה.
- אל תענה על בקשות שאינן קשורות למעשר/פנקס/צדקה/מס בסיסי — החזר בעדינות לנושא.

איסור מוחלט (N-02):
- לעולם אל תכתוב שרשמת / נרשם / שמרת / הוספת לפנקס / יעבור לפנקס / עודכן בפנקס.
- אתה רק מציע. הרישום קורה רק אחרי שהמשתמש לוחץ "אשר והוסף" בכרטיס.
- במקום "רשמתי" כתוב למשל: "אפשר להוסיף לפנקס — אשר למטה" או "מציע לרשום, תאשר בכרטיס".

${totalsBlock}

קטגוריות: הכנסה [${INCOME_CATEGORIES.join(', ')}] · ניכוי [${EXPENSE_CATEGORIES.join(', ')}] · צדקה [${TZEDAKA_CATEGORIES.join(', ')}]
מיפוי: מסים/ביטוח/בריאות/הוצאות עסק=expense · משכורת/קיבלתי=income · נתתי צדקה/תרמתי=tzedaka (תרומה למוסד לבית כנסת וכו')`;
}

async function callUpstream({
  apiKey,
  model,
  messages,
  useTools,
  useJsonSchema,
  preferGroq,
}) {
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
  } else if (useJsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: RESPONSE_JSON_SCHEMA,
    };
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

function extractFromChoice(choice) {
  const { actions: toolActions, summary } = parseToolActions(choice.tool_calls);
  let reply = typeof choice.content === 'string' ? choice.content.trim() : '';

  const structured = parseStructuredContent(reply);
  if (structured) {
    reply = structured.reply;
    const actions = toolActions.length ? toolActions : structured.actions;
    return { reply, actions, summary };
  }

  const embedded = parseEmbeddedActions(reply);
  reply = embedded.cleaned;
  const actions = toolActions.length ? toolActions : embedded.actions;
  return { reply, actions, summary };
}

function finalizeReply(reply, summary, actions) {
  let out = reply;
  if (!out && summary) out = summary;
  if (!out && actions.length) {
    out = `אוקיי, תפסתי ${actions.length} תנועות. מאשרים לפנקס?`;
  }
  if (!out) out = 'רגע, נתקעתי. תכתוב שוב בקצרה?';
  return stripSaveClaims(out);
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
      console.error(
        'scout+tools fail',
        res.status,
        data?.error?.message || data?.error
      );
      // N-01: בלי כלים — נסה json_schema מובנה
      ({ res, data } = await callUpstream({
        apiKey,
        model: primaryModel,
        messages: apiMessages,
        useTools: false,
        useJsonSchema: true,
        preferGroq: true,
      }));
    }

    if (!res.ok) {
      console.error(
        'scout+json_schema fail',
        res.status,
        data?.error?.message || data?.error
      );
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
      return json(
        event,
        res.status >= 400 && res.status < 600 ? res.status : 502,
        {
          error: msg.slice(0, 300),
        }
      );
    }

    let choice = data?.choices?.[0]?.message || {};
    let { reply, actions, summary } = extractFromChoice(choice);
    reply = finalizeReply(reply, summary, actions);

    // N-01 retry: טקסט מציע תנועה אבל אין actions מאומתים
    if (!actions.length && textSuggestsEntry(reply)) {
      const retryMessages = [
        ...apiMessages,
        { role: 'assistant', content: reply },
        { role: 'user', content: STRUCTURED_RETRY_REMINDER },
      ];
      let retryRes;
      let retryData;
      ({ res: retryRes, data: retryData } = await callUpstream({
        apiKey,
        model: primaryModel,
        messages: retryMessages,
        useTools: true,
        preferGroq: true,
      }));
      if (!retryRes.ok) {
        ({ res: retryRes, data: retryData } = await callUpstream({
          apiKey,
          model: primaryModel,
          messages: retryMessages,
          useTools: false,
          useJsonSchema: true,
          preferGroq: true,
        }));
      }
      if (retryRes.ok) {
        choice = retryData?.choices?.[0]?.message || {};
        const second = extractFromChoice(choice);
        const retryActions = validActions(second.actions);
        if (retryActions.length) {
          actions = retryActions;
          reply = finalizeReply(second.reply, second.summary, actions);
        } else {
          // נכשל שוב — רק טקסט, בלי הצעה מובנית
          actions = [];
          reply = finalizeReply(second.reply || reply, second.summary, []);
        }
        data = retryData;
      }
    }

    actions = validActions(actions);

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
