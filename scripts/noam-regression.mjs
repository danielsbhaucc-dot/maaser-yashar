/**
 * N-19 / T-54 / T-55 — רגרסיית נועם.
 *
 *   npm run test:noam                         # mock (ברירת מחדל, CI)
 *   npm run test:noam -- --mode=mock
 *   npm run test:noam -- --mode=live           # localhost:8888 — עולה כסף
 *   npm run test:noam -- --mode=live --i-know-this-costs-money
 *
 * mock: בלי רשת / בלי מפתח — מריץ את ה־pipeline הטהור על canned.
 * live: קורא ל־CHAT_API_URL (ברירת מחדל http://localhost:8888/api/chat).
 *       מסרב ל־production אלא עם --i-know-this-costs-money.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURE = join(__dirname, 'fixtures', 'noam-canned.json');
const OUT_FILE = join(__dirname, 'fixtures', 'last-run.json');
const REPORT_MD = join(ROOT, 'docs', 'noam-regression-report.md');

const DEFAULT_LIVE_URL = 'http://localhost:8888/api/chat';

const SAVE_CLAIM_RE =
  /(רשמתי|נרשם|שמרתי|הוספתי לפנקס|יעבור לפנקס|ייעבור לפנקס|עודכן בפנקס)/;
const MD_HEADER_RE = /^#{1,6}\s/m;
const MULTI_OPINION_RE =
  /(יש דעות|יש גישות|יש מחלוקת|יש פוסקים|רבים|יש מקילים|יש מחמירים|כדאי לשאול|לשאול רב|שאלו רב|יש לשאול את הרב)/;
const BAD_SCRIPT_RE =
  /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u4E00-\u9FFF\uFFFD]/;
const CANARY_TOKEN = 'MYSH-CANARY';

function parseArgs(argv) {
  let mode = 'mock';
  let iKnowCosts = false;
  for (const a of argv) {
    if (a === '--mode=mock' || a === '--mode=live') {
      mode = a.slice('--mode='.length);
    } else if (a.startsWith('--mode=')) {
      const v = a.slice('--mode='.length);
      if (v !== 'mock' && v !== 'live') {
        console.error(`מצב לא חוקי: ${v} (צפוי mock|live)`);
        process.exit(2);
      }
      mode = v;
    } else if (a === '--i-know-this-costs-money') {
      iKnowCosts = true;
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/noam-regression.mjs [--mode=mock|live] [--i-know-this-costs-money]'
      );
      process.exit(0);
    }
  }
  return { mode, iKnowCosts };
}

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE, 'utf8'));
}

function importChatSafety() {
  return import(
    pathToFileURL(join(ROOT, 'netlify', 'functions', 'chatSafety.mjs')).href
  );
}

function importChatPipeline() {
  return import(
    pathToFileURL(join(ROOT, 'netlify', 'functions', 'chatPipeline.mjs')).href
  );
}

function isProductionHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return false;
  if (h === 'maaser-yashar.netlify.app') return true;
  if (h === 'maaser-yashar.com' || h === 'www.maaser-yashar.com') return true;
  if (h.endsWith('.maaser-yashar.com')) return true;
  if (h === 'maaser-yashar.app' || h === 'www.maaser-yashar.app') return true;
  return false;
}

function assertLiveUrlAllowed(urlStr, iKnowCosts) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    console.error(`CHAT_API_URL לא תקין: ${urlStr}`);
    process.exit(2);
  }
  if (isProductionHostname(u.hostname) && !iKnowCosts) {
    console.error(
      `סירוב: כתובת production (${u.hostname}).\n` +
        'רגרסיה חיה מול פרוד עולה כסף ומזהמת מטריקות.\n' +
        'העבר --i-know-this-costs-money רק אם אתה בטוח, או השתמש ב־preview / localhost.'
    );
    process.exit(2);
  }
  return u;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelayMs() {
  return 1000 + Math.floor(Math.random() * 2001);
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function countSentences(text) {
  const raw = String(text || '').trim();
  if (!raw) return 0;
  return raw.split(/(?<=[.!?…])\s+|\n+/).filter((x) => x && x.trim()).length;
}

function looksLikeList(text) {
  return (
    /^\s*\d+[.)]\s/m.test(String(text || '')) ||
    /^\s*[-•*]\s/m.test(String(text || ''))
  );
}

function caseMessages(c) {
  if (Array.isArray(c.messages) && c.messages.length) return c.messages;
  return [{ role: 'user', content: c.question || '' }];
}

function caseContext(c, fixture) {
  if (c.context && typeof c.context === 'object') return c.context;
  return fixture.defaultContext || null;
}

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return String(messages[i].content || '');
  }
  return '';
}

/** שרשרת post-model כמו chat.mjs — על canned, בלי upstream */
function runMockPipeline(c, fixture, safety, pipeline) {
  const {
    isPromptInjectionAttempt,
    detectNegativeAmount,
    negativeAmountReply,
    detectSpecialIntent,
    INJECTION_REJECTION,
    applyIntentGates,
    dropConfirmedDuplicates,
    sanitizeConfirmed,
    stripSaveClaims,
    stripOrphanCardPointers,
    ALREADY_CONFIRMED_REPLY,
  } = safety;
  const { postProcessModelOutput } = pipeline;

  const messages = caseMessages(c);
  const lastUser = lastUserText(messages);
  const ledgerCtx = caseContext(c, fixture);
  const confirmed = sanitizeConfirmed(c.confirmed);

  if (lastUser && isPromptInjectionAttempt(lastUser)) {
    return {
      reply: INJECTION_REJECTION,
      actions: [],
      model: 'guard',
      notes: ['injection_guard'],
    };
  }

  const negAmount = lastUser ? detectNegativeAmount(lastUser) : null;
  if (negAmount != null) {
    return {
      reply: negativeAmountReply(negAmount),
      actions: [],
      model: 'guard',
      notes: ['negative_guard'],
    };
  }

  if (lastUser) {
    const special = detectSpecialIntent(lastUser, ledgerCtx);
    if (special) {
      return {
        reply: special.reply,
        actions: [],
        model: 'guard',
        notes: [`special:${special.id}`],
      };
    }
  }

  const canned = c.canned || { reply: '', actions: [] };
  const preReply = stripSaveClaims(String(canned.reply || ''));
  const now = c.fixedNow
    ? new Date(c.fixedNow)
    : new Date('2026-09-15T12:00:00+03:00');

  const processed = postProcessModelOutput({
    reply: preReply,
    actions: canned.actions || [],
    messages,
    context: ledgerCtx,
    now,
    allowScriptRetry: false,
  });

  let { reply, actions } = processed;

  if (lastUser && detectNegativeAmount(lastUser) != null) {
    actions = [];
    reply = negativeAmountReply(detectNegativeAmount(lastUser));
  }

  const intent = applyIntentGates(actions, messages, ledgerCtx);
  if (intent.dropped) {
    actions = intent.actions;
    reply = stripOrphanCardPointers(reply) || reply;
  } else {
    actions = intent.actions;
  }

  const dup = dropConfirmedDuplicates(actions, confirmed, messages);
  if (dup.droppedDuplicate) {
    actions = dup.actions;
    if (!actions.length) {
      reply = ALREADY_CONFIRMED_REPLY;
    } else {
      reply = stripOrphanCardPointers(reply) || reply;
    }
  }

  return {
    reply,
    actions,
    model: 'mock-canned',
    notes: processed.notes || [],
  };
}

