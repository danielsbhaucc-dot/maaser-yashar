/**
 * החשבון המרכזי במעשר ישר (מודולים 'account' + 'account-ui' מ־@core/account-kit): כבוי כברירת מחדל, נעול כפליים (לוח + שרת),
 * מחובר ברקע בלי כפתור עד ש־'account-ui' מודלק בלוח, לא נוגע בפנקס, ופונקציית Netlify סגורה בלי סוד.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { REGISTRY, applyManifest, installedModules, __resetModulesForTests, type ModuleLoader } from '../modules';
import { getParentAccount, isAccountUiShown, ACCOUNT_ORIGIN } from '../account';
import { install as installUiFlag } from '../mods/accountUi';
import { install } from '../mods/account.web';
import { install as installNative } from '../mods/account';
import accountExchange, { ORIGIN as FN_ORIGIN } from '../../../netlify/functions/account-exchange.mts';

const ORIGIN = 'https://maaser-yashar.netlify.app';
const penv = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const man = (ids: string[]) => ({ v: 1 as const, product: 'maaser-yashar', issuedAt: '2026-11-10T05:00:00.000Z', modules: ids.map((id) => ({ id, version: '0.2.0', ref: 'core-v2026.11.10.1' })) });

function fakeWindow(href: string) {
  const ls = new Map<string, string>([['maaser-ledger', '{"rows":3}']]);
  const u = new URL(href);
  const w = {
    location: { origin: u.origin, href, assign: (x: string) => { w.went = x; } },
    localStorage: { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => { ls.set(k, v); }, removeItem: (k: string) => { ls.delete(k); } },
    history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => { w.location.href = new URL(url, u.origin).toString(); } },
    went: '',
  };
  (globalThis as { window?: unknown }).window = w;
  (globalThis as { location?: unknown }).location = w.location;
  return { w, ls };
}

describe('parent account (Maaser)', () => {
  afterEach(() => { __resetModulesForTests(); delete (globalThis as { window?: unknown }).window; delete (globalThis as { location?: unknown }).location; });

  it('one exact origin everywhere', () => { expect(ACCOUNT_ORIGIN).toBe(ORIGIN); expect(FN_ORIGIN).toBe(ORIGIN); });

  it('the account module is known to the app but OFF until the console manifest lists it', async () => {
    expect(typeof REGISTRY.account).toBe('function');
    let loaded = 0;
    const reg: Record<string, ModuleLoader> = { ...REGISTRY, account: async () => { loaded++; return { install: async () => ({ remove() {} }) }; } };
    await applyManifest(man(['a11y']), reg); // a11y is not in this build → ignored, built-in widget stays
    expect(loaded).toBe(0); expect(installedModules().size).toBe(0);
    await applyManifest(man(['account']), reg); expect(loaded).toBe(1); expect(installedModules().has('account')).toBe(true);
    await applyManifest(man([]), reg); expect(installedModules().has('account')).toBe(false);
  });

  it('native stays a no-op', async () => { expect(await installNative()).toBeNull(); });

  it('even when switched on in the console, the module stays hidden while the Netlify server is not configured', async () => {
    fakeWindow(`${ORIGIN}/`);
    const calls: string[] = [];
    const notReady = (async (u: string) => { calls.push(String(u)); return new Response('{"ready":false}'); }) as unknown as typeof fetch;
    expect(await install({ fetch: notReady })).toBeNull();
    expect(getParentAccount()).toBeNull();
    expect(calls).toEqual(['/api/account/exchange']);
    fakeWindow('https://deploy-preview-9--maaser-yashar.netlify.app/'); // previews / localhost never load it
    expect(await install({ fetch: (async () => new Response('{"ready":true}')) as unknown as typeof fetch })).toBeNull();
  });

  it('configured + switched on: completes the return from the parent, cleans the URL, keeps the ledger', async () => {
    const { w, ls } = fakeWindow(`${ORIGIN}/`);
    const exchange = (async (_u: string, init?: RequestInit) => {
      if (!init || init.method === 'GET') return new Response('{"ready":true}');
      const b = JSON.parse(String(init.body));
      expect(Object.keys(b).sort()).toEqual(['code', 'nonce', 'verifier']);
      return new Response(JSON.stringify({ user: { sub: 'pairwise_sub_abcdefghijklmnop', emailHint: 'r•••@e•••.com', verified: true, licensed: false, since: new Date().toISOString() } }));
    }) as unknown as typeof fetch;
    const h = await install({ fetch: exchange }); expect(h).toBeTruthy();
    const acc = getParentAccount()!; expect(acc.getSnapshot().status).toBe('signed-out');
    const url = new URL(await acc.signIn());
    expect(url.origin + url.pathname).toBe('https://platform-core-preview.vercel.app/id/authorize');
    expect(url.searchParams.get('client_id')).toBe('maaser-yashar');
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/`);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    h!.remove(); expect(getParentAccount()).toBeNull();
    const state = JSON.parse(ls.get('pa:maaser-yashar:tx')!).state as string;
    w.location.href = `${ORIGIN}/?code=code_abcdefghijklmnop&state=${state}`;
    const h2 = await install({ fetch: exchange }); expect(h2).toBeTruthy();
    expect(getParentAccount()?.getSnapshot().status).toBe('signed-in');
    expect(w.location.href).toBe(`${ORIGIN}/`);
    expect(ls.get('maaser-ledger')).toBe('{"rows":3}');
    await getParentAccount()!.signOut();
    expect([...ls.keys()]).toEqual(['maaser-ledger']);
    h2!.remove();
  });

  it('Netlify function is closed without the secret; refuses other origins', async () => {
    const req = (method: string, origin = ORIGIN) => new Request(`${ORIGIN}/api/account/exchange`, { method, headers: { origin, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify({ code: 'code_abcdefghijklmnop', verifier: 'v'.repeat(64), nonce: 'n'.repeat(32) }) : undefined });
    const prev = penv.PARENT_ACCOUNT_CLIENT_SECRET; delete penv.PARENT_ACCOUNT_CLIENT_SECRET;
    expect(await (await accountExchange(req('GET'))).json()).toEqual({ ready: false });
    expect((await accountExchange(req('POST'))).status).toBe(503);
    expect((await accountExchange(req('POST', 'https://evil.example'), undefined, { PARENT_ACCOUNT_CLIENT_SECRET: 'x'.repeat(40) })).status).toBe(403);
    expect(await (await accountExchange(req('GET'), undefined, { PARENT_ACCOUNT_CLIENT_SECRET: 'x'.repeat(40) })).json()).toEqual({ ready: true });
    penv.PARENT_ACCOUNT_CLIENT_SECRET = 'y'.repeat(64);
    expect(await (await accountExchange(req('GET'))).json()).toEqual({ ready: true }); // reads the server env
    if (prev === undefined) delete penv.PARENT_ACCOUNT_CLIENT_SECRET; else penv.PARENT_ACCOUNT_CLIENT_SECRET = prev;
  });

  it('account-ui: connected in the background with NO button until the console switches account-ui on (one step)', async () => {
    expect(typeof REGISTRY['account-ui']).toBe('function');
    const reg: Record<string, ModuleLoader> = { ...REGISTRY, account: async () => ({ install: async () => ({ remove() {} }) }) };
    await applyManifest(man(['account']), reg); // target state: plumbing on, button off
    expect(installedModules().has('account')).toBe(true); expect(isAccountUiShown()).toBe(false);
    await applyManifest(man(['account', 'account-ui']), reg); expect(isAccountUiShown()).toBe(true);
    await applyManifest(man(['account']), reg); expect(isAccountUiShown()).toBe(false); expect(installedModules().has('account')).toBe(true);
    await applyManifest(man(['account-ui']), reg); expect(isAccountUiShown()).toBe(false); // never without the plumbing
    const h = await installUiFlag(); expect(h).toBeTruthy(); h!.remove();
  });
});
