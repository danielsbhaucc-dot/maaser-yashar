/**
 * Unit tests — הקשחת AI (T-03 / T-04 / NEW-6):
 * assertAllowedCaller, body size, limits, budget, upstream cap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertAllowedCaller,
  allowedOrigins,
  isProdLike,
} from '../../../netlify/functions/_shared.mjs';
import {
  bumpCounter,
  bumpGlobal,
  hashClientIp,
  isBreakerTripped,
  isGlobalOver,
  optimisticUpdate,
  jerusalemStamp,
} from '../../../netlify/functions/_limits.mjs';
import {
  assertBodySize,
  cleanAndCapMessages,
  MAX_BODY_BYTES,
  MAX_TOTAL_CHARS,
  MAX_UPSTREAM_CALLS,
  resolveMaxTokens,
  runUpstreamChain,
} from '../../../netlify/functions/chat.mjs';

function evt(headers = {}, extras = {}) {
  return { headers, httpMethod: 'POST', ...extras };
}

describe('assertAllowedCaller', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.CONTEXT = 'production';
    process.env.NETLIFY_DEV = 'false';
    delete process.env.AI_ALLOW_NO_ORIGIN;
    delete process.env.AI_ALLOWED_ORIGINS;
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in prev)) delete process.env[k];
    }
    Object.assign(process.env, prev);
  });

  it('allows listed Origin', () => {
    const r = assertAllowedCaller(
      evt({
        Origin: 'https://maaser-yashar.netlify.app',
        'Content-Type': 'application/json',
      })
    );
    expect(r.ok).toBe(true);
  });

  it('rejects evil Origin', () => {
    const r = assertAllowedCaller(
      evt({
        Origin: 'https://evil.example',
        'Content-Type': 'application/json',
      })
    );
    expect(r).toEqual({ ok: false, status: 403, error: 'מקור לא מורשה' });
  });

  it('allows listed Referer when Origin missing', () => {
    const r = assertAllowedCaller(
      evt({
        Referer: 'https://maaser-yashar.netlify.app/settings',
        'Content-Type': 'application/json',
      })
    );
    expect(r.ok).toBe(true);
  });

  it('rejects bad Referer', () => {
    const r = assertAllowedCaller(
      evt({
        Referer: 'https://evil.example/x',
        'Content-Type': 'application/json',
      })
    );
    expect(r.status).toBe(403);
  });

  it('rejects missing Origin and Referer in production', () => {
    const r = assertAllowedCaller(
      evt({
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.0',
      })
    );
    expect(r).toEqual({ ok: false, status: 403, error: 'מקור לא מורשה' });
  });

  it('rejects Sec-Fetch-Site cross-site', () => {
    const r = assertAllowedCaller(
      evt({
        Origin: 'https://maaser-yashar.netlify.app',
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'cross-site',
      })
    );
    expect(r.status).toBe(403);
  });

  it('allows Sec-Fetch-Site same-origin', () => {
    const r = assertAllowedCaller(
      evt({
        Origin: 'https://maaser-yashar.netlify.app',
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'same-origin',
      })
    );
    expect(r.ok).toBe(true);
  });

  it('rejects wrong Content-Type with 415', () => {
    const r = assertAllowedCaller(
      evt({
        Origin: 'https://maaser-yashar.netlify.app',
        'Content-Type': 'text/plain',
      })
    );
    expect(r.status).toBe(415);
  });

  it('AI_ALLOW_NO_ORIGIN=true allows bare POST', () => {
    process.env.AI_ALLOW_NO_ORIGIN = 'true';
    const r = assertAllowedCaller(
      evt({ 'Content-Type': 'application/json' })
    );
    expect(r.ok).toBe(true);
  });

  it('production allow-list excludes localhost by default', () => {
    const list = allowedOrigins();
    expect(list).toContain('https://maaser-yashar.netlify.app');
    expect(list.some((o) => o.includes('localhost'))).toBe(false);
  });
});

describe('assertBodySize / cleanAndCapMessages', () => {
  it('rejects isBase64Encoded', () => {
    const r = assertBodySize({ isBase64Encoded: true, body: '{}' });
    expect(r).toEqual({ ok: false, status: 413, error: 'הודעה ארוכה מדי' });
  });

  it('rejects body over MAX_BODY_BYTES', () => {
    const body = 'x'.repeat(MAX_BODY_BYTES + 10);
    const r = assertBodySize({ body });
    expect(r.status).toBe(413);
  });

  it('accepts small body', () => {
    const r = assertBodySize({ body: '{"messages":[]}' });
    expect(r.ok).toBe(true);
  });

  it('caps total message chars keeping newest', () => {
    const messages = [
      { role: 'user', content: 'a'.repeat(2500) },
      { role: 'assistant', content: 'b'.repeat(2500) },
      { role: 'user', content: 'newest' },
    ];
    const out = cleanAndCapMessages(messages);
    const total = out.reduce((s, m) => s + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
    expect(out[out.length - 1].content).toBe('newest');
  });

  it('resolveMaxTokens clamps 100..400', () => {
    const prev = process.env.AI_MAX_TOKENS;
    process.env.AI_MAX_TOKENS = '50';
    expect(resolveMaxTokens()).toBe(100);
    process.env.AI_MAX_TOKENS = '999';
    expect(resolveMaxTokens()).toBe(400);
    process.env.AI_MAX_TOKENS = '200';
    expect(resolveMaxTokens()).toBe(200);
    if (prev === undefined) delete process.env.AI_MAX_TOKENS;
    else process.env.AI_MAX_TOKENS = prev;
  });
});

describe('limits helpers', () => {
  it('hashes IP without storing raw', () => {
    const h = hashClientIp('1.2.3.4', 'salt');
    expect(h).toMatch(/^[a-f0-9]{32}$/);
    expect(h).not.toContain('1.2.3');
  });

  it('bumpCounter detects over', () => {
    const a = bumpCounter({ count: 39 }, 40);
    expect(a.over).toBe(false);
    expect(a.count).toBe(40);
    const b = bumpCounter({ count: 40 }, 40);
    expect(b.over).toBe(true);
  });

  it('optimisticUpdate retries on conflict then succeeds', async () => {
    let reads = 0;
    let writes = 0;
    const store = {
      async getWithMetadata() {
        reads += 1;
        if (reads === 1) return { data: { count: 1 }, etag: 'a' };
        return { data: { count: 2 }, etag: 'b' };
      },
      async setJSON(_k, _v, opts) {
        writes += 1;
        if (writes === 1) throw new Error('conflict');
        expect(opts.onlyIfMatch).toBe('b');
      },
    };
    const r = await optimisticUpdate(store, 'k', (cur) => ({
      count: (cur?.count || 0) + 1,
    }));
    expect(r.ok).toBe(true);
    expect(writes).toBe(2);
  });

  it('isGlobalOver when budget exceeded', () => {
    expect(
      isGlobalOver(
        { requests: 10, upstreamCalls: 10, costUsd: 2 },
        { requests: 400, upstream: 800, budgetUsd: 2 }
      )
    ).toBe(true);
    expect(
      isGlobalOver(
        { requests: 10, upstreamCalls: 10, costUsd: 0.5 },
        { requests: 400, upstream: 800, budgetUsd: 2 }
      )
    ).toBe(false);
  });

  it('breaker tripped for 60 minutes', () => {
    const now = Date.now();
    expect(isBreakerTripped({ ts: now - 1000 }, now)).toBe(true);
    expect(isBreakerTripped({ ts: now - 61 * 60 * 1000 }, now)).toBe(false);
  });

  it('peekGlobalBudget blocks when over / tripped', async () => {
    const { peekGlobalBudget } = await import(
      '../../../netlify/functions/_limits.mjs'
    );
    const overStore = {
      async get(key) {
        if (key === 'global:tripped') return null;
        return { requests: 9999, upstreamCalls: 0, costUsd: 0 };
      },
    };
    const over = await peekGlobalBudget(overStore, { ymd: '20260101', ymdHour: '2026010112' });
    expect(over.blocked).toBe(true);
    expect(over.code).toBe('ai_daily_limit');

    const trippedStore = {
      async get(key) {
        if (key === 'global:tripped') return { ts: Date.now(), status: 402 };
        return { requests: 0, upstreamCalls: 0, costUsd: 0 };
      },
    };
    const tripped = await peekGlobalBudget(trippedStore, {
      ymd: '20260101',
      ymdHour: '2026010112',
    });
    expect(tripped.blocked).toBe(true);
  });

  it('bumpGlobal accumulates cost', () => {
    const next = bumpGlobal(
      { requests: 1, upstreamCalls: 2, costUsd: 0.1 },
      { requests: 1, upstreamCalls: 3, costUsd: 0.05 }
    );
    expect(next.requests).toBe(2);
    expect(next.upstreamCalls).toBe(5);
    expect(next.costUsd).toBeCloseTo(0.15);
  });

  it('jerusalemStamp returns YYYYMMDD / YYYYMMDDHH', () => {
    const s = jerusalemStamp(new Date('2026-09-29T12:00:00Z'));
    expect(s.ymd).toMatch(/^\d{8}$/);
    expect(s.ymdHour).toMatch(/^\d{10}$/);
  });
});

describe('runUpstreamChain cap', () => {
  it('never exceeds MAX_UPSTREAM_CALLS even if fetch returns 500', async () => {
    let fetches = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = async () => {
      fetches += 1;
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'provider boom secret' } }),
      };
    };
    try {
      const chain = await runUpstreamChain({
        apiKey: 'test-key',
        primaryModel: 'meta-llama/llama-4-scout',
        apiMessages: [{ role: 'user', content: 'hi' }],
      });
      expect(chain.counter.calls).toBeLessThanOrEqual(MAX_UPSTREAM_CALLS);
      expect(fetches).toBeLessThanOrEqual(MAX_UPSTREAM_CALLS);
      expect(chain.res.ok).toBe(false);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe('isProdLike sanity', () => {
  it('is true when CONTEXT=production', () => {
    const prevC = process.env.CONTEXT;
    const prevD = process.env.NETLIFY_DEV;
    process.env.CONTEXT = 'production';
    process.env.NETLIFY_DEV = 'false';
    expect(isProdLike()).toBe(true);
    process.env.CONTEXT = prevC;
    process.env.NETLIFY_DEV = prevD;
  });
});
