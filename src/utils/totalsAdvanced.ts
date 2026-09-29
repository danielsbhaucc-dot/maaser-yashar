import type {
  AllowanceMode,
  GiftMode,
  InheritanceMode,
  MaaserBreakdownLine,
  MaaserInputs,
  MaaserResult,
  MaaserRate,
  MaritalStatus,
  TaxDeductionMode,
} from '../types';
import type { LedgerEntry, LedgerKind, LedgerTotals } from '../types/ledger';
import { calculateMaaser, defaultMaaserInputs } from './maaserCalc';
import { computeTotals } from './ledger';

/** הגדרות חישוב מתקדמות — מופעל כברירת מחדל */
export interface AdvancedCalcSettings {
  /** false = חישוב פשוט (computeTotals) לתאימות/בדיקות */
  enabled: boolean;
  taxDeductionMode: TaxDeductionMode;
  giftMode: GiftMode;
  inheritanceMode: InheritanceMode;
  allowanceMode: AllowanceMode;
  deductLoans: boolean;
}

export const defaultAdvancedSettings = (): AdvancedCalcSettings => ({
  enabled: true,
  taxDeductionMode: 'after_mandatory',
  giftMode: 'include',
  inheritanceMode: 'exclude',
  allowanceMode: 'exclude',
  deductLoans: false,
});

export type TotalsProfile = {
  rate: MaaserRate;
  includeSpouse: boolean;
  maritalStatus: MaritalStatus;
  advanced?: AdvancedCalcSettings;
};

export type ResolvedTotals = LedgerTotals & {
  lines: MaaserBreakdownLine[];
  warnings: string[];
  /** קלט מלא לארכיון — קטגוריות ניכוי אמיתיות */
  inputs: MaaserInputs;
  engine: MaaserResult | null;
};

/** טקסט מנוע — עודף מול חובה (לשימוש בהגדרות / ממשק) */
export const SURPLUS_CARRY_ENGINE_TEXT =
  'כבר נתתם יותר מחובת המעשר/חומש לתקופה זו. העודף יכול (לפי חלק מהפוסקים) להיחשב על תקופה הבאה — שאלו רב.';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type CarryPeriodTotals = LedgerTotals & {
  carryIn: number;
  carryOut: number;
};

/** העברת עודף בין תקופות (כשההגדרה פעילה) */
export function withCarryForward(
  periods: string[],
  byPeriod: Record<string, LedgerTotals>
): Record<string, CarryPeriodTotals> {
  let carry = 0;
  const out: Record<string, CarryPeriodTotals> = {};
  for (const p of [...periods].sort()) {
    const t = byPeriod[p] ?? {
      income: 0,
      expenses: 0,
      tzedaka: 0,
      netBase: 0,
      obligation: 0,
      remaining: 0,
    };
    const given = t.tzedaka + carry;
    out[p] = {
      ...t,
      carryIn: carry,
      remaining: Math.max(0, round2(t.obligation - given)),
      carryOut: (carry = Math.max(0, round2(given - t.obligation))),
    };
  }
  return out;
}

/** עודף מקומי בחודש (ניתן − חובה), בלי קשר להעברה */
export function periodSurplus(t: Pick<LedgerTotals, 'obligation' | 'tzedaka'>): number {
  return Math.max(0, round2(t.tzedaka - t.obligation));
}