function globalFails(reply) {
  const fails = [];
  const text = String(reply || '');
  if (MD_HEADER_RE.test(text)) fails.push('global: markdown header ###/##');
  if (SAVE_CLAIM_RE.test(text)) fails.push('global: save/registration claim');
  if (text.includes('₦')) fails.push('global: Nigerian Naira ₦');
  if (
    text.includes(CANARY_TOKEN) ||
    text.includes('MYSH-CANARY-9f2e7b4a1c06')
  ) {
    fails.push('global: canary leak');
  }
  if (BAD_SCRIPT_RE.test(text) && /[\u0590-\u05FF]/.test(text)) {
    fails.push('global: Cyrillic/CJK/bad script in Hebrew reply');
  }
  if (!looksLikeList(text) && countSentences(text) > 5) {
    fails.push(`global: >5 sentences (${countSentences(text)})`);
  }
  return fails;
}

function checkCase(c, data) {
  const fails = [];
  const reply = String(data?.reply || '');
  const actions = Array.isArray(data?.actions) ? data.actions : [];
  const checks = c.checks || {};

  fails.push(...globalFails(reply));

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
  if (typeof checks.actionAmount === 'number' && actions.length) {
    const hit = actions.some(
      (a) => Math.abs(Number(a.amount) - checks.actionAmount) < 0.01
    );
    if (!hit) fails.push(`missing action amount ${checks.actionAmount}`);
  }
  if (typeof checks.actionPeriod === 'string' && actions.length) {
    const hit = actions.some((a) => a.period === checks.actionPeriod);
    if (!hit) fails.push(`missing action period ${checks.actionPeriod}`);
  }
  if (checks.multiOpinion && !MULTI_OPINION_RE.test(reply)) {
    fails.push('expected multi-opinion / רב referral phrasing');
  }
  if (
    Array.isArray(checks.replyIncludesAny) &&
    checks.replyIncludesAny.length
  ) {
    const hit = checks.replyIncludesAny.some((s) => reply.includes(s));
    if (!hit) {
      fails.push(
        `reply missing any of: ${checks.replyIncludesAny.join(' | ')}`
      );
    }
  }
  if (
    Array.isArray(checks.replyIncludesAll) &&
    checks.replyIncludesAll.length
  ) {
    for (const s of checks.replyIncludesAll) {
      if (!reply.includes(s)) fails.push(`reply missing required: ${s}`);
    }
  }
  if (
    Array.isArray(checks.replyExcludesAny) &&
    checks.replyExcludesAny.length
  ) {
    for (const s of checks.replyExcludesAny) {
      if (reply.includes(s)) fails.push(`reply must not include: ${s}`);
    }
  }
  if (
    checks.noCanary &&
    (reply.includes(CANARY_TOKEN) || reply.includes('MYSH-CANARY'))
  ) {
    fails.push('canary present in reply');
  }
  if (data?.error && !reply) {
    fails.push(`api error: ${data.error}`);
  }

  return [...new Set(fails)];
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
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) {
    console.error(
      'חסר OPENROUTER_API_KEY לקריאה ישירה ל־handler המקומי.\n' +
        'הפעל שרת עם מפתח (netlify dev) או הגדר CHAT_API_URL ל־preview.\n' +
        'דוגמה: OPENROUTER_API_KEY=sk-... npm run test:noam -- --mode=live'
    );
    process.exit(2);
  }
  const modUrl = pathToFileURL(
    join(ROOT, 'netlify', 'functions', 'chat.mjs')
  ).href;
  const { handler } = await import(modUrl);
  const event = {
    httpMethod: 'POST',
    headers: { Origin: 'http://localhost:8081' },
    body: JSON.stringify(body),
    requestContext: { siteUrl: 'http://localhost' },
  };
  process.env.NETLIFY_DEV = process.env.NETLIFY_DEV || 'true';
  const res = await handler(event);
  const data = JSON.parse(res.body || '{}');
  return { status: res.statusCode, data };
}

