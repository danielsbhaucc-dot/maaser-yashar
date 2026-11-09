/**
 * חיבור קל לחברת האם (שלב 2, אושר 2.11.2026).
 * נשלחים רק: מזהה התקנה אקראי, גרסה, מצב ופלטפורמה — דרך LightLink מ־@core/product-link (platform-core, תג core-v2026.11.09).
 * אין חשבון, אין רישוי, אין נתוני משתמש. האפליקציה עובדת בדיוק אותו דבר בלי רשת או אם החיבור נכשל:
 * הכול רץ ברקע, לכל היותר פעם בשעה, ושום שגיאה לא יוצאת מכאן.
 * מזהה המפתח ציבורי מעצם הגדרתו (פותח רק את /v1/light); אין כאן סוד.
 */
import { LightLink } from '../../packages/@core/product-link/src/index.ts';

export const PARENT_PRODUCT_ID = 'maaser-yashar';
export const PARENT_LIGHT_KEY = 'pk_w32n7oi1t2gp9ihw';
/** Native פונה ישירות לפונקציה; Web עובר דרך /api/pl באותו מקור (CSP connect-src 'self' נשאר). */
export const PARENT_NATIVE_ENDPOINT = 'https://snvjsopfvoshddaydjlm.supabase.co/functions/v1/product-link';
/** פינג לכל היותר פעם בשעה (מגבלת השרת: 12 בשעה להתקנה). כך שינוי מודול בלוח מגיע תוך שעה. */
export const PING_EVERY_MS = 60 * 60 * 1000;
const LAST_KEY = 'pl:last-ping';

export interface KV { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> }
export type Platform = 'web' | 'ios' | 'android';

/** כתובת היעד, או null כשאין יעד https (למשל localhost) — אז פשוט לא שולחים. */
export function endpointFor(platform: Platform, origin?: string | null): string | null {
  if (platform !== 'web') return PARENT_NATIVE_ENDPOINT;
  if (!origin || !/^https:\/\//.test(origin)) return null;
  return `${origin.replace(/\/+$/, '')}/api/pl`;
}

/** אחרי כשל (בלי רשת, שגיאת שרת) מנסים שוב רק אחרי הפסקה קצרה, לא אחרי שעה. */
export const RETRY_AFTER_FAIL_MS = 5 * 60 * 1000;
const FAIL_KEY = 'pl:ping-fail';

/**
 * שולח פינג אחד אם עברה שעה מהפינג המוצלח הקודם (ואחרי כשל — 5 דקות).
 * זמן הפינג נשמר רק אחרי תשובה תקינה מהשרת. מחזיר true רק כשהפינג הצליח. לעולם לא זורק.
 * רשימת המודולים נשמרת רק אחרי אימות חתימה מול manifestKey (בתוך LightLink).
 */
export async function pingParent(o: {
  platform: Platform; version: string; store: KV; origin?: string | null; now?: number; fetch?: typeof fetch; manifestKey?: CryptoKey | null;
}): Promise<boolean> {
  try {
    const endpoint = endpointFor(o.platform, o.origin);
    if (!endpoint) return false;
    const now = o.now ?? Date.now();
    const last = Number((await o.store.get(LAST_KEY)) ?? 0);
    if (Number.isFinite(last) && last > 0 && now - last < PING_EVERY_MS) return false;
    const failed = Number((await o.store.get(FAIL_KEY)) ?? 0);
    if (Number.isFinite(failed) && failed > 0 && now - failed < RETRY_AFTER_FAIL_MS) return false;
    const link = new LightLink({
      productId: PARENT_PRODUCT_ID, keyId: PARENT_LIGHT_KEY, endpoint, version: o.version,
      platform: o.platform, store: o.store, fetch: o.fetch, timeoutMs: 5000, manifestKey: o.manifestKey ?? null,
    });
    await link.ping('ok');
    if (link.lastPingOk) { await o.store.set(LAST_KEY, String(now)); return true; }
    await o.store.set(FAIL_KEY, String(now));
    return false;
  } catch {
    return false;
  }
}
