/**
 * החשבון המרכזי במעשר ישר (מודול 'account' מספריית האם, @core/account-kit). כבוי כברירת מחדל:
 * כל עוד המודול לא הופעל בלוח של חברת האם וגם השרת (פונקציית Netlify) לא הוגדר, אין כאן שום חשבון —
 * useParentAccountHandle() מחזיר null ושום דבר לא מוצג. הפנקס, הפרופיל והשיחות לא קשורים לחשבון ונשארים במכשיר.
 */
import { useSyncExternalStore } from 'react';
import { accountUiVisible, makeUseParentAccount, type ParentAccount } from '../../packages/@core/account-kit/src/index.ts';
import { installedModules, subscribeModules } from './modules';

export const ACCOUNT_EXCHANGE_PATH = '/api/account/exchange';
/** המקור היחיד שרשום אצל האם ככתובת חזרה מדויקת (‎`${ACCOUNT_ORIGIN}/`). */
export const ACCOUNT_ORIGIN = 'https://maaser-yashar.netlify.app';

let current: ParentAccount | null = null;
const listeners = new Set<() => void>();
export function setParentAccount(a: ParentAccount | null): void {
  current = a;
  for (const l of [...listeners]) { try { l(); } catch { /* ignore */ } }
}
export const getParentAccount = (): ParentAccount | null => current;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** החשבון אם המודול מותקן, אחרת null. */
export function useParentAccountHandle(): ParentAccount | null {
  return useSyncExternalStore(subscribe, getParentAccount, () => null);
}
/** מצב החשבון (מחובר/לא מחובר/רגע), או null כשהמודול כבוי. */
export const useParentAccount = makeUseParentAccount(useSyncExternalStore);

/** האם להציג את הכפתור/הקטע: רק כש־'account' (החיבור) וגם 'account-ui' (המתג הגלוי בלוח) ברשימה החתומה. ברירת מחדל: מוסתר. */
export const isAccountUiShown = (): boolean => accountUiVisible(installedModules());
export function useAccountUiShown(): boolean {
  return useSyncExternalStore(subscribeModules, isAccountUiShown, () => false);
}
