/**
 * Netlify Function — אונבורדינג זול (Llama 3.1 8B).
 */

const MODEL = 'meta-llama/llama-3.1-8b-instruct';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
    body: JSON.stringify(body),
  };
}

const SYSTEM = `אתה נועם — חבר חם ומקצועי באפליקציית «מעשר ישר». עברית בלבד. קצר (1–3 משפטים). חוש הומור קל, ישר, לא מלחך־פנכה.

המשתמש נמצא בהיכרות (אונבורדינג). סווג את ההודעה והשב.

intent:
- "name" — שם פרטי אמיתי סביר (2–20 תווים).
- "skip_name" — מבקש במפורש לא למסור שם.
- "gibberish" — חרטוט / ספאם / מקלדת אקראית.
- "question" — שאלה בסיסית על מעשר / האפליקציה.
- "other" — אחר.

כללים: אל תקבל חרטוט כשם. בדילוג — ציין שזה מקובל אבל פחות אישי.
החזר JSON בלבד:
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
  if (name && (name.length < 2 || name.length > 24)) name = null;
  if (intent !== 'name') name = null;
  const reply =
    typeof parsed?.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim().slice(0, 500)
      : fallbackReply;
  return { intent, name: intent === 'name' ? name : null, reply };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) {
    return json(500, {
      error:
        'חסר OPENROUTER_API_KEY ב־Netlify (Production). Site settings → Environment variables.',
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON לא תקין' });
  }

  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 500) : '';
  if (!text) return json(400, { error: 'חסר טקסט' });

  const step = typeof payload.step === 'number' ? payload.step : 0;
  const knownName = typeof payload.knownName === 'string' ? payload.knownName.slice(0, 40) : '';

  const userPrompt = `שלב: ${step} (0=שם). שם ידוע: ${knownName || '—'}\nהודעה: """${text}"""`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':
          process.env.URL ||
          process.env.DEPLOY_PRIME_URL ||
          'https://maaser-yashar.netlify.app',
        'X-Title': 'Maaser Yashar — Onboard',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 280,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data?.error?.message || data?.error || res.statusText;
      return json(res.status >= 400 && res.status < 600 ? res.status : 502, {
        error: typeof detail === 'string' ? detail.slice(0, 300) : 'שגיאה מ־OpenRouter',
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

    return json(200, { ...result, model: data?.model || MODEL });
  } catch (err) {
    console.error('onboard function error', err);
    const hint = err && err.message ? String(err.message).slice(0, 180) : '';
    return json(502, {
      error: hint ? `תקלה בחיבור למודל: ${hint}` : 'השרת לא הצליח לדבר עם המודל',
    });
  }
}
