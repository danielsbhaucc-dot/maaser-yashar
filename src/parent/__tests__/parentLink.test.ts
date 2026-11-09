import { describe, expect, it } from 'vitest';
import { endpointFor, pingParent, PARENT_LIGHT_KEY, PING_EVERY_MS, type KV } from '../parentLink';

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

  it('offline / server error / throwing fetch never throws and changes nothing else', async () => {
    const store = mem();
    const boom = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(pingParent({ platform: 'web', version: '1', store, origin: 'https://x.example', fetch: boom })).resolves.toBe(true);
    const bad = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    await expect(pingParent({ platform: 'android', version: '1', store: mem(), fetch: bad })).resolves.toBe(true);
    const broken: KV = { get: async () => { throw new Error('storage'); }, set: async () => { throw new Error('storage'); } };
    await expect(pingParent({ platform: 'web', version: '1', store: broken, origin: 'https://x.example', fetch: boom })).resolves.toBe(false);
    expect([...store.m.keys()].every((k) => k.startsWith('pl:'))).toBe(true);
  });
});
