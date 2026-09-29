import type { LedgerEntry } from '../types/ledger';
import { resolvePeriodTotals } from '../utils/totalsAdvanced';
import { currentPeriod } from '../utils/history';
import type { UserProfile } from '../utils/profile';

/** הקשר מזערי לשרת — בלי שם, בלי הערות, בלי רשימת תנועות */
export type NoamChatContext = {
  rate: number;
  income: number;
  expenses: number;
  tzedaka: number;
  obligation: number;
  remaining: number;
};

/**
 * מקור אמת יחיד להקשר הצ'אט — תמיד מהפנקס האמיתי, פעם אחת.
 * idempotent: קריאה חוזרת על אותו ledger מחזירה אותם מספרים.
 */
export function buildContextFromLedger(
  profile: UserProfile,
  ledger: LedgerEntry[],
  period?: string
): NoamChatContext {
  const p = period || currentPeriod();
  const totals = resolvePeriodTotals(
    ledger,
    p,
    profile,
    !!profile.carryForwardSurplus
  );

  return {
    rate: Number.isFinite(profile.rate) ? profile.rate : 0.1,
    income: totals.income,
    expenses: totals.expenses,
    tzedaka: totals.tzedaka,
    obligation: totals.obligation,
    remaining: totals.remaining,
  };
}

export function buildNoamContext(opts: {
  profile: UserProfile;
  ledger: LedgerEntry[];
  period?: string;
}): NoamChatContext {
  return buildContextFromLedger(opts.profile, opts.ledger, opts.period);
}
