/**
 * ‏@core/account-kit — ווק החשבון המרכזי (כניסה דרך חברת האם) לשימוש חוזר בכל מוצר.
 * צד הלקוח: בלי DOM, בלי React ובלי תלויות; רק Web Crypto, fetch ומתאם אחסון קטן (get/set/remove).
 * זרימה: OAuth 2 authorization code + PKCE (S256) + state + nonce מול ‎/id/authorize של האם. החלפת הקוד נעשית
 * בשרת של המוצר (handleAccountExchange ב־./server), כי הסוד של המוצר לא יוצא מהשרת. בדפדפן נשמר רק פרופיל
 * מינימלי (מזהה זוגי למוצר, רמז מייל מוסתר, מאומת, יש רישיון) — בלי טוקנים ובלי מייל מלא.
 * כל כשל = מצב «לא מחובר/ת» עם קוד שגיאה; המוצר ממשיך לעבוד בלי חשבון.
 */
export const PARENT_ORIGIN = 'https://platform-core-preview.vercel.app';
export const TX_TTL_MS = 10 * 60 * 1000;

export interface AccountStore {
  get(k: string): string | null | Promise<string | null>;
  set(k: string, v: string): void | Promise<void>;
  remove(k: string): void | Promise<void>;
}
export interface AccountUser { sub: string; emailHint: string; verified: boolean; licensed: boolean; since: string }
export type AccountError = 'state' | 'expired' | 'denied' | 'exchange' | 'not_configured' | 'network' | 'parent';
export type AccountState =
  | { status: 'signed-out'; error?: AccountError }
  | { status: 'busy' }
  | { status: 'signed-in'; user: AccountUser };

export interface AccountConfig {
  /** מזהה המוצר אצל האם (client_id), למשל 'nehora'. */
  productId: string;
  /** כתובת החזרה המדויקת שרשומה אצל האם (התאמה מלאה). */
  redirectUri: string;
  /** נתיב באותו מקור בשרת של המוצר שמחליף קוד בפרופיל (handleAccountExchange). */
  exchangeUrl: string;
  store: AccountStore;
  parentOrigin?: string;
  fetch?: typeof fetch;
  /** מעבר לעמוד האם (ברירת מחדל: location.assign). */
  navigate?: (url: string) => void;
  now?: () => number;
}

export interface ParentAccount {
  readonly productId: string;
  getSnapshot(): AccountState;
  subscribe(l: () => void): () => void;
  /** טוען את הפרופיל השמור (עובד בלי רשת). */
  ready: Promise<void>;
  /** פותח את מסך הכניסה של האם. מחזיר את הכתובת (גם לבדיקות). */
  signIn(o?: { screen?: 'signin' | 'signup' }): Promise<string>;
  /** מטפל בחזרה מהאם (code/state/error בכתובת). true = זו הייתה חזרה של הווק הזה. */
  completeFromUrl(url: string): Promise<boolean>;
  /** יציאה: מוחק רק את המפתחות של הווק הזה, לא נוגע בשום נתון אחר של המוצר. */
  signOut(): Promise<void>;
}

const ID_RE = /^[a-z0-9-]{2,40}$/;
const SUB_RE = /^[A-Za-z0-9_-]{16,128}$/;
const b64u = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const randomToken = (bytes = 32) => b64u(crypto.getRandomValues(new Uint8Array(bytes)));
export const pkceChallenge = async (verifier: string) => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
const safeEqual = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** כתובת ‎/id/authorize של האם (אותו חוזה של NuraWell: response_type=code, S256, state, nonce). */
export function authorizeUrl(p: { parentOrigin?: string; productId: string; redirectUri: string; state: string; challenge: string; nonce: string; screen?: 'signin' | 'signup' }): string {
  const u = new URL(`${(p.parentOrigin ?? PARENT_ORIGIN).replace(/\/+$/, '')}/id/authorize`);
  const q: Record<string, string> = { response_type: 'code', client_id: p.productId, redirect_uri: p.redirectUri, state: p.state, code_challenge: p.challenge, code_challenge_method: 'S256', nonce: p.nonce };
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  if (p.screen === 'signup') u.searchParams.set('screen', 'signup');
  return u.toString();
}

/** בדיקת צורה של פרופיל שחוזר מהשרת של המוצר או מהאחסון. null = לא תקין. */
export function parseUser(x: unknown): AccountUser | null {
  if (!x || typeof x !== 'object') return null;
  const u = x as Record<string, unknown>;
  if (typeof u.sub !== 'string' || !SUB_RE.test(u.sub)) return null;
  if (typeof u.emailHint !== 'string' || u.emailHint.length > 80 || (u.emailHint.includes('@') && !u.emailHint.includes('•'))) return null;
  if (typeof u.verified !== 'boolean' || typeof u.licensed !== 'boolean') return null;
  const since = typeof u.since === 'string' && !Number.isNaN(Date.parse(u.since)) ? u.since : new Date(0).toISOString();
  return { sub: u.sub, emailHint: u.emailHint, verified: u.verified, licensed: u.licensed, since };
}

