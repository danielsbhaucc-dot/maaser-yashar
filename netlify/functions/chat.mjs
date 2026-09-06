/**
 * Netlify Function — שער ל־OpenRouter (Llama 4 Scout, העדפת Groq).
 * המפתח נשאר בשרת בלבד: OPENROUTER_API_KEY בהגדרות Netlify.
 */

const MODEL = 'meta-llama/llama-4-scout';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'propose_entries',
      description:
        'הצע תנועות להוספה לפנקס המעשר. קרא לזה רק כשהמשתמש ציין סכומים ברורים (הכנסה / הוצאה ממסים־עסק / צדקה שניתנה).',
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
                  description:
                    'income=הכנסה לבסיס, expense=ניכוי מבסיס (מס/ביטוח/הוצאות עסק), tzedaka=כבר ניתן לצדקה',
                },
                amount: { type: 'number', description: 'סכום חיובי בש״ח' },
                category: {
                  type: 'string',
                  description: 'קטגוריה בעברית מתוך הרשימה הידועה או «אחר»',
                },
                note: { type: 'string' },
              },
              required: ['kind', 'amount', 'category'],
            },
          },
          summary: {
            type: 'string',
            description: 'משפט קצר בעברית שמסכם מה מוצע להוסיף',
          },
        },
        required: ['entries', 'summary'],
      },
    },
  },
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...cors },
    body: JSON.stringify(body),
  };
}

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

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json(500, {
      error: 'חסר OPENROUTER_API_KEY בהגדרות Netlify',
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON לא תקין' });
  }

  const { messages, system } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: 'חסרות הודעות' });
  }
  if (messages.length > 40) {
    return json(400, { error: 'שיחה ארוכה מדי' });
  }

  const cleaned = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-24)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 4000),
    }));

  if (!cleaned.length) {
    return json(400, { error: 'אין הודעות תקינות' });
  }

  const systemPrompt =
    typeof system === 'string' && system.trim()
      ? system.trim().slice(0, 8000)
      : 'אתה נועם, עוזר למעשר. ענה בעברית קצרה.';

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://maaser.app',
        'X-Title': 'Maaser Yashar — Noam',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...cleaned],
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.55,
        max_tokens: 900,
        provider: {
          order: ['Groq'],
          allow_fallbacks: true,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data?.error?.message || data?.error || res.statusText;
      return json(res.status >= 400 && res.status < 600 ? res.status : 502, {
        error: typeof detail === 'string' ? detail : 'שגיאה מ־OpenRouter',
      });
    }

    const choice = data?.choices?.[0]?.message || {};
    const { actions, summary } = parseToolActions(choice.tool_calls);
    let reply = typeof choice.content === 'string' ? choice.content.trim() : '';

    if (!reply && summary) {
      reply = summary;
    }
    if (!reply && actions.length) {
      reply = `רשמתי לעצמי ${actions.length} תנועות — לאשר בפנקס?`;
    }
    if (!reply) {
      reply = 'רגע, לא הצלחתי לנסח תשובה. נסה שוב בקצרה?';
    }

    return json(200, {
      reply,
      actions,
      model: data?.model || MODEL,
    });
  } catch (err) {
    console.error('chat function error', err);
    return json(502, { error: 'השרת לא הצליח לדבר עם המודל' });
  }
}
