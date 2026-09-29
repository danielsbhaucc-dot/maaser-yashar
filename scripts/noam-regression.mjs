/**
 * N-19 / T-55 — סט רגרסיה אוטומטי לנועם (פרק 7).
 *
 * הרצה (פקודה אחת):
 *   npm run test:noam
 *
 * דורש מפתח OpenRouter (לא לקומיט):
 *   OPENROUTER_API_KEY=... npm run test:noam
 *
 * אופציות:
 *   CHAT_API_URL=https://…/api/chat   — קריאה ל־HTTP (preview/prod/local netlify)
 *   (ברירת מחדל בלי URL)               — קריאה ישירה ל־handler המקומי
 *
 * לשמור תשובות:
 *   scripts/fixtures/chapter7-last-run.json
 *
 * להריץ לפני כל שינוי בפרומפט או במודל.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURE = join(__dirname, 'fixtures', 'chapter7-noam.json');
const OUT_FILE = join(__dirname, 'fixtures', 'chapter7-last-run.json');

const SAVE_CLAIM_RE =
  /(רשמתי|נרשם|שמרתי|הוספתי לפנקס|יעבור לפנקס|ייעבור לפנקס|עודכן בפנקס)/;
const MD_HEADER_RE = /^#{1,6}\s/m;
const MULTI_OPINION_RE =
  /(יש דעות|יש גישות|יש מחלוקת|יש פוסקים|רבים|יש מקילים|יש מחמירים|כדאי לשאול|לשאול רב|שאלו רב)/;

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE, 'utf8'));
}

async function callViaHttp(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:8081',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function callViaHandler(body) {
  // טעינה דינמית — דורשת OPENROUTER_API_KEY בסביבה
  const { handler } = await import(
    join(ROOT, 'netlify', 'functions', 'chat.mjs').replace(/\\/g, '/')
  );
  const event = {
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify(body),
    requestContext: { siteUrl: 'http://localhost' },
  };
  // סימון סביבת פיתוח ל־assertAllowedCaller
  process.env.NETLIFY_DEV = process.env.NETLIFY_DEV || 'true';
  const res = await handler(event);
  const data = JSON.parse(res.body || '{}');
  return { status: res.statusCode, data };
}

function checkCase(c, data) {
  const fails = [];
  const reply = String(data?.reply || '');
  const actions = Array.isArray(data?.actions) ? data.actions : [];
  const checks = c.checks || {};

  if (checks.noMarkdownHeaders && MD_HEADER_RE.test(reply)) {
    fails.push('found markdown header (###/##/#)');
  }
  if (checks.noSaveClaims && SAVE_CLAIM_RE.test(reply)) {
    fails.push('save/registration claim in reply');
  }
  if (checks.expectActions === true && actions.length === 0) {
    fails.push('expected actions but got none');
  }
  if (checks.expectActions === false && actions.length > 0) {
    fails.push(`expected no actions, got ${actions.length}`);
  }
  if (Array.isArray(checks.actionKinds) && checks.actionKinds.length) {
    const kinds = new Set(actions.map((a) => a.kind));
    for (const k of checks.actionKinds) {
      if (!kinds.has(k)) fails.push(`missing action kind: ${k}`);
    }
  }
  if (checks.multiOpinion && !MULTI_OPINION_RE.test(reply)) {
    fails.push('expected multi-opinion / רב referral phrasing');
  }
  if (Array.isArray(checks.replyIncludesAny) && checks.replyIncludesAny.length) {
    const hit = checks.replyIncludesAny.some((s) => reply.includes(s));
    if (!hit) {
      fails.push(
        `reply missing any of: ${checks.replyIncludesAny.join(' | ')}`
      );
    }
  }
  if (data?.error && !reply) {
    fails.push(`api error: ${data.error}`);
  }

  return fails;
}

async function main() {
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const chatUrl = (process.env.CHAT_API_URL || '').trim();

  if (!chatUrl && !apiKey) {
    console.error(
      'חסר OPENROUTER_API_KEY (לקריאה מקומית) או CHAT_API_URL (ל־HTTP).\n' +
        'דוגמה: OPENROUTER_API_KEY=sk-... npm run test:noam'
    );
    process.exit(2);
  }

  const fixture = loadFixture();
  const results = [];
  let passed = 0;
  let failed = 0;

  console.log(`\nN-19 Noam regression · ${fixture.cases.length} cases`);
  console.log(
    chatUrl
      ? `mode: HTTP ${chatUrl}`
      : 'mode: local handler (netlify/functions/chat.mjs)'
  );
  console.log('—'.repeat(48));

  for (const c of fixture.cases) {
    const body = {
      messages: [{ role: 'user', content: c.question }],
      gender: 'male',
    };
    if (c.context) body.context = c.context;

    const t0 = Date.now();
    let status;
    let data;
    try {
      ({ status, data } = chatUrl
        ? await callViaHttp(chatUrl, body)
        : await callViaHandler(body));
    } catch (err) {
      status = 0;
      data = { error: err?.message || String(err), reply: '', actions: [] };
    }
    const ms = Date.now() - t0;
    const fails = status >= 400 || data?.error
      ? [
          ...(status >= 400 ? [`HTTP ${status}`] : []),
          ...(data?.error && !String(data?.reply || '')
            ? [`api error: ${data.error}`]
            : checkCase(c, data)),
        ]
      : checkCase(c, data);

    // אם יש reply למרות error — עדיין בודקים תוכן
    if (data?.reply && fails.some((f) => f.startsWith('api error'))) {
      const contentFails = checkCase(c, data);
      fails.length = 0;
      fails.push(...contentFails);
    }

    const ok = fails.length === 0;
    if (ok) passed += 1;
    else failed += 1;

    const line = `${ok ? 'PASS' : 'FAIL'} | ${c.id} | ${ms}ms`;
    console.log(line);
    if (!ok) {
      for (const f of fails) console.log(`       · ${f}`);
      const preview = String(data?.reply || data?.error || '')
        .replace(/\s+/g, ' ')
        .slice(0, 160);
      if (preview) console.log(`       · reply: ${preview}`);
    }

    results.push({
      id: c.id,
      question: c.question,
      ok,
      ms,
      status,
      fails,
      reply: data?.reply || '',
      actions: data?.actions || [],
      model: data?.model,
      durationMs: data?.durationMs,
    });
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        passed,
        failed,
        results,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('—'.repeat(48));
  console.log(`סיכום: ${passed} עברו · ${failed} נכשלו`);
  console.log(`תשובות נשמרו ב־${OUT_FILE}`);
  console.log(
    'הערה: טון/דקדוק לבדיקה אנושית. מדידת median<6s דורשת OpenRouter חי.'
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
