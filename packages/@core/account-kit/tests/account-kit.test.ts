import { describe, expect, it } from 'vitest';
import { ACCOUNT_MODULE, ACCOUNT_UI_MODULE, accountUiVisible, accountView, contrast, createParentAccount, defineAccountTemplate, makeUseParentAccount, MAASER_ACCOUNT, NEHORA_ACCOUNT, type AccountStore } from '../src/index.ts';
import { emailHint, handleAccountExchange, verifyParentToken, type ExchangeConfig } from '../src/server.ts';

const PARENT = 'https://parent.test', ISS = 'https://platform-core-preview.vercel.app/id', APP = 'https://app.test';
const te = new TextEncoder();
const b64u = (b: Uint8Array | string) => Buffer.from(typeof b === 'string' ? te.encode(b) : b).toString('base64url');
const mem = (): AccountStore & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v); }, remove: (k) => { m.delete(k); } }; };

async function fakeParent(o: { aud?: string; iss?: string; nonceOverride?: string; exp?: number; tamper?: boolean; tokenStatus?: number } = {}) {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  const codes = new Map<string, { nonce: string }>();
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined; calls.push({ url, body });
    if (url === `${PARENT}/id/jwks`) return new Response(JSON.stringify({ keys: [{ ...pub, kid: 'id1' }] }));
    if (url === `${PARENT}/id/token`) {
      if (o.tokenStatus) return new Response('{}', { status: o.tokenStatus });
      if (body?.client_secret !== 's'.repeat(40) || body?.client_id !== 'nehora') return new Response('{}', { status: 401 });
      const c = codes.get(String(body.code)); if (!c) return new Response('{}', { status: 400 }); codes.delete(String(body.code));
      const now = Math.floor(Date.now() / 1000);
      const h = b64u(JSON.stringify({ alg: 'ES256', typ: 'at+jwt', kid: 'id1' }));
      const p = b64u(JSON.stringify({ iss: o.iss ?? ISS, aud: o.aud ?? 'nehora', sub: 'pairwise_sub_abcdefghijklmnop', email: 'dana@example.com', email_verified: true, lic: null, iat: now, exp: o.exp ?? now + 300, jti: 'j', nonce: o.nonceOverride ?? c.nonce }));
      const sig = b64u(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, te.encode(`${h}.${p}`))));
      return new Response(JSON.stringify({ access_token: `${h}.${o.tamper ? b64u('{"x":1}') : p}.${sig}` }));
    }
    return new Response('{}', { status: 404 });
  }) as typeof globalThis.fetch;
  return { fetch, calls, codes };
}

const serverCfg = (fetch: typeof globalThis.fetch, off = false): ExchangeConfig =>
  ({ productId: 'nehora', redirectUri: `${APP}/`, allowedOrigin: APP, clientSecret: off ? undefined : 's'.repeat(40), parentOrigin: PARENT, fetch });

/** הדפדפן מדבר עם השרת של המוצר (handleAccountExchange) שמדבר עם האם המדומה. */
const productFetch = (cfg: ExchangeConfig) => (async (url: RequestInfo | URL, init?: RequestInit) =>
  handleAccountExchange(new Request(`${APP}${String(url)}`, { ...init, headers: { ...(init?.headers as Record<string, string>), origin: APP } }), cfg)) as typeof globalThis.fetch;

async function startSignIn(store = mem(), cfg?: ExchangeConfig) {
  const p = await fakeParent();
  const c = cfg ?? serverCfg(p.fetch);
  let went = '';
  const acc = createParentAccount({ productId: 'nehora', redirectUri: `${APP}/`, exchangeUrl: '/api/account/exchange', store, parentOrigin: PARENT, fetch: productFetch(c), navigate: (u) => { went = u; } });
  await acc.ready;
  await acc.signIn();
  const u = new URL(went);
  const tx = JSON.parse(store.m.get('pa:nehora:tx')!);
  p.codes.set('code_abcdefghijklmnop', { nonce: u.searchParams.get('nonce')! });
  return { acc, store, u, tx, p };
}

