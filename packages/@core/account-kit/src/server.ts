/**
 * צד השרת של ווק החשבון: החלפת קוד חד־פעמי באסימון גישה של האם, ואימות האסימון מקומית (ES256 מול ‎/id/jwks,
 * מנפיק, קהל = המוצר הזה בלבד, תוקף, nonce). מחזיר לדפדפן רק פרופיל מינימלי; האסימון והמייל המלא לא נשמרים ולא חוזרים.
 * רץ בכל סביבה עם Web Crypto ו־fetch (Cloudflare Pages Functions, ‏Netlify, ‏Vercel, ‏Deno). בלי תלויות.
 *
 * כבוי עד שמגדירים: בלי סוד מוצר (≥32 תווים) — GET מחזיר { ready:false } ו־POST מחזיר 503 not_configured,
 * והמודול בצד הלקוח לא מציג כלום. כך אפשר לפרוס את הקוד מראש בלי להדליק חשבונות.
 */
import { PARENT_ORIGIN, parseUser, type AccountUser } from './core.ts';

export interface ExchangeConfig {
  productId: string;
  redirectUri: string;
  /** הסוד של המוצר אצל האם. נקרא ממשתני הסביבה של השרת בלבד, לעולם לא מהקוד. */
  clientSecret: string | undefined;
  /** המקור היחיד שמותר לו לקרוא (המוצר עצמו). */
  allowedOrigin: string;
  parentOrigin?: string;
  /** המנפיק בטוקן. ברירת מחדל: ‎`${PARENT_ORIGIN}/id`. */
  issuer?: string;
  fetch?: typeof fetch;
  nowS?: () => number;
}
type Jwk = JsonWebKey & { kid?: string };

const te = new TextEncoder(), td = new TextDecoder();
const unb64u = (s: string) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); const o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

/** רמז מייל מוסתר: d•••@g•••.com. */
export function emailHint(e: unknown): string {
  if (typeof e !== 'string') return '';
  const [l = '', d = ''] = e.split('@'); const dot = d.lastIndexOf('.');
  return l && d ? `${l.slice(0, 1)}•••@${d.slice(0, 1)}•••${dot > 0 ? d.slice(dot) : ''}` : '';
}

export const configured = (c: Pick<ExchangeConfig, 'clientSecret'>) => typeof c.clientSecret === 'string' && c.clientSecret.length >= 32;

/** אימות אסימון גישה של האם. null בכל בעיה (לא זורק). */
export async function verifyParentToken(token: unknown, jwks: { keys: Jwk[] }, want: { iss: string; aud: string; nonce: string; nowS: number }): Promise<Record<string, unknown> | null> {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const [h, b, s] = token.split('.'); if (!h || !b || !s) return null;
    const head = JSON.parse(td.decode(unb64u(h))) as { alg?: string; typ?: string; kid?: string };
    if (head.alg !== 'ES256' || head.typ !== 'at+jwt') return null;
    const jwk = jwks.keys.find((k) => k.kty === 'EC' && k.crv === 'P-256' && (!head.kid || !k.kid || k.kid === head.kid));
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64u(s) as BufferSource, te.encode(`${h}.${b}`)))) return null;
    const c = JSON.parse(td.decode(unb64u(b))) as Record<string, unknown>;
    if (c.iss !== want.iss || c.aud !== want.aud || typeof c.sub !== 'string') return null;
    if (typeof c.exp !== 'number' || c.exp <= want.nowS || typeof c.iat !== 'number' || c.iat > want.nowS + 60) return null;
    if (typeof c.nonce !== 'string' || c.nonce !== want.nonce) return null;
    return c;
  } catch { return null; }
}

/** קוד + verifier + nonce → פרופיל מינימלי, או קוד שגיאה. */
export async function exchangeParentCode(cfg: ExchangeConfig, input: { code: string; verifier: string; nonce: string }): Promise<{ user: AccountUser } | { error: 'not_configured' | 'denied' | 'token' | 'jwks' | 'token_invalid' | 'network' }> {
  if (!configured(cfg)) return { error: 'not_configured' };
  const origin = (cfg.parentOrigin ?? PARENT_ORIGIN).replace(/\/+$/, ''), f = cfg.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  try {
    const tr = await f(`${origin}/id/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ grant_type: 'authorization_code', code: input.code, redirect_uri: cfg.redirectUri, code_verifier: input.verifier, client_id: cfg.productId, client_secret: cfg.clientSecret }) });
    if (tr.status === 403) return { error: 'denied' };
    if (!tr.ok) return { error: 'token' };
    const tok = await tr.json() as { access_token?: unknown };
    const jr = await f(`${origin}/id/jwks`, { signal: AbortSignal.timeout(5000) });
    if (!jr.ok) return { error: 'jwks' };
    const jwks = await jr.json() as { keys?: Jwk[] };
    const c = await verifyParentToken(tok.access_token, { keys: Array.isArray(jwks.keys) ? jwks.keys : [] }, { iss: cfg.issuer ?? `${PARENT_ORIGIN}/id`, aud: cfg.productId, nonce: input.nonce, nowS: (cfg.nowS ?? (() => Math.floor(Date.now() / 1000)))() });
    if (!c) return { error: 'token_invalid' };
    const user = parseUser({ sub: c.sub, emailHint: emailHint(c.email), verified: c.email_verified === true, licensed: typeof c.lic === 'string' && c.lic.length > 0, since: new Date().toISOString() });
    return user ? { user } : { error: 'token_invalid' };
  } catch { return { error: 'network' }; }
}

/**
 * נקודת קצה מוכנה למוצר (Request → Response):
 *   GET  → { ready } (האם השרת מוגדר; בלי פרטים נוספים)
 *   POST → { user } | { error }. רק מהמקור של המוצר, JSON בלבד, עד 2KB, שדות קשיחים.
 */
export async function handleAccountExchange(req: Request, cfg: ExchangeConfig): Promise<Response> {
  if (req.method === 'GET') return json(200, { ready: configured(cfg) });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (req.headers.get('origin') !== cfg.allowedOrigin) return json(403, { error: 'origin' });
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json(415, { error: 'content_type' });
  if (!configured(cfg)) return json(503, { error: 'not_configured' });
  const text = await req.text(); if (text.length > 2048) return json(413, { error: 'too_large' });
  let b: Record<string, unknown>; try { b = JSON.parse(text); } catch { return json(400, { error: 'invalid_request' }); }
  const keys = b && typeof b === 'object' ? Object.keys(b).sort().join(',') : '';
  if (keys !== 'code,nonce,verifier' || typeof b.code !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(b.code)
    || typeof b.verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(b.verifier) || typeof b.nonce !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(b.nonce)) return json(400, { error: 'invalid_request' });
  const r = await exchangeParentCode(cfg, { code: b.code, verifier: b.verifier, nonce: b.nonce });
  if ('user' in r) return json(200, { user: r.user });
  return json(r.error === 'denied' ? 403 : r.error === 'not_configured' ? 503 : 502, { error: r.error });
}
