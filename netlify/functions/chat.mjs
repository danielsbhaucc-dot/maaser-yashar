/**
 * Netlify Function — שער ל־OpenRouter (מודל זול ויציב).
 * OPENROUTER_API_KEY חייב להיות ב־Production (וגם Dev) ב־Netlify Env.
 */

const PRIMARY_MODEL = 'meta-llama/llama-3.1-8b-instruct';
const FALLBACK_MODEL = 'meta-llama/llama-3.1-8b-instruct:floor';
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
        'הצע תנועות להוספה לפנקס המעשר כשהמשתמש ציין סכומים ברורים.',
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

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
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

/** חילוץ תנועות מטקסט אם המודל כתב JSON בתוך התשובה */
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

async function callOpenRouter({ apiKey, model, messages, useTools }) {
  const body = {
    model,
    messages,
    temperature: 0.5,
    max_tokens: 700,
  };
  if (useTools) {
    body.tools = TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetch(OPENROUTER_URL, {
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
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
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
        'חסר OPENROUTER_API_KEY ב־Netlify (Production). Site settings → Environment variables → הוסף ל־Production.',
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
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .slice(-20)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 3000),
    }));

  if (!cleaned.length) {
    return json(400, { error: 'אין הודעות תקינות' });
  }

  const systemPrompt =
    typeof system === 'string' && system.trim()
      ? system.trim().slice(0, 6000)
      : 'אתה נועם, עוזר למעשר. ענה בעברית קצרה.';

  const apiMessages = [{ role: 'system', content: systemPrompt }, ...cleaned];

  try {
    let { res, data } = await callOpenRouter({
      apiKey,
      model: PRIMARY_MODEL,
      messages: apiMessages,
      useTools: true,
    });

    // אם נכשל — ניסיון בלי tools / מודל חלופי
    if (!res.ok) {
      const detail = data?.error?.message || data?.error || res.statusText;
      console.error('openrouter fail', res.status, detail);

      ({ res, data } = await callOpenRouter({
        apiKey,
        model: FALLBACK_MODEL,
        messages: apiMessages,
        useTools: false,
      }));
    }

    if (!res.ok) {
      const detail = data?.error?.message || data?.error || res.statusText;
      const msg =
        typeof detail === 'string'
          ? detail
          : 'OpenRouter דחה את הבקשה — בדוק מפתח וקרדיטים';
      return json(res.status >= 400 && res.status < 600 ? res.status : 502, {
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
      reply = `רשמתי לעצמי ${actions.length} תנועות — לאשר בפנקס?`;
    }
    if (!reply) {
      reply = 'רגע, לא הצלחתי לנסח תשובה. נסה שוב בקצרה?';
    }

    return json(200, {
      reply,
      actions,
      model: data?.model || PRIMARY_MODEL,
    });
  } catch (err) {
    console.error('chat function error', err);
    const hint = err && err.message ? String(err.message).slice(0, 180) : '';
    return json(502, {
      error: hint
        ? `תקלה בחיבור למודל: ${hint}`
        : 'השרת לא הצליח לדבר עם המודל',
    });
  }
}
