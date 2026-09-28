/**
 * בדיקות T-25 — totalsAdvanced / calculateMaaser
 * + T-27 — withCarryForward / העברת עודף
 * הרצה: npx --yes tsx src/utils/totalsAdvanced.test.ts
 */
import type { LedgerEntry } from '../types/ledger';
import type { MaaserRate } from '../types';
import { computeTotals } from './ledger';
import {
  defaultAdvancedSettings,
  periodSurplus,
  resolvePeriodTotals,
  resolveTotals,
  totalsAdvanced,
  withCarryForward,
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
    id: `${partial.kind}-${partial.category}-${partial.amount}-${partial.period ?? '2026-09'}`,
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

  // ========== T-27: העברת עודף ==========
  const augSep = {
    '2025-08': {
      income: 10000,
      expenses: 0,
      tzedaka: 1300,
      netBase: 10000,
      obligation: 1000,
      remaining: 0,
    },
    '2025-09': {
      income: 12500,
      expenses: 0,
      tzedaka: 750,
      netBase: 12500,
      obligation: 1250,
      remaining: 500,
    },
  };

  assert(periodSurplus(augSep['2025-08']) === 300, 'Aug surplus should be 300');
  assert(periodSurplus(augSep['2025-09']) === 0, 'Sep has no local surplus');

  const carried = withCarryForward(['2025-08', '2025-09'], augSep);
  assert(carried['2025-08']!.carryOut === 300, `Aug carryOut got ${carried['2025-08']!.carryOut}`);
  assert(carried['2025-08']!.remaining === 0, 'Aug remaining 0');
  assert(carried['2025-09']!.carryIn === 300, `Sep carryIn got ${carried['2025-09']!.carryIn}`);
  assert(
    approx(carried['2025-09']!.remaining, 200),
    `ON → Sep remaining 200, got ${carried['2025-09']!.remaining}`
  );
  console.log('OK: T-27 withCarryForward Aug→Sep remaining 200');

  const ledgerAugSep: LedgerEntry[] = [
    entry({
      period: '2025-08',
      kind: 'income',
      category: 'משכורת',
      amount: 10000,
      createdAt: '2025-08-01T12:00:00.000Z',
    }),
    entry({
      period: '2025-08',
      kind: 'tzedaka',
      category: 'צדקה / מעשר',
      amount: 1300,
      createdAt: '2025-08-15T12:00:00.000Z',
    }),
    entry({
      period: '2025-09',
      kind: 'income',
      category: 'משכורת',
      amount: 12500,
      createdAt: '2025-09-01T12:00:00.000Z',
    }),
    entry({
      period: '2025-09',
      kind: 'tzedaka',
      category: 'צדקה / מעשר',
      amount: 750,
      createdAt: '2025-09-15T12:00:00.000Z',
    }),
  ];
  const profile = baseProfile();

  const sepOff = resolvePeriodTotals(ledgerAugSep, '2025-09', profile, false);
  assert(approx(sepOff.obligation, 1250), `Sep obl ${sepOff.obligation}`);
  assert(approx(sepOff.remaining, 500), `OFF → Sep remaining 500, got ${sepOff.remaining}`);
  assert(sepOff.carryIn === 0, 'OFF carryIn 0');

  const augOff = resolvePeriodTotals(ledgerAugSep, '2025-08', profile, false);
  assert(approx(augOff.surplus, 300), `OFF Aug surplus 300, got ${augOff.surplus}`);

  const sepOn = resolvePeriodTotals(ledgerAugSep, '2025-09', profile, true);
  assert(approx(sepOn.remaining, 200), `ON → Sep remaining 200, got ${sepOn.remaining}`);
  assert(approx(sepOn.carryIn, 300), `ON Sep carryIn 300, got ${sepOn.carryIn}`);

  const augOn = resolvePeriodTotals(ledgerAugSep, '2025-08', profile, true);
  assert(approx(augOn.surplus, 300), `ON Aug surplus still visible 300, got ${augOn.surplus}`);
  assert(approx(augOn.carryOut, 300), `ON Aug carryOut 300, got ${augOn.carryOut}`);
  console.log('OK: T-27 resolvePeriodTotals ON/OFF acceptance');

  console.log('\nAll T-25 + T-27 totalsAdvanced tests passed.');
}

run();
