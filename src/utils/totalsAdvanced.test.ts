/**
 * בדיקות T-25 — totalsAdvanced / calculateMaaser
 * הרצה: npx --yes tsx src/utils/totalsAdvanced.test.ts
 */
import type { LedgerEntry } from '../types/ledger';
import type { MaaserRate } from '../types';
import { computeTotals } from './ledger';
import {
  defaultAdvancedSettings,
  resolveTotals,
  totalsAdvanced,
  type TotalsProfile,
} from './totalsAdvanced';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function approx(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

function entry(
  partial: Pick<LedgerEntry, 'kind' | 'category' | 'amount'> & Partial<LedgerEntry>
): LedgerEntry {
  return {
    id: `${partial.kind}-${partial.category}-${partial.amount}`,
    period: '2026-09',
    note: '',
    createdAt: '2026-09-01T12:00:00.000Z',
    ...partial,
  };
}

const baseProfile = (over?: Partial<TotalsProfile>): TotalsProfile => ({
  rate: 0.1 as MaaserRate,
  includeSpouse: false,
  maritalStatus: 'single',
  advanced: defaultAdvancedSettings(),
  ...over,
});

function run() {
  // --- advanced off → זהה ל־computeTotals ---
  const mixed: LedgerEntry[] = [
    entry({ kind: 'income', category: 'משכורת', amount: 10000 }),
    entry({ kind: 'income', category: 'קצבה', amount: 500 }),
    entry({ kind: 'expense', category: 'מס הכנסה', amount: 1200 }),
    entry({ kind: 'expense', category: 'הוצאות עסק', amount: 300 }),
    entry({ kind: 'tzedaka', category: 'צדקה / מעשר', amount: 200 }),
  ];
  const simple = computeTotals(mixed, 0.1);
  const off = resolveTotals(mixed, baseProfile({ advanced: { ...defaultAdvancedSettings(), enabled: false } }));
  assert(off.netBase === simple.netBase, `off netBase ${off.netBase} vs ${simple.netBase}`);
  assert(off.obligation === simple.obligation, `off obligation ${off.obligation} vs ${simple.obligation}`);
  assert(off.remaining === simple.remaining, `off remaining ${off.remaining} vs ${simple.remaining}`);
  assert(off.income === simple.income, `off income`);
  assert(off.expenses === simple.expenses, `off expenses`);
  assert(off.tzedaka === simple.tzedaka, `off tzedaka`);
  console.log('OK: advanced off matches computeTotals');

  // --- Acceptance: משכורת 15k, מס 2k, בל 800 ---
  const salaryCase: LedgerEntry[] = [
    entry({ kind: 'income', category: 'משכורת', amount: 15000 }),
    entry({ kind: 'expense', category: 'מס הכנסה', amount: 2000 }),
    entry({ kind: 'expense', category: 'ביטוח לאומי', amount: 800 }),
  ];

  const afterMand = totalsAdvanced(
    salaryCase,
    baseProfile({
      advanced: { ...defaultAdvancedSettings(), taxDeductionMode: 'after_mandatory' },
    })
  );
  assert(approx(afterMand.netBase, 12200), `after_mandatory base got ${afterMand.netBase}`);
  assert(approx(afterMand.obligation, 1220), `after_mandatory obl got ${afterMand.obligation}`);
  assert(afterMand.warnings.length === 0, 'after_mandatory should have no tax warning');
  console.log('OK: after_mandatory → 12,200 / 1,220');

  const afterTaxOnly = totalsAdvanced(
    salaryCase,
    baseProfile({
      advanced: { ...defaultAdvancedSettings(), taxDeductionMode: 'after_income_tax_only' },
    })
  );
  assert(approx(afterTaxOnly.netBase, 13000), `tax_only base got ${afterTaxOnly.netBase}`);
  assert(approx(afterTaxOnly.obligation, 1300), `tax_only obl got ${afterTaxOnly.obligation}`);
  assert(afterTaxOnly.warnings.length > 0, 'tax_only should warn about NI/health');
  console.log('OK: after_income_tax_only → 13,000 / 1,300 + warning');

  const gross = totalsAdvanced(
    salaryCase,
    baseProfile({
      advanced: { ...defaultAdvancedSettings(), taxDeductionMode: 'gross' },
    })
  );
  assert(approx(gross.netBase, 15000), `gross base got ${gross.netBase}`);
  assert(approx(gross.obligation, 1500), `gross obl got ${gross.obligation}`);
  assert(gross.warnings.length > 0, 'gross should warn');
  console.log('OK: gross → 15,000 / 1,500 + warning');

  // --- קצבה 1,000 במצב החרג → שורה פטורה, לא בבסיס ---
  const allowCase: LedgerEntry[] = [
    entry({ kind: 'income', category: 'משכורת', amount: 10000 }),
    entry({ kind: 'income', category: 'קצבה', amount: 1000 }),
  ];
  const allowEx = totalsAdvanced(
    allowCase,
    baseProfile({
      advanced: { ...defaultAdvancedSettings(), allowanceMode: 'exclude' },
    })
  );
  assert(approx(allowEx.netBase, 10000), `allowance exclude base got ${allowEx.netBase}`);
  const exempt = allowEx.lines.find((l) => l.kind === 'exempt' && l.id.includes('allow'));
  assert(!!exempt && approx(exempt!.amount, 1000), 'allowance should appear as exempt line');
  console.log('OK: allowance exclude → exempt, not in base');

  // --- ארכיון: ניכויים לפי קטגוריה אמיתית ---
  const archiveInputs = afterMand.inputs;
  assert(archiveInputs.incomeTax === 2000, 'archive incomeTax');
  assert(archiveInputs.nationalInsurance === 800, 'archive NI');
  assert(archiveInputs.salaryGross === 15000, 'archive salary');
  assert(archiveInputs.healthTax === 0, 'archive health');
  console.log('OK: archive inputs keep real deduction categories');

  console.log('\nAll T-25 totalsAdvanced tests passed.');
}

run();