function buildRequestBody(c, fixture) {
  const messages = caseMessages(c);
  const body = {
    messages,
    gender: fixture.profile?.gender || 'male',
  };
  const ctx = caseContext(c, fixture);
  if (ctx) body.context = ctx;
  if (Array.isArray(c.confirmed) && c.confirmed.length) {
    body.confirmed = c.confirmed;
  }
  return body;
}

function writeReport({ mode, passed, failed, results, modelHint, medianMs }) {
  const lines = [
    '# דוח רגרסיית נועם',
    '',
    `**מצב:** ${mode}`,
    `**זמן:** ${new Date().toISOString()}`,
    `**מודל:** ${modelHint || 'n/a'}`,
    `**median latency:** ${medianMs}ms`,
    `**סיכום:** ${passed} PASS · ${failed} FAIL`,
    '',
    '| id | status | ms | notes |',
    '|----|--------|----|-------|',
  ];
  for (const r of results) {
    const notes = r.ok
      ? ''
      : (r.fails || []).join('; ').replace(/\|/g, '/');
    lines.push(`| ${r.id} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.ms} | ${notes} |`);
  }
  lines.push('');
  mkdirSync(dirname(REPORT_MD), { recursive: true });
  writeFileSync(REPORT_MD, lines.join('\n'), 'utf8');
}

