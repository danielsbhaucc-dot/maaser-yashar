/**
 * Netlify Function — אונבורדינג זול (Llama 3.1 8B / Groq).
 * מחזיר JSON מובנה: שם תקין, דילוג, שאלה, או חרטוט.
 */

const MODEL = 'meta-llama/llama-3.1-8b-instruct:floor';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...cors },
    body: JSON.stringify(body),
  };
}

const SYSTEM = `אתה נועם — חבר חם ומקצועי באפליקציית «מעשר ישר». עברית בלבד. קצר (1–3 משפטים). חוש הומור קל, ישר, לא מלחך־פנכה.

המשתמש נמצא בהיכרות (אונבורדינג). המשימה שלך: לסווג את ההודעה ולהשיב.

סוגים (intent):
- "name" — מסר שם פרטי אמיתי סביר (עברית/אנגלית, 2–20 תווים, לא קללה, לא משפט).
- "skip_name" — מבקש במפורש לא למסור שם («בלי שם», «לא רוצה», «אנונימי», «תדלג»). רק אם מפורש.
- "gibberish" — חרטוט / ספאם / מקלדת אקראית / אימוג'ים בלבד / «asdf» / «xxx» / מספרים בלבד.
- "question" — שואל שאלה בסיסית על מעשר / חומש / האפליקציה / מי אתה.
- "other" — משהו אחר (ברכה, בדיחה…) — ענה בעדינות והחזר לנקודה (שם).

כללים לשם:
- אל תקבל חרטוט כשם. אל «תתקן» חרטוט לשם יפה.
- אם שם סביר — נרמל לכתיב נקי (בלי סימנים מיותרים), שמור על הצורה שהמשתמש התכוון.
- בדילוג על שם: ציין שזה לגמרי מקובל, אבל בלי שם החוויה פחות אישית — ואז המשך בלחיבה.

לשאלות: ענה בקצרה על מעשר 10% / חומש 20% / חישוב מהנטו / שאתה נועם. לא פסק הלכה.

החזר JSON בלבד, בלי markdown:
{"intent":"name|skip_name|gibberish|question|other","name":null או "שם","reply":"תשובה בעברית"}`;

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
  if (intent !== 'name') name = intent === 'name' ? name : null;
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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'חסר OPENROUTER_API_KEY בהגדרות Netlify' });
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

  const userPrompt = `שלב אונבורדינג: ${step} (0=שואלים שם).
שם שכבר ידוע (אם יש): ${knownName || '—'}
הודעת המשתמש: """${text}"""`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://maaser-yashar.netlify.app',
        'X-Title': 'Maaser Yashar — Onboard',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 280,
        provider: { order: ['Groq'], allow_fallbacks: true },
        response_format: { type: 'json_object' },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data?.error?.message || data?.error || res.statusText;
      return json(res.status >= 400 && res.status < 600 ? res.status : 502, {
        error: typeof detail === 'string' ? detail : 'שגיאה מ־OpenRouter',
      });
    }

    const content = data?.choices?.[0]?.message?.content;
    const parsed = extractJson(content);
    const result = normalizeResult(
      parsed,
      'רגע, לא תפסתי. אפשר שם פרטי קצר — או שאלה על מעשר?'
    );

    // אם המודל אמר name בלי שם תקין — הפוך ל־gibberish
    if (result.intent === 'name' && !result.name) {
      result.intent = 'gibberish';
      result.reply =
        result.reply ||
        'זה לא נשמע לי כמו שם 😅 זרוק שם פרטי אמיתי, או תגיד במפורש שאתה מעדיף בלי שם.';
    }

    return json(200, { ...result, model: data?.model || MODEL });
  } catch (err) {
    console.error('onboard function error', err);
    return json(502, { error: 'השרת לא הצליח לדבר עם המודל' });
  }
}
