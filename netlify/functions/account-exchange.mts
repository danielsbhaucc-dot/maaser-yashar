/**
 * Netlify Function (v2): החלפת קוד הכניסה של החשבון המרכזי.
 *   GET  /api/account/exchange → { ready }  (האם השרת מוגדר)
 *   POST /api/account/exchange → פרופיל מינימלי בלבד (בלי אסימון ובלי מייל מלא)
 * באותו מקור (rewrite ב־netlify.toml), כך שה־CSP connect-src 'self' לא משתנה.
 * הסוד של מעשר ישר נקרא רק ממשתנה הסביבה PARENT_ACCOUNT_CLIENT_SECRET בשרת (Netlify, production בלבד).
 * כבוי: בלי המשתנה GET מחזיר { ready:false }, POST מחזיר 503, ומודול החשבון באפליקציה לא עולה.
 */
import { handleAccountExchange } from '../../packages/@core/account-kit/src/server.ts';

export const ORIGIN = 'https://maaser-yashar.netlify.app';

type Env = { PARENT_ACCOUNT_CLIENT_SECRET?: string };
const readSecret = (env?: Env): string | undefined => {
  if (env) return env.PARENT_ACCOUNT_CLIENT_SECRET;
  const nf = (globalThis as { Netlify?: { env?: { get(k: string): string | undefined } } }).Netlify;
  return nf?.env?.get('PARENT_ACCOUNT_CLIENT_SECRET') ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PARENT_ACCOUNT_CLIENT_SECRET;
};

/** `env` רק לבדיקות; בפריסה הסוד נקרא מסביבת Netlify. */
export default async function accountExchange(request: Request, _context?: unknown, env?: Env): Promise<Response> {
  return handleAccountExchange(request, { productId: 'maaser-yashar', redirectUri: `${ORIGIN}/`, allowedOrigin: ORIGIN, clientSecret: readSecret(env) });
}