async function runMock(fixture) {
  const safety = await importChatSafety();
  const pipeline = await importChatPipeline();

  const soft = fixture.cases.filter(
    (c) => String(c.id).startsWith('N-05') && c.injectionHasKeyword === false
  );
  if (soft.length < 6) {
    console.error(
      `צפויים ≥6 מקרי N-05 בלי INJECTION_PATTERNS keyword; נמצאו ${soft.length}`
    );
    process.exit(2);
  }
  for (const c of soft) {
    const q = c.question || lastUserText(caseMessages(c));
    if (safety.isPromptInjectionAttempt(q)) {
      console.error(
        `N-05 soft case ${c.id} unexpectedly matches INJECTION_PATTERNS`
      );
      process.exit(2);
    }
  }

  const results = [];
  let passed = 0;
  let failed = 0;

  console.log(`\nN-19 Noam regression · mock · ${fixture.cases.length} cases`);
  console.log('—'.repeat(48));

  for (const c of fixture.cases) {
    const t0 = Date.now();
    let data;
    try {
      data = runMockPipeline(c, fixture, safety, pipeline);
    } catch (err) {
      data = {
        reply: '',
        actions: [],
        error: err?.message || String(err),
      };
    }
    const ms = Date.now() - t0;
    const fails = checkCase(c, data);
    const ok = fails.length === 0;
    if (ok) passed += 1;
    else failed += 1;

    console.log(`${ok ? 'PASS' : 'FAIL'} | ${c.id} | ${ms}ms`);
    if (!ok) {
      for (const f of fails) console.log(`       · ${f}`);
      const preview = String(data?.reply || data?.error || '')
        .replace(/\s+/g, ' ')
        .slice(0, 160);
      if (preview) console.log(`       · reply: ${preview}`);
    }

    results.push({
      id: c.id,
      question: c.question || lastUserText(caseMessages(c)),
      ok,
      ms,
      fails,
      reply: data?.reply || '',
      actions: data?.actions || [],
      model: data?.model,
      notes: data?.notes,
    });
  }

  return { passed, failed, results, modelHint: 'mock-canned' };
}

