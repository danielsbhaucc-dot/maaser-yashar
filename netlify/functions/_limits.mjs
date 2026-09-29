/**
 * מגבלות AI — שכבה שנייה מעל Netlify rateLimit:
 * מונים per-IP (שעתי/יומי) + תקציב גלובלי יומי + kill switch + circuit breaker.
 *
 * גבולות יום/שעה מחושבים לפי Asia/Jerusalem.
 * כתובות IP גולמיות לעולם לא נשמרות — רק sha256(ip + AI_LIMIT_SALT).
 *
 * אם ה־store זורק: FAIL OPEN למוני per-IP (זמינות); ה־backstop הקשיח הוא
 * credit cap במפתח OpenRouter.
 */

import { createHash } from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';

const STORE_NAME = 'ai-limits';
const TRIPPED_KEY = 'global:tripped';
const TRIPPED_TTL_MS = 60 * 60 * 1000;

const DEFAULT_HOURLY = 40;
const DEFAULT_DAILY_IP = 120;
const DEFAULT_DAILY_REQUESTS = 400;
const DEFAULT_DAILY_UPSTREAM = 800;
const DEFAULT_DAILY_BUDGET_USD = 2;

/** YYYYMMDD ו־YYYYMMDDHH לפי Asia/Jerusalem */
export function jerusalemStamp(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const ymd = `${parts.year}${parts.month}${parts.day}`;
  const hour = String(parts.hour).padStart(2, '0');
  return { ymd, ymdHour: `${ymd}${hour}` };
}

export function hashClientIp(ip, salt = process.env.AI_LIMIT_SALT || '') {
  return createHash('sha256')
    .update(String(ip || 'unknown') + String(salt))
    .digest('hex')
    .slice(0, 32);
}