export function createParentAccount(cfg: AccountConfig): ParentAccount {
  if (!ID_RE.test(cfg.productId)) throw new Error('account-kit: bad productId');
  if (!/^https?:\/\//.test(cfg.redirectUri)) throw new Error('account-kit: bad redirectUri');
  const K = { tx: `pa:${cfg.productId}:tx`, user: `pa:${cfg.productId}:user` };
  const now = cfg.now ?? Date.now;
  const f = cfg.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const listeners = new Set<() => void>();
  let state: AccountState = { status: 'signed-out' };
  const set = (s: AccountState) => { state = s; for (const l of [...listeners]) { try { l(); } catch { /* ignore */ } } };
  const get = async (k: string) => { try { return await cfg.store.get(k); } catch { return null; } };
  const put = async (k: string, v: string) => { try { await cfg.store.set(k, v); } catch { /* ignore */ } };
  const del = async (k: string) => { try { await cfg.store.remove(k); } catch { /* ignore */ } };

  const ready = (async () => {
    const raw = await get(K.user);
    let u: AccountUser | null = null; try { u = raw ? parseUser(JSON.parse(raw)) : null; } catch { u = null; }
    if (u && state.status === 'signed-out') set({ status: 'signed-in', user: u });
  })();

  return {
    productId: cfg.productId,
    getSnapshot: () => state,
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    ready,
    async signIn(o) {
      const tx = { state: randomToken(24), verifier: randomToken(48), nonce: randomToken(24), at: now() };
      await put(K.tx, JSON.stringify(tx));
      const url = authorizeUrl({ parentOrigin: cfg.parentOrigin, productId: cfg.productId, redirectUri: cfg.redirectUri, state: tx.state, challenge: await pkceChallenge(tx.verifier), nonce: tx.nonce, screen: o?.screen });
      set({ status: 'busy' });
      (cfg.navigate ?? ((u: string) => { globalThis.location?.assign(u); }))(url);
      return url;
    },
    async completeFromUrl(href) {
      let u: URL; try { u = new URL(href); } catch { return false; }
      const st = u.searchParams.get('state'), code = u.searchParams.get('code'), err = u.searchParams.get('error');
      if (!st || (!code && !err)) return false;
      const raw = await get(K.tx);
      if (!raw) return false; // לא חזרה שלנו (או כבר טופלה)
      await del(K.tx); // חד־פעמי בכל מקרה
      let tx: { state: string; verifier: string; nonce: string; at: number };
      try { tx = JSON.parse(raw); } catch { set({ status: 'signed-out', error: 'state' }); return true; }
      if (typeof tx?.state !== 'string' || !safeEqual(st, tx.state)) { set({ status: 'signed-out', error: 'state' }); return true; }
      if (!(now() - Number(tx.at) <= TX_TTL_MS)) { set({ status: 'signed-out', error: 'expired' }); return true; }
      if (err) { set({ status: 'signed-out', error: err === 'access_denied' || err === 'no_license' ? 'denied' : 'parent' }); return true; }
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(code ?? '')) { set({ status: 'signed-out', error: 'exchange' }); return true; }
      set({ status: 'busy' });
      try {
        const r = await f(cfg.exchangeUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ code, verifier: tx.verifier, nonce: tx.nonce }) });
        if (r.status === 503) { set({ status: 'signed-out', error: 'not_configured' }); return true; }
        if (!r.ok) { set({ status: 'signed-out', error: r.status === 403 ? 'denied' : 'exchange' }); return true; }
        const user = parseUser(((await r.json()) as { user?: unknown }).user);
        if (!user) { set({ status: 'signed-out', error: 'exchange' }); return true; }
        await put(K.user, JSON.stringify(user));
        set({ status: 'signed-in', user });
      } catch { set({ status: 'signed-out', error: 'network' }); }
      return true;
    },
    async signOut() { await del(K.user); await del(K.tx); set({ status: 'signed-out' }); },
  };
}

/** ווק React (ובכל ספרייה עם useSyncExternalStore) בלי תלות ב־React בתוך הערכה: המוצר מעביר את הפונקציה. */
export function makeUseParentAccount(useSyncExternalStore: <T>(sub: (l: () => void) => () => void, get: () => T, getServer?: () => T) => T) {
  const OFF: AccountState = { status: 'signed-out' };
  const noop = () => () => undefined;
  return (account: ParentAccount | null): AccountState | null => {
    const s = useSyncExternalStore(account ? account.subscribe : noop, account ? account.getSnapshot : () => OFF, () => OFF);
    return account ? s : null;
  };
}
