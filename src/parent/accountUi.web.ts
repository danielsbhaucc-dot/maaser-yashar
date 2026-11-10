/**
 * Web: מחבר את הווק המשותף (@core/account-kit) לתבנית העיצוב של מעשר ישר (MAASER_ACCOUNT).
 * null כשהמודול כבוי (לא הופעל בלוח או שהשרת לא מוגדר) — ואז מסך ההגדרות לא מציג כלום.
 * null גם כשהחיבור פועל אבל המתג הגלוי 'account-ui' כבוי בלוח: מחובר ברקע, בלי כפתור.
 */
import { accountView, MAASER_ACCOUNT } from '../../packages/@core/account-kit/src/index.ts';
import { useAccountUiShown, useParentAccount, useParentAccountHandle } from './account';
import type { AccountUi } from './accountUi.types';

export function useAccountUi(): AccountUi | null {
  const account = useParentAccountHandle();
  const state = useParentAccount(account);
  const shown = useAccountUiShown();
  if (!account || !state || !shown) return null;
  const t = MAASER_ACCOUNT, v = accountView(t, state);
  return {
    title: t.labels.title, sub: 'לא חובה · הרישומים נשארים במכשיר', line: v.line, error: v.error, action: v.action, actionLabel: v.actionLabel,
    signedIn: state.status === 'signed-in', colors: t.colors, radius: t.radius,
    run: () => { void (v.action === 'signIn' ? account.signIn() : v.action === 'signOut' ? account.signOut() : undefined); },
  };
}
