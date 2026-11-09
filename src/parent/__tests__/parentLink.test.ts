import { describe, expect, it } from 'vitest';
import { signManifest } from '../../../packages/@core/product-link/src/index.ts';
import { endpointFor, pingParent, PARENT_LIGHT_KEY, PING_EVERY_MS, RETRY_AFTER_FAIL_MS, type KV } from '../parentLink';

const mem = (): KV & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } }; };

describe('parent light link', () => {
  it('web goes same-origin over https only; native goes direct', () => {
    expect(endpointFor('web', 'https://maaser-yashar.netlify.app')).toBe('https://maaser-yashar.netlify.app/api/pl');
    expect(endpointFor('web', 'http://localhost:8081')).toBeNull();
    expect(endpointFor('web', null)).toBeNull();
    expect(endpointFor('ios')).toMatch(/^https:\/\/.+\/functions\/v1\/product-link$/);
  });

  it('sends only install id, version, health, platform — and the public key id', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('{"flags":{}}', { status: 200 }); }) as unknown as typeof fetch;
    const store = mem();
    expect(await pingParent({ platform: 'web', version: '1.0.2', store, origin: 'https://maaser-yashar.netlify.app', fetch: f })).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://maaser-yashar.netlify.app/api/pl/v1/light');
    expect((calls[0].init.headers as Record<string, string>)['x-pl-key']).toBe(PARENT_LIGHT_KEY);
    const body = JSON.parse(String(calls[0].init.body));
    expect(Object.keys(body).sort()).toEqual(['health', 'installId', 'platform', 'version']);
    expect(body).toMatchObject({ version: '1.0.2', health: 'ok', platform: 'web' });
    expect(body.installId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('pings at most once a day', async () => {
    let n = 0; const f = (async () => { n++; return new Response('{}', { status: 200 }); }) as unknown as typeof fetch;
    const store = mem(); const t = 1_800_000_000_000; const o = { platform: 'web' as const, version: '1', store, origin: 'https://x.example', fetch: f };
    await pingParent({ ...o, now: t }); await pingParent({ ...o, now: t + 1000 }); await pingParent({ ...o, now: t + PING_EVERY_MS + 1 });
    expect(n).toBe(2);
  });

  it('last-ping is written only after success; failure backs off 5 minutes, not an hour', async () => {
    const t = 1_800_000_000_000; const store = mem(); let n = 0; let up = false;
    const f = (async () => { n++; if (!up) throw new TypeError('Failed to fetch'); return new Response('{"flags":{}}', { status: 200 }); }) as unknown as typeof fetch;
    const o = { platform: 'web' as const, version: '1', store, origin: 'https://x.example', fetch: f };
    expect(await pingParent({ ...o, now: t })).toBe(false); expect(store.m.has('pl:last-ping')).toBe(false);
    expect(await pingParent({ ...o, now: t + 1000 })).toBe(false); expect(n).toBe(1); // backoff
    up = true;
    expect(await pingParent({ ...o, now: t + RETRY_AFTER_FAIL_MS + 1 })).toBe(true); expect(n).toBe(2); expect(store.m.get('pl:last-ping')).toBe(String(t + RETRY_AFTER_FAIL_MS + 1));
    const bad = (async () => new Response('x', { status: 503 })) as unknown as typeof fetch;
    const s2 = mem(); expect(await pingParent({ platform: 'android', version: '1', store: s2, fetch: bad, now: t })).toBe(false); expect(s2.m.has('pl:last-ping')).toBe(false);
  });

  it('never throws, even with broken storage; only pl:* keys are written', async () => {
    const store = mem();
    const boom = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(pingParent({ platform: 'web', version: '1', store, origin: 'https://x.example', fetch: boom })).resolves.toBe(false);
    const broken: KV = { get: async () => { throw new Error('storage'); }, set: async () => { throw new Error('storage'); } };
    await expect(pingParent({ platform: 'web', version: '1', store: broken, origin: 'https://x.example', fetch: boom })).resolves.toBe(false);
    expect([...store.m.keys()].every((k) => k.startsWith('pl:'))).toBe(true);
  });
  it('an invalid manifest never overwrites the last verified offline copy', async () => {
    const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const evil = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const good = await signManifest({ product: 'maaser-yashar', issuedAt: '2026-11-09T10:00:00.000Z', modules: [{ id: 'a11y', version: '0.2.0', ref: 'r' }] }, k.privateKey);
    let reply: unknown = { flags: {}, manifest: good };
    const f = (async () => new Response(JSON.stringify(reply), { status: 200 })) as unknown as typeof fetch;
    const store = mem(); const o = { platform: 'web' as const, version: '1', store, origin: 'https://x.example', fetch: f, manifestKey: k.publicKey };
    let t = 1_800_000_000_000;
    expect(await pingParent({ ...o, now: t })).toBe(true); const saved = store.m.get('pl:manifest'); expect(saved).toBe(JSON.stringify(good));
    for (const bad of [{ ...good, payload: good.payload.replace('a11y', 'evil') }, await signManifest({ product: 'maaser-yashar', issuedAt: '2026-11-09T11:00:00.000Z', modules: [] }, evil.privateKey), { payload: 'x', sig: 'y' }]) {
      reply = { flags: {}, manifest: bad }; t += PING_EVERY_MS + 1;
      expect(await pingParent({ ...o, now: t })).toBe(true); expect(store.m.get('pl:manifest')).toBe(saved);
    }
  });
});