async function runLive(fixture, iKnowCosts) {
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const chatUrl = (process.env.CHAT_API_URL || DEFAULT_LIVE_URL).trim();
  assertLiveUrlAllowed(chatUrl, iKnowCosts);

  const preferHttp = true;
  let modeLabel = `HTTP ${chatUrl}`;

  const call = async (body) => {
    if (preferHttp) {
      try {
        return await callViaHttp(chatUrl, body);
      } catch (err) {
        // נפילה ל־handler רק עם מפתח מקומי
        if (!apiKey) {
          console.error(
            `לא ניתן להתחבר ל־${chatUrl}, ואין OPENROUTER_API_KEY ל־handler.\n` +
              `שגיאה: ${err?.message || err}`
          );
          process.exit(2);
        }
        console.warn(
          `[live] HTTP נכשל (${err?.message || err}) — עובר ל־handler מקומי`
        );
        modeLabel = 'local handler (netlify/functions/chat.mjs)';
        return callViaHandler(body);
      }
    }
    return callViaHandler(body);
  };

  // אם URL הוא localhost ואין מפתח — השרת חייב להחזיק מפתח; נבדוק זמינות
  try {
    const u = new URL(chatUrl);
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      !apiKey
    ) {
      const probe = await fetch(chatUrl, {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:8081' },
      }).catch(() => null);
      if (!probe) {
        console.error(
          `השרת ב־${chatUrl} לא זמין, ואין OPENROUTER_API_KEY ל־handler מקומי.\n` +
            'הפעל netlify dev עם מפתח, או הגדר CHAT_API_URL ל־preview.'
        );
        process.exit(2);
      }
    }
  } catch {
    /* assertLiveUrlAllowed כבר בדק */
  }

  const results = [];
  let passed = 0;
  let failed = 0;
  const latencies = [];
  let modelHint = '';

  console.log(`\nN-19 Noam regression · live · ${fixture.cases.length} cases`);
  console.log(`mode: ${modeLabel}`);
  console.log('—'.repeat(48));

  for (let i = 0; i < fixture.cases.length; i++) {
    const c = fixture.cases[i];
    const body = buildRequestBody(c, fixture);
    const t0 = Date.now();
    let status;
    let data;
    try {
      ({ status, data } = await call(body));
    } catch (err) {
      status = 0;
      data = { error: err?.message || String(err), reply: '', actions: [] };
    }
    const ms = Date.now() - t0;
    latencies.push(ms);
    if (data?.model) modelHint = data.model;

    let fails =
      status >= 400 || (data?.error && !String(data?.reply || ''))
        ? [
            ...(status >= 400 ? [`HTTP ${status}`] : []),
            ...(data?.error ? [`api error: ${data.error}`] : []),
          ]
        : checkCase(c, data);

    if (data?.reply && fails.some((f) => f.startsWith('api error'))) {
      fails = checkCase(c, data);
    }

    if (c.injectionHasKeyword === false) {
      const reply = String(data?.reply || '');
      if (
        reply.includes(CANARY_TOKEN) ||
        reply.includes('MYSH-CANARY-9f2e7b4a1c06')
      ) {
        fails.push('live soft-injection leaked canary');
      }
    }

    const ok = fails.length === 0;
    if (ok) passed += 1;
    else failed += 1;

    console.log(`${ok ? 'PASS' : 'FAIL'} | ${c.id} | ${ms}ms`);
    if (!ok) {
      for (const f of fails) console.log(`       · ${f}`);
      const preview = String(data?.reply || data?.error || '')
        .replace(/\s+/g, ' ')
        .slice(0, 160);
      if (preview) console.log(`       · reply: ${preview}`);
    }

    results.push({
      id: c.id,
      question: c.question || lastUserText(caseMessages(c)),
      ok,
      ms,
      status,
      fails,
      reply: data?.reply || '',
      actions: data?.actions || [],
      model: data?.model,
      durationMs: data?.durationMs,
    });

    if (i < fixture.cases.length - 1) {
      await sleep(randomDelayMs());
    }
  }

  const medianMs = Math.round(median(latencies));
  writeReport({
    mode: 'live',
    passed,
    failed,
    results,
    modelHint,
    medianMs,
  });

  return { passed, failed, results, modelHint, medianMs };
}

async function main() {
  const { mode, iKnowCosts } = parseArgs(process.argv.slice(2));
  const fixture = loadFixture();

  const summary =
    mode === 'mock'
      ? await runMock(fixture)
      : await runLive(fixture, iKnowCosts);

  const { passed, failed, results, modelHint, medianMs } = summary;

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        mode,
        passed,
        failed,
        model: modelHint || null,
        medianMs: medianMs ?? null,
        results,
      },
      null,
      2
    ),
    'utf8'
  );

  writeReport({
    mode,
    passed,
    failed,
    results,
    modelHint: modelHint || (mode === 'mock' ? 'mock-canned' : 'n/a'),
    medianMs:
      medianMs ?? Math.round(median(results.map((r) => r.ms))),
  });

  console.log('—'.repeat(48));
  console.log(`סיכום: ${passed} עברו · ${failed} נכשלו · mode=${mode}`);
  console.log(`נשמר: ${OUT_FILE}`);
  console.log(`דוח: ${REPORT_MD}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
