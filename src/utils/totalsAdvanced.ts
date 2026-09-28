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
 * kind expense = ניכוי מהבסיס (גם אם התווית במסך היא «ניכוי»).
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
