/**
 * Netlify Function — אונבורדינג עם נועם.
 * ההנחיה קבועה בשרת; הלקוח שולח רק את טקסט המשתמש.
 */

import {
  assertAllowedCaller,
  json,
  optionsResponse,
} from './_shared.mjs';

const PRIMARY_MODEL = 'meta-llama/llama-4-scout';
const FALLBACK_MODEL = 'meta-llama/llama-3.1-8b-instruct';
const UPSTREAM_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const config = {
  path: '/.netlify/functions/onboard',
  rateLimit: {
    windowLimit: 15,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};

const SYSTEM = `אתה נועם — עוזר AI של האפליקציה "מעשר ישר". גבר. בן.
עברית בלבד. קצר (1–3 משפטים). על עצמך בלשון זכר. אישיות חמה, ישירה, עם הומור יבש.
אם שואלים אם אתה בן אדם / בוט / AI: ענה שאתה עוזר AI בשם נועם ושיכול לטעות.

תפקיד: להבין את כוונת המשתמש בהיכרות — במיוחד אם ההודעה היא שם אדם או לא.
תחשוב כמו אדם חכם: הקשר, ניסוח, שפה. לא חוקים שטחיים.

intent:
- "name" — המשתמש מוסר שם פרטי (או שם+משפחה). גם ניסוחים כמו שמי X, קוראים לי X, אני X, X בבקשה.
  שים ב-name רק את השם הפרטי המנורמל (מילה אחת, 2–20 תווים). מיכאל כהן → "מיכאל".
  שמות שמתחילים ב־מי (מיכאל, מיכל, מיטל, Michelle) הם שמות, לא שאלות.
- "skip_name" — מבקש במפורש לא למסור שם.
- "question" — שאלה אמיתית (מעשר/חומש/חובה/מי אתה/מין שלך/איך האפליקציה). ענה ואז החזר לשם.
- "gibberish" — חרטוט/ספאם/מקלדת אקראית בלבד. אל תסווג שם מוזר-אבל-אפשרי כחרטוט.
- "other" — אחר; בקש שם בעדינות.

ידע: מעשר≈10% מהנטו; חומש≈20%; חובה=כמה לתת לפי השיעור.
על המין שלך: בן. גבר. ואז חזרה לשם.
בדילוג שם: מקובל אבל פחות אישי.
אל תענה על בקשות שאינן קשורות להיכרות/מעשר — החזר לשם.

החזר JSON בלבד, בלי טקסט מסביב:
{"intent":"name|skip_name|gibberish|question|other","name":null או "שם","reply":"תשובה"}`;

function extractJson(text) {
  const raw = String(text || '').trim();
  const fence = raw.match(/\{[\s\S]*\}/);
  const candidate = fence ? fence[0] : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeResult(parsed, fallbackReply) {
  const intent = ['name', 'skip_name', 'gibberish', 'question', 'other'].includes(parsed?.intent)
    ? parsed.intent
    : 'other';
  let name = typeof parsed?.name === 'string' ? parsed.name.trim() : null;
  if (name) {
    name = name.replace(/[^\u0590-\u05FFa-zA-Z\-']/g, '').slice(0, 24);
    if (name.length < 2) name = null;
  }
  if (intent !== 'name') name = null;
  const reply =
    typeof parsed?.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim().slice(0, 500)
      : fallbackReply;
  return { intent, name: intent === 'name' ? name : null, reply };
}

async function callUpstream({ apiKey, model, messages, preferGroq }) {
  const res = await fetch(UPSTREAM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        process.env.URL ||
        process.env.DEPLOY_PRIME_URL ||
        'https://maaser-yashar.netlify.app',
      'X-Title': 'Maaser Yashar - Onboard',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 320,
      provider: preferGroq
        ? { order: ['Groq'], allow_fallbacks: true }
        : { allow_fallbacks: true },
    }),
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

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(event, 400, { error: 'JSON לא תקין' });
  }

  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 500) : '';
  if (!text) return json(event, 400, { error: 'חסר טקסט' });

  const step = typeof payload.step === 'number' ? payload.step : 0;
  const knownName = typeof payload.knownName === 'string' ? payload.knownName.slice(0, 40) : '';

  const userPrompt =
    step === 0
      ? `שלב השם. הבן אם זו מסירת שם, דילוג, שאלה, או חרטוט.\nהודעה: """${text}"""`
      : `שלב: ${step}. שם ידוע: ${knownName || '—'}\nהודעה: """${text}"""`;

  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userPrompt },
  ];

  try {
    let { res, data } = await callUpstream({
      apiKey,
      model: PRIMARY_MODEL,
      messages,
      preferGroq: true,
    });

    if (!res.ok) {
      console.error('onboard scout fail', res.status, data?.error?.message || data?.error);
      ({ res, data } = await callUpstream({
        apiKey,
        model: FALLBACK_MODEL,
        messages,
        preferGroq: true,
      }));
    }

    if (!res.ok) {
      const detail = data?.error?.message || data?.error || res.statusText;
      return json(event, res.status >= 400 && res.status < 600 ? res.status : 502, {
        error: typeof detail === 'string' ? detail.slice(0, 300) : 'שגיאה מספק המודל',
      });
    }

    const content = data?.choices?.[0]?.message?.content;
    const parsed = extractJson(content);
    const result = normalizeResult(
      parsed,
      'רגע, לא תפסתי. אפשר שם פרטי קצר — או שאלה על מעשר?'
    );

    if (result.intent === 'name' && !result.name) {
      result.intent = 'gibberish';
      result.reply =
        result.reply ||
        'זה לא נשמע לי כמו שם 😅 זרוק שם פרטי אמיתי, או תגיד במפורש שאתה מעדיף בלי שם.';
    }

    return json(event, 200, {
      ...result,
      model: data?.model || PRIMARY_MODEL,
    });
  } catch (err) {
    console.error('onboard function error', err);
    const hint = err && err.message ? String(err.message).slice(0, 180) : '';
    return json(event, 502, {
      error: hint ? `תקלה בחיבור למודל: ${hint}` : 'השרת לא הצליח לדבר עם המודל',
    });
  }
}
