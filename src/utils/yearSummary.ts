import { HDate, gematriya } from '@hebcal/core';
import type { LedgerEntry, LedgerTotals } from '../types/ledger';
import type { UserProfile } from './profile';
import { formatPeriod } from './history';
import {
  resolveAllPeriods,
  resolveTotals,
  type TotalsProfile,
} from './totalsAdvanced';

export type YearMode = 'civil' | 'hebrew';

export type YearMonthRow = {
  period: string;
  label: string;
  totals: LedgerTotals;
  surplus?: number;
  carryIn?: number;
};

export type YearSummaryResult = {
  entries: LedgerEntry[];
  totals: LedgerTotals;
  /** סכום חובות חודשיות (עלול להיבדל מחובת השנה המחושבת יחד) */
  monthlyObligationsSum: number;
  months: YearMonthRow[];
  /** סכום צדקה עם אישור 46 — null אם השדה עדיין לא קיים בפנקס (T-29) */
  section46Approved: number | null;
};

/** תאריך תנועה: date (YYYY-MM-DD) או createdAt */
export function entryDateIso(e: LedgerEntry): string {
  return e.date ?? e.createdAt;
}

export function hebrewYearOf(iso: string): number {
  return new HDate(new Date(iso)).getFullYear();
}

export function hebrewYearLabel(y: number): string {
  return `שנת ${gematriya(y % 1000)}`;
}

export function civilYearOf(iso: string): number {
  const y = Number(String(iso).slice(0, 4));
  return Number.isFinite(y) ? y : new Date(iso).getFullYear();
}

function toTotalsProfile(profile: UserProfile | TotalsProfile): TotalsProfile {
  return {
    rate: profile.rate,
    includeSpouse: profile.includeSpouse,
    maritalStatus: profile.maritalStatus,
    advanced: 'advanced' in profile ? profile.advanced : undefined,
  };
}

export function entriesForYear(
  entries: LedgerEntry[],
  mode: YearMode,
  year: number
): LedgerEntry[] {
  return entries.filter((e) => {
    const d = entryDateIso(e);
    if (!d) return false;
    return mode === 'civil' ? civilYearOf(d) === year : hebrewYearOf(d) === year;
  });
}

function periodOfEntry(e: LedgerEntry): string {
  if (e.period && /^\d{4}-\d{2}$/.test(e.period)) return e.period;
  const d = entryDateIso(e);
  return String(d).slice(0, 7);
}

function section46Amount(entries: LedgerEntry[]): number | null {
  let sawField = false;
  let sum = 0;
  for (const e of entries) {
    if (e.kind !== 'tzedaka') continue;
    const hasFlag =
      e.has46 !== undefined ||
      e.org !== undefined ||
      e.receiptNo !== undefined;
    if (hasFlag) {
      sawField = true;
      if (e.has46 === 'yes') {
        const amt = Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0;
        sum += amt;
      }
    }
  }
  return sawField ? Math.round(sum * 100) / 100 : null;
}

/**
 * סיכום שנתי — משתמש ב־resolveTotals (totalsAdvanced כשמצב מתקדם ON / ברירת מחדל).
 */
export function yearSummary(
  entries: LedgerEntry[],
  profile: UserProfile | TotalsProfile,
  mode: YearMode,
  year: number
): YearSummaryResult {
  const totalsProfile = toTotalsProfile(profile);
  const inYear = entriesForYear(entries, mode, year);
  const yearResolved = resolveTotals(inYear, totalsProfile);
  const totals: LedgerTotals = {
    income: yearResolved.income,
    expenses: yearResolved.expenses,
    tzedaka: yearResolved.tzedaka,
    netBase: yearResolved.netBase,
    obligation: yearResolved.obligation,
    remaining: yearResolved.remaining,
  };

  const byPeriod = new Map<string, LedgerEntry[]>();
  for (const e of inYear) {
    const p = periodOfEntry(e);
    const list = byPeriod.get(p) ?? [];
    list.push(e);
    byPeriod.set(p, list);
  }

  const periods =
    mode === 'civil'
      ? Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
      : [...byPeriod.keys()].sort();

  const carryOn =
    'carryForwardSurplus' in profile ? !!profile.carryForwardSurplus : false;

  const resolvedByPeriod = resolveAllPeriods(
    inYear,
    totalsProfile,
    carryOn,
    periods
  );

  const months: YearMonthRow[] = periods
    .map((period) => {
      const list = byPeriod.get(period) ?? [];
      if (list.length === 0) return null;
      const m = resolvedByPeriod[period] ?? resolveTotals(list, totalsProfile);
      return {
        period,
        label: formatPeriod(period),
        totals: {
          income: m.income,
          expenses: m.expenses,
          tzedaka: m.tzedaka,
          netBase: m.netBase,
          obligation: m.obligation,
          remaining: m.remaining,
        },
        surplus: 'surplus' in m ? m.surplus : 0,
        carryIn: 'carryIn' in m ? m.carryIn : 0,
      };
    })
    .filter((r): r is YearMonthRow => r != null);

  const monthlyObligationsSum =
    Math.round(months.reduce((s, m) => s + m.totals.obligation, 0) * 100) / 100;

  return {
    entries: inYear,
    totals,
    monthlyObligationsSum,
    months,
    section46Approved: section46Amount(inYear),
  };
}

/** שנים זמינות לבחירה — מהפנקס + השנה הנוכחית */
export function availableYears(
  entries: LedgerEntry[],
  mode: YearMode,
  now = new Date()
): number[] {
  const set = new Set<number>();
  if (mode === 'civil') {
    set.add(now.getFullYear());
  } else {
    set.add(hebrewYearOf(now.toISOString()));
  }
  for (const e of entries) {
    const d = entryDateIso(e);
    if (!d) continue;
    set.add(mode === 'civil' ? civilYearOf(d) : hebrewYearOf(d));
  }
  return [...set].sort((a, b) => b - a);
}

export function yearLabel(mode: YearMode, year: number): string {
  return mode === 'hebrew' ? hebrewYearLabel(year) : String(year);
}
