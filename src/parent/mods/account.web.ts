/**
 * מודול החשבון המרכזי (@core/account-kit) כמודול שמותקן מלוח הבקרה של חברת האם. כבוי כברירת מחדל, ונעול כפליים:
 * גם אחרי הפעלה בלוח הוא לא עולה עד שהשרת של מעשר ישר מוגדר (פונקציית Netlify) (GET /api/account/exchange מחזיר ready:true רק כשיש סוד מוצר).
 * בהתקנה: מטפל בחזרה מעמוד הכניסה של האם (code/state בכתובת), מנקה את הכתובת, ומציג את החשבון בהגדרות.
 * בהסרה: החשבון נעלם מההגדרות. לא נוגעים בפנקס ובפרופיל; בדפדפן נשמר רק פרופיל מינימלי במפתחות pa:maaser-yashar:*.
 */
import { createParentAccount } from '../../../packages/@core/account-kit/src/index.ts';
import { PARENT_PRODUCT_ID } from '../parentLink';
import { ACCOUNT_EXCHANGE_PATH, ACCOUNT_ORIGIN, setParentAccount } from '../account';
import type { InstalledModule } from '../modules';

const store = {
  get: (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } },
  remove: (k: string) => { try { window.localStorage.removeItem(k); } catch { /* ignore */ } },
};

export async function install(o: { fetch?: typeof fetch } = {}): Promise<InstalledModule | null> {
  if (typeof window === 'undefined' || window.location?.origin !== ACCOUNT_ORIGIN) return null;
  const f = o.fetch ?? (((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)) as typeof fetch);
  try {
    const r = await f(ACCOUNT_EXCHANGE_PATH, { method: 'GET', credentials: 'same-origin' });
    if (!r.ok || ((await r.json()) as { ready?: unknown }).ready !== true) return null;
  } catch { return null; }
  const account = createParentAccount({ productId: PARENT_PRODUCT_ID, redirectUri: `${ACCOUNT_ORIGIN}/`, exchangeUrl: ACCOUNT_EXCHANGE_PATH, store, fetch: f });
  await account.ready;
  const href = window.location.href;
  if (await account.completeFromUrl(href)) {
    try { const u = new URL(href); window.history.replaceState(window.history.state, '', `${u.pathname}${u.hash}`); } catch { /* ignore */ }
  }
  setParentAccount(account);
  return { remove: () => setParentAccount(null) };
}