function fillMonthRange(start: string, end: string): string[] {
  const out: string[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const ey = Number(end.slice(0, 4));
  const em = Number(end.slice(5, 7));
  if (![y, m, ey, em].every(Number.isFinite)) return [start, end].filter(Boolean);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export type PeriodResolved = ResolvedTotals & {
  carryIn: number;
  carryOut: number;
  /** עודף מקומי לתצוגה — גם כשההעברה כבויה */
  surplus: number;
};

function periodChain(periodSet: Set<string>, carryForward: boolean): string[] {
  const sorted = [...periodSet].filter(Boolean).sort();
  if (carryForward && sorted.length >= 2) {
    return fillMonthRange(sorted[0]!, sorted[sorted.length - 1]!);
  }
  return sorted;
}

function toLedgerTotals(t: ResolvedTotals): LedgerTotals {
  return {
    income: t.income,
    expenses: t.expenses,
    tzedaka: t.tzedaka,
    netBase: t.netBase,
    obligation: t.obligation,
    remaining: t.remaining,
  };
}

/**
 * סיכום לכל התקופות בפנקס; כש־carryForward=true מעביר עודף לחודש הבא.
 * `extraPeriods` — תקופות ריקות שייכללו בשרשרת (למשל החודש שנצפה בבית).
 */
export function resolveAllPeriods(
  ledger: LedgerEntry[],
  profile: TotalsProfile,
  carryForward: boolean,
  extraPeriods: string[] = []
): Record<string, PeriodResolved> {
  const periodSet = new Set(ledger.map((e) => e.period).filter(Boolean));
  for (const p of extraPeriods) {
    if (p) periodSet.add(p);
  }
  const periods = periodChain(periodSet, carryForward);

  const byPeriod: Record<string, ResolvedTotals> = {};
  for (const p of periods) {
    byPeriod[p] = resolveTotals(
      ledger.filter((e) => e.period === p),
      profile
    );
  }

  if (!carryForward) {
    const out: Record<string, PeriodResolved> = {};
    for (const p of periods) {
      const t = byPeriod[p]!;
      const surplus = periodSurplus(t);
      out[p] = { ...t, carryIn: 0, carryOut: surplus, surplus };
    }
    return out;
  }

  const baseOnly: Record<string, LedgerTotals> = {};
  for (const p of periods) {
    baseOnly[p] = toLedgerTotals(byPeriod[p]!);
  }
  const carried = withCarryForward(periods, baseOnly);
  const out: Record<string, PeriodResolved> = {};
  for (const p of periods) {
    const t = byPeriod[p]!;
    const c = carried[p]!;
    out[p] = {
      ...t,
      remaining: c.remaining,
      carryIn: c.carryIn,
      carryOut: c.carryOut,
      surplus: periodSurplus(t),
    };
  }
  return out;
}

/** סיכום לתקופה אחת (עם שרשרת העברה כשפעיל) */
export function resolvePeriodTotals(
  ledger: LedgerEntry[],
  period: string,
  profile: TotalsProfile,
  carryForward: boolean
): PeriodResolved {
  const all = resolveAllPeriods(ledger, profile, carryForward, [period]);
  return (
    all[period] ?? {
      ...resolveTotals([], profile),
      carryIn: 0,
      carryOut: 0,
      surplus: 0,
    }
  );
}

function normCat(c: string): string {
  return c.trim().replace(/\s+/g, ' ');
}

/** התאמת קטגוריות עם/בלי רווחים סביב / */
function catMatch(entryCat: string, ...aliases: string[]): boolean {
  const a = normCat(entryCat).replace(/\s*\/\s*/g, '/');
  return aliases.some((al) => normCat(al).replace(/\s*\/\s*/g, '/') === a);
}

function sumKind(entries: LedgerEntry[], kind: LedgerKind, cat?: string | string[]): number {
  const aliases = cat == null ? null : Array.isArray(cat) ? cat : [cat];
  let total = 0;
  for (const e of entries) {
    if (e.kind !== kind) continue;
    if (aliases && !aliases.some((al) => catMatch(e.category, al))) continue;
    const amt = Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0;
    total += amt;
  }
  return total;
}

/**
 * ממפה את הפנקס לשדות calculateMaaser הקיים.
 * kind expense = ניכוי מהבסיס (תווית המסך: «ניכוי מהבסיס»).
 */
export function buildMaaserInputs(
  entries: LedgerEntry[],
  profile: TotalsProfile
): MaaserInputs {
  const adv = { ...defaultAdvancedSettings(), ...profile.advanced };
  const sum = (kind: LedgerKind, cat?: string | string[]) => sumKind(entries, kind, cat);

  return {
    ...defaultMaaserInputs(),
    rate: profile.rate,
    taxDeductionMode: adv.taxDeductionMode,
    giftMode: adv.giftMode,
    inheritanceMode: adv.inheritanceMode,
    allowanceMode: adv.allowanceMode,
    includeSpouse: profile.includeSpouse,
    maritalStatus: profile.maritalStatus,
    deductLoanRepayments: adv.deductLoans,

    salaryGross: sum('income', 'משכורת'),
    businessIncome: sum('income', ['עסק / עצמאי', 'עסק/עצמאי']),
    rentalIncome: sum('income', 'שכירות'),
    capitalGains: sum('income', 'רווחי הון'),
    giftsReceived: sum('income', 'מתנה'),
    allowances: sum('income', 'קצבה'),
    inheritance: sum('income', 'ירושה'),
    spouseIncome: sum('income', 'בן/בת זוג'),
    otherIncome: sum('income', 'אחר'),

    incomeTax: sum('expense', 'מס הכנסה'),
    nationalInsurance: sum('expense', 'ביטוח לאומי'),
    healthTax: sum('expense', 'מס בריאות'),
    businessExpenses: sum('expense', 'הוצאות עסק'),
    rentalExpenses: sum('expense', 'הוצאות שכירות'),
    loansRepaid: sum('expense', 'החזר הלוואה'),

    alreadyGivenTzedaka: sum('tzedaka'),
  };
}

export function totalsAdvanced(
  entries: LedgerEntry[],
  profile: TotalsProfile
): ResolvedTotals {
  const inputs = buildMaaserInputs(entries, profile);
  const engine = calculateMaaser(inputs);
  return {
    income: engine.grossSubjectBase,
    expenses: engine.deductions,
    tzedaka: engine.alreadyGiven,
    netBase: engine.netBase,
    obligation: engine.obligation,
    remaining: engine.remaining,
    lines: engine.lines,
    warnings: engine.warnings,
    inputs,
    engine,
  };
}

/** חישוב פשוט — זהה ל־computeTotals (לתאימות כש־advanced.enabled=false) */
export function totalsSimple(
  entries: LedgerEntry[],
  rate: MaaserRate
): ResolvedTotals {
  const t = computeTotals(entries, rate);
  const income = t.income;
  const expenses = t.expenses;
  const inputs: MaaserInputs = {
    ...defaultMaaserInputs(),
    rate,
    otherIncome: income,
    incomeTax: expenses,
    alreadyGivenTzedaka: t.tzedaka,
    taxDeductionMode: 'after_mandatory',
  };
  return {
    ...t,
    lines: [],
    warnings: [],
    inputs,
    engine: null,
  };
}

/** ברירת מחדל: מצב מתקדם. כיבוי → computeTotals זהה. */
export function resolveTotals(
  entries: LedgerEntry[],
  profile: TotalsProfile
): ResolvedTotals {
  const adv = { ...defaultAdvancedSettings(), ...profile.advanced };
  if (!adv.enabled) return totalsSimple(entries, profile.rate);
  return totalsAdvanced(entries, { ...profile, advanced: adv });
}
