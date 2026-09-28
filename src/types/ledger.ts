export type LedgerKind = 'income' | 'expense' | 'tzedaka';

/** expense: מוריד מבסיס המעשר | tzedaka: נספר ככבר ניתן | income: מוסיף לבסיס */
export interface LedgerEntry {
  id: string;
  period: string; // YYYY-MM
  kind: LedgerKind;
  category: string;
  amount: number;
  note: string;
  createdAt: string;
  /** YYYY-MM-DD — רשומות ישנות בלי date נופלות ל־createdAt */
  date?: string;
  /** קישור להוראת קבע שיצרה את התנועה (במקום מזהה בהערה) */
  ruleId?: string;
}

export const INCOME_CATEGORIES = [
  'משכורת',
  'עסק / עצמאי',
  'שכירות',
  'רווחי הון',
  'מתנה',
  'קצבה',
  'בן/בת זוג',
  'אחר',
] as const;

export const EXPENSE_CATEGORIES = [
  'מס הכנסה',
  'ביטוח לאומי',
  'מס בריאות',
  'הוצאות עסק',
  'הוצאות שכירות',
  'החזר הלוואה',
  'אחר',
] as const;

export const TZEDAKA_CATEGORIES = [
  'צדקה / מעשר',
  'תרומה למוסד',
  'מתן לעני',
  'אחר',
] as const;

export interface LedgerTotals {
  income: number;
  expenses: number;
  tzedaka: number;
  /** בסיס למעשר = הכנסות − הוצאות (מסים/עסק וכו') */
  netBase: number;
  obligation: number;
  remaining: number;
}