export function clientIpFromEvent(event) {
  const headers = event?.headers || {};
  const pick = (name) => {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower && typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
    return '';
  };
  const nf = pick('x-nf-client-connection-ip');
  if (nf) return nf.split(',')[0].trim();
  const xff = pick('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

export function envInt(name, fallback) {
  const n = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function envFloat(name, fallback) {
  const n = Number.parseFloat(String(process.env[name] || ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function isAiDisabled() {
  return String(process.env.AI_DISABLED || '').toLowerCase() === 'true';
}

/**
 * עדכון אופטימיסטי עם onlyIfMatch / onlyIfNew — עד 3 ניסיונות.
 * mutate(current) → next object או null (אין שינוי).
 */
export async function optimisticUpdate(store, key, mutate, { retries = 3 } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    let current = null;
    let etag = undefined;
    try {
      const got = await store.getWithMetadata(key, { type: 'json' });
      if (got && got.data != null) {
        current = got.data;
        etag = got.etag;
      }
    } catch {
      current = null;
      etag = undefined;
    }

    const next = mutate(current);
    if (next == null) return { ok: true, data: current, skipped: true };

    try {
      if (etag) {
        await store.setJSON(key, next, { onlyIfMatch: etag });
      } else {
        await store.setJSON(key, next, { onlyIfNew: true });
      }
      return { ok: true, data: next };
    } catch (err) {
      if (attempt === retries - 1) throw err;
      // conflict — retry
    }
  }
  return { ok: false, data: null };
}

/** מונה +1; מחזיר { over, count, limit } */
export function bumpCounter(current, limit) {
  const count = (current && typeof current.count === 'number' ? current.count : 0) + 1;
  return {
    next: { count, updatedAt: Date.now() },
    over: count > limit,
    count,
    limit,
  };
}

export function bumpGlobal(current, { requests = 0, upstreamCalls = 0, costUsd = 0 } = {}) {
  const base =
    current && typeof current === 'object'
      ? current
      : { requests: 0, upstreamCalls: 0, costUsd: 0 };
  return {
    requests: (base.requests || 0) + requests,
    upstreamCalls: (base.upstreamCalls || 0) + upstreamCalls,
    costUsd: Math.round(((base.costUsd || 0) + costUsd) * 1e6) / 1e6,
    updatedAt: Date.now(),
  };
}

export function globalLimitsFromEnv() {
  return {
    requests: envInt('AI_DAILY_REQUEST_LIMIT', DEFAULT_DAILY_REQUESTS),
    upstream: envInt('AI_DAILY_UPSTREAM_LIMIT', DEFAULT_DAILY_UPSTREAM),
    budgetUsd: envFloat('AI_DAILY_BUDGET_USD', DEFAULT_DAILY_BUDGET_USD),
  };
}

export function isGlobalOver(data, limits = globalLimitsFromEnv()) {
  const d = data || { requests: 0, upstreamCalls: 0, costUsd: 0 };
  return (
    (d.requests || 0) >= limits.requests ||
    (d.upstreamCalls || 0) >= limits.upstream ||
    (d.costUsd || 0) >= limits.budgetUsd
  );
}

export function isBreakerTripped(tripped, now = Date.now()) {
  if (!tripped || typeof tripped.ts !== 'number') return false;
  return now - tripped.ts < TRIPPED_TTL_MS;
}

/**
 * מחבר Blobs ל־Lambda event ומחזיר store (או null אם נכשל).
 */
export function openLimitsStore(event) {
  try {
    connectLambda(event);
    return getStore(STORE_NAME);
  } catch (err) {
    console.error('[limits] store error', err?.name || 'open');
    return null;
  }
}

/**
 * בודק ומעדכן מוני per-IP. FAIL OPEN אם store נכשל.
 * @returns {{ ok: true } | { ok: false, status: 429, error: string, retryAfter: number }}
 */
export async function checkAndBumpIpLimits(store, ipHash, stamp = jerusalemStamp()) {
  if (!store) return { ok: true }; // FAIL OPEN

  const hourlyLimit = envInt('AI_HOURLY_PER_IP', DEFAULT_HOURLY);
  const dailyLimit = envInt('AI_DAILY_PER_IP', DEFAULT_DAILY_IP);
  const hourKey = `ip:${ipHash}:${stamp.ymdHour}`;
  const dayKey = `ip:${ipHash}:${stamp.ymd}`;

  try {
    // שעתי
    let overHour = false;
    let hourCount = 0;
    await optimisticUpdate(store, hourKey, (cur) => {
      const { next, over, count } = bumpCounter(cur, hourlyLimit);
      overHour = over;
      hourCount = count;
      return next;
    });
    if (overHour) {
      console.info(`[limits] ip hourly over count=${hourCount} limit=${hourlyLimit}`);
      return {
        ok: false,
        status: 429,
        error: 'יותר מדי בקשות. נסה שוב בעוד כמה דקות',
        retryAfter: 60,
      };
    }

    // יומי
    let overDay = false;
    let dayCount = 0;
    await optimisticUpdate(store, dayKey, (cur) => {
      const { next, over, count } = bumpCounter(cur, dailyLimit);
      overDay = over;
      dayCount = count;
      return next;
    });
    if (overDay) {
      console.info(`[limits] ip daily over count=${dayCount} limit=${dailyLimit}`);
      return {
        ok: false,
        status: 429,
        error: 'יותר מדי בקשות. נסה שוב בעוד כמה דקות',
        retryAfter: 300,
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('[limits] store error', err?.name || 'ip');
    return { ok: true }; // FAIL OPEN
  }
}

/**
 * קורא תקציב גלובלי + breaker — בלי להעלות מונים.
 * @returns {{ blocked: false } | { blocked: true, code: string, error: string }}
 */
export async function peekGlobalBudget(store, stamp = jerusalemStamp()) {
  if (!store) return { blocked: false };
  try {
    const tripped = await store.get(TRIPPED_KEY, { type: 'json' });
    if (isBreakerTripped(tripped)) {
      return {
        blocked: true,
        code: 'ai_daily_limit',
        error: 'נועם נח להיום ומחכה למחר. הפנקס ממשיך לעבוד כרגיל.',
      };
    }

    const key = `global:${stamp.ymd}`;
    const data = await store.get(key, { type: 'json' });
    if (isGlobalOver(data)) {
      return {
        blocked: true,
        code: 'ai_daily_limit',
        error: 'נועם נח להיום ומחכה למחר. הפנקס ממשיך לעבוד כרגיל.',
      };
    }
    return { blocked: false };
  } catch (err) {
    console.error('[limits] store error', err?.name || 'global-peek');
    return { blocked: false }; // FAIL OPEN
  }
}

/** מעדכן מונים גלובליים אחרי קריאות upstream (עלות / מספר קריאות) */
export async function recordGlobalUsage(
  store,
  { requests = 1, upstreamCalls = 0, costUsd = 0 } = {},
  stamp = jerusalemStamp()
) {
  if (!store) return;
  const key = `global:${stamp.ymd}`;
  try {
    await optimisticUpdate(store, key, (cur) =>
      bumpGlobal(cur, { requests, upstreamCalls, costUsd })
    );
  } catch (err) {
    console.error('[limits] store error', err?.name || 'global-record');
  }
}

/** מעגל breaker אחרי 401/402 מ־OpenRouter */
export async function tripCircuitBreaker(store, status) {
  console.error(`[budget] tripped status=${status}`);
  if (!store) return;
  try {
    await store.setJSON(TRIPPED_KEY, { ts: Date.now(), status });
  } catch (err) {
    console.error('[limits] store error', err?.name || 'trip');
  }
}

export {
  STORE_NAME,
  TRIPPED_KEY,
  TRIPPED_TTL_MS,
  DEFAULT_HOURLY,
  DEFAULT_DAILY_IP,
  DEFAULT_DAILY_REQUESTS,
  DEFAULT_DAILY_UPSTREAM,
  DEFAULT_DAILY_BUDGET_USD,
};