describe('account-kit hook (client + product server + parent)', () => {
  it('builds the parent authorize URL with PKCE S256, state and nonce (same contract as NuraWell)', async () => {
    const { u, tx } = await startSignIn();
    expect(u.origin + u.pathname).toBe(`${PARENT}/id/authorize`);
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ response_type: 'code', client_id: 'nehora', redirect_uri: `${APP}/`, code_challenge_method: 'S256', state: tx.state });
    expect(u.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(u.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(u.searchParams.has('code_verifier')).toBe(false);
  });

  it('completes sign-in once; stores only a minimal profile; product data untouched; sign-out removes only its keys', async () => {
    const store = mem(); store.m.set('reading-progress', '{"day":42}');
    const { acc, tx, p } = await startSignIn(store);
    expect(await acc.completeFromUrl(`${APP}/?code=code_abcdefghijklmnop&state=${tx.state}`)).toBe(true);
    const s = acc.getSnapshot(); expect(s.status).toBe('signed-in');
    if (s.status === 'signed-in') expect(s.user).toMatchObject({ sub: 'pairwise_sub_abcdefghijklmnop', emailHint: 'd•••@e•••.com', verified: true, licensed: false });
    const saved = store.m.get('pa:nehora:user')!; expect(saved).not.toContain('dana@'); expect(saved).not.toMatch(/eyJ/); // no full email, no token
    expect(store.m.has('pa:nehora:tx')).toBe(false);
    expect(p.calls.find((c) => c.url.endsWith('/id/token'))?.body).toMatchObject({ grant_type: 'authorization_code', client_id: 'nehora', redirect_uri: `${APP}/` });
    // replaying the same return is ignored (one-time transaction)
    expect(await acc.completeFromUrl(`${APP}/?code=code_abcdefghijklmnop&state=${tx.state}`)).toBe(false);
    // reload: profile comes back from the device without network
    const again = createParentAccount({ productId: 'nehora', redirectUri: `${APP}/`, exchangeUrl: '/x', store, fetch: (async () => { throw new TypeError('offline'); }) as never });
    await again.ready; expect(again.getSnapshot().status).toBe('signed-in');
    await again.signOut();
    expect([...store.m.keys()]).toEqual(['reading-progress']);
    expect(again.getSnapshot()).toEqual({ status: 'signed-out' });
  });

  it('rejects a wrong state, an expired transaction and an error from the parent (no sign-in, no exchange)', async () => {
    const a = await startSignIn();
    expect(await a.acc.completeFromUrl(`${APP}/?code=code_abcdefghijklmnop&state=${'x'.repeat(32)}`)).toBe(true);
    expect(a.acc.getSnapshot()).toEqual({ status: 'signed-out', error: 'state' });
    expect(a.p.calls.some((c) => c.url.endsWith('/id/token'))).toBe(false);
    const b = await startSignIn(); b.store.m.set('pa:nehora:tx', JSON.stringify({ ...b.tx, at: Date.now() - 11 * 60_000 }));
    await b.acc.completeFromUrl(`${APP}/?code=code_abcdefghijklmnop&state=${b.tx.state}`); expect(b.acc.getSnapshot()).toEqual({ status: 'signed-out', error: 'expired' });
    const c = await startSignIn();
    await c.acc.completeFromUrl(`${APP}/?error=access_denied&state=${c.tx.state}`); expect(c.acc.getSnapshot()).toEqual({ status: 'signed-out', error: 'denied' });
    // a URL with code/state but no pending transaction is not ours
    const d = createParentAccount({ productId: 'nehora', redirectUri: `${APP}/`, exchangeUrl: '/x', store: mem() });
    expect(await d.completeFromUrl(`${APP}/?code=code_abcdefghijklmnop&state=${'y'.repeat(32)}`)).toBe(false);
  });

  it('server is OFF without a secret: GET ready:false, POST 503, client shows not_configured', async () => {
    const p = await fakeParent();
    const off = serverCfg(p.fetch, true);
    expect(await (await handleAccountExchange(new Request(`${APP}/api/account/exchange`), off)).json()).toEqual({ ready: false });
    expect((await handleAccountExchange(new Request(`${APP}/x`, { method: 'POST', headers: { origin: APP, 'content-type': 'application/json' }, body: '{}' }), off)).status).toBe(503);
    expect(await (await handleAccountExchange(new Request(`${APP}/x`), serverCfg(p.fetch))).json()).toEqual({ ready: true });
    const a = await startSignIn(mem(), off);
    await a.acc.completeFromUrl(`${APP}/?code=code_abcdefghijklmnop&state=${a.tx.state}`);
    expect(a.acc.getSnapshot()).toEqual({ status: 'signed-out', error: 'not_configured' });
    expect(p.calls.length).toBe(0);
  });

  it('server refuses other origins, wrong content type, extra fields and bad shapes', async () => {
    const p = await fakeParent(); const cfg = serverCfg(p.fetch);
    const post = (body: string, h: Record<string, string> = {}) => handleAccountExchange(new Request(`${APP}/x`, { method: 'POST', headers: { origin: APP, 'content-type': 'application/json', ...h }, body }), cfg);
    const ok = { code: 'code_abcdefghijklmnop', verifier: 'v'.repeat(64), nonce: 'n'.repeat(32) };
    expect((await post(JSON.stringify(ok), { origin: 'https://evil.test' })).status).toBe(403);
    expect((await post(JSON.stringify(ok), { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post(JSON.stringify({ ...ok, extra: 1 }))).status).toBe(400);
    expect((await post(JSON.stringify({ ...ok, code: 'short' }))).status).toBe(400);
    expect((await post('x'.repeat(3000))).status).toBe(413);
    expect(p.calls.length).toBe(0);
  });

  it('token checks: wrong audience, wrong issuer, nonce mismatch, expired, tampered, parent refuses', async () => {
    for (const o of [{ aud: 'nurawell' }, { iss: 'https://evil.test/id' }, { nonceOverride: 'z'.repeat(32) }, { exp: 1 }, { tamper: true }]) {
      const p = await fakeParent(o);
      const a = await startSignIn(mem(), serverCfg(p.fetch)); a.p.codes.clear(); p.codes.set('code_abcdefghijklmnop', { nonce: a.u.searchParams.get('nonce')! });
      await a.acc.completeFromUrl(`${APP}/?code=code_abcdefghijklmnop&state=${a.tx.state}`);
      expect(a.acc.getSnapshot()).toEqual({ status: 'signed-out', error: 'exchange' });
    }
    const p = await fakeParent({ tokenStatus: 403 });
    const a = await startSignIn(mem(), serverCfg(p.fetch));
    await a.acc.completeFromUrl(`${APP}/?code=code_abcdefghijklmnop&state=${a.tx.state}`);
    expect(a.acc.getSnapshot()).toEqual({ status: 'signed-out', error: 'denied' });
    expect(await verifyParentToken('a.b.c', { keys: [] }, { iss: ISS, aud: 'nehora', nonce: 'n', nowS: 0 })).toBeNull();
    expect(emailHint('dana@example.com')).toBe('d•••@e•••.com'); expect(emailHint(undefined)).toBe('');
  });

  it('React hook factory works with any useSyncExternalStore and returns null when the module is off', () => {
    const fakeUse = <T,>(_s: (l: () => void) => () => void, get: () => T) => get();
    const use = makeUseParentAccount(fakeUse);
    expect(use(null)).toBeNull();
    const acc = createParentAccount({ productId: 'nehora', redirectUri: `${APP}/`, exchangeUrl: '/x', store: mem() });
    expect(use(acc)).toEqual({ status: 'signed-out' });
  });
});

describe('account-kit design templates', () => {
  it('product templates pass contrast and carry the central-account notice in Hebrew', () => {
    for (const t of [NEHORA_ACCOUNT, MAASER_ACCOUNT]) {
      expect(contrast(t.colors.text, t.colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.colors.muted, t.colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.colors.onAccent, t.colors.accent)).toBeGreaterThanOrEqual(4.5);
      expect(t.labels.title).toBe('החשבון המרכזי');
      expect(t.labels.note).toMatch(/החשבון המרכזי/);
      expect(Object.isFrozen(t.labels)).toBe(true);
    }
  });
  it('rejects low contrast, bad colors and markup in labels', () => {
    const colors = { ...NEHORA_ACCOUNT.colors };
    expect(() => defineAccountTemplate({ id: 'x1', colors: { ...colors, text: '#EEEEEE' } })).toThrow(/contrast/);
    expect(() => defineAccountTemplate({ id: 'x1', colors: { ...colors, accent: 'red' } })).toThrow(/#rrggbb/);
    expect(() => defineAccountTemplate({ id: 'x1', colors, labels: { signIn: '<b>x</b>' } })).toThrow(/label/);
  });
  it('accountView maps every state to one line and one action', () => {
    const t = NEHORA_ACCOUNT;
    expect(accountView(t, { status: 'signed-out' })).toMatchObject({ action: 'signIn', actionLabel: 'כניסה', error: null });
    expect(accountView(t, { status: 'signed-out', error: 'network' }).error).toMatch(/אין חיבור/);
    expect(accountView(t, { status: 'busy' }).action).toBeNull();
    expect(accountView(t, { status: 'signed-in', user: { sub: 's'.repeat(20), emailHint: 'd•••@e•••.com', verified: true, licensed: false, since: '' } })).toMatchObject({ action: 'signOut', line: 'מחובר/ת בתור d•••@e•••.com' });
  });
});

describe('account-kit UI visibility flag (account-ui, off by default)', () => {
  it('hidden unless both the plumbing and the UI module are in the verified list', () => {
    expect(ACCOUNT_MODULE).toBe('account');
    expect(ACCOUNT_UI_MODULE).toBe('account-ui');
    expect(accountUiVisible(null)).toBe(false);
    expect(accountUiVisible([])).toBe(false);
    expect(accountUiVisible(['a11y', 'account'])).toBe(false); // plumbing live, button hidden
    expect(accountUiVisible(['account-ui'])).toBe(false); // never without the plumbing
    expect(accountUiVisible(new Set(['account', 'account-ui']))).toBe(true); // the one-step flip
    expect(accountUiVisible(['a11y', 'account', 'account-ui'])).toBe(true);
  });
});
