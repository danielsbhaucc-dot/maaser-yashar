import { describe, it, expect } from 'vitest';
import { computeTotals } from '../ledger';
import { parseMoney } from '../money';
import { calculateSection46, getMinDonation } from '../taxCalc';
import { applyRecurringRules } from '../recurring';
import { withCarryForward } from '../totalsAdvanced';
import { hebrewYearOf, yearSummary } from '../yearSummary';
import {
  buildBackupPayload,
  parseBackupJson,
  validateBackup,
} from '../backupFormat';
import type { LedgerEntry } from '../../types/ledger';
import type { RecurringRule } from '../../types/recurring';

const e = (
  kind: 'income' | 'expense' | 'tzedaka',
  amount: number,
  period = '2026-09'
): LedgerEntry => ({
  id: `${kind}-${amount}-${Math.random().toString(36).slice(2, 8)}`,
  period,
  kind,
  category: 'x',
  amount,
  note: '',
  createdAt: `${period}-10T12:00:00.000Z`,
});

/** לוגיקת טבעת הבית — תואמת HomeScreen */
function ringState(totals: { obligation: number; tzedaka: number }, hasEntries: boolean) {
  if (!hasEntries) return { kind: 'empty' as const };
  if (totals.obligation <= 0) return { kind: 'none' as const };
  return {
    kind: 'progress' as const,
    percent: Math.min(100, Math.round((totals.tzedaka / totals.obligation) * 100)),
  };
}

const salaryPlusGig = [
  e('income', 10000),
  e('income', 2500),
  e('tzedaka', 300),
  e('tzedaka', 450),
];

describe('computeTotals', () => {
  it('1: income 10k+2500, charity 300+450, rate 0.1', () => {
    const t = computeTotals(salaryPlusGig, 0.1);
    expect(t.netBase).toBe(12500);
    expect(t.obligation).toBe(1250);
    expect(t.tzedaka).toBe(750);
    expect(t.remaining).toBe(500);
    expect(ringState(t, true)).toEqual({ kind: 'progress', percent: 60 });
  });

  it('2: same entries, rate 0.2', () => {
    const t = computeTotals(salaryPlusGig, 0.2);
    expect(t.obligation).toBe(2500);
    expect(t.remaining).toBe(1750);
    expect(ringState(t, true)).toEqual({ kind: 'progress', percent: 30 });
  });

  it('3: income 15000, deductions 2000+800, charity 500', () => {
    const entries = [
      e('income', 15000),
      e('expense', 2000),
      e('expense', 800),
      e('tzedaka', 500),
    ];
    const t = computeTotals(entries, 0.1);
    expect(t.netBase).toBe(12200);
    expect(t.obligation).toBe(1220);
    expect(t.remaining).toBe(720);
    expect(ringState(t, true).percent).toBe(41);
  });

  it('4: deductions > income → base/debt/remainder 0, ring none', () => {
    const entries = [e('income', 12500), e('expense', 20000), e('tzedaka', 750)];
    const t = computeTotals(entries, 0.1);
    expect(t.netBase).toBe(0);
    expect(t.obligation).toBe(0);
    expect(t.remaining).toBe(0);
    expect(ringState(t, true)).toEqual({ kind: 'none' });
  });

  it('5: rate 0.15, income 12500 → debt 1875', () => {
    const t = computeTotals([e('income', 12500)], 0.15);
    expect(t.obligation).toBe(1875);
  });
});

describe('parseMoney', () => {
  it('6: rejects invalid / zero / empty inputs', () => {
    for (const raw of ['', '0', '12,5', '1.2.3', '12abc', '-250', '-250-']) {
      expect(parseMoney(raw).ok).toBe(false);
    }
  });

  it('7: accepts thousands, decimals, and currency symbol', () => {
    expect(parseMoney('1,250')).toEqual({ ok: true, value: 1250 });
    expect(parseMoney('99.99')).toEqual({ ok: true, value: 99.99 });
    expect(parseMoney('₪ 300')).toEqual({ ok: true, value: 300 });
  });
});

describe('calculateSection46', () => {
  const base = {
    taxYear: 2026,
    taxableIncome: 120_000,
    taxAlreadyPaid: 15_000,
    donationsTotal: 750,
  };

  it('8: individual → credit 262.5 (net cost 487.5)', () => {
    const r = calculateSection46({ ...base, isCompany: false });
    expect(r.eligible).toBe(true);
    expect(r.creditAmount).toBe(262.5);
    const netCost = base.donationsTotal - r.creditAmount;
    expect(netCost).toBe(487.5);
  });

  it('9: company → credit 225', () => {
    const r = calculateSection46({ ...base, isCompany: true });
    expect(r.creditAmount).toBe(225);
  });

  it('10: taxPaid 100 → credit capped at 100 (net cost 650)', () => {
    const r = calculateSection46({
      ...base,
      isCompany: false,
      taxAlreadyPaid: 100,
    });
    expect(r.creditAmount).toBe(100);
    expect(base.donationsTotal - r.creditAmount).toBe(650);
  });

  it('11: charity 100 → not eligible; min 207; missing 107', () => {
    const r = calculateSection46({
      ...base,
      isCompany: false,
      donationsTotal: 100,
    });
    expect(r.eligible).toBe(false);
    expect(r.minDonation).toBe(207);
    expect(getMinDonation(2026)).toBe(207);
    expect(r.minDonation - 100).toBe(107);
    expect(r.creditAmount).toBe(0);
  });
});

describe('applyRecurringRules', () => {
  it('12: day-10 rule created on 28th → not this month; once next month', () => {
    const rule: RecurringRule = {
      id: 'r-day10',
      kind: 'tzedaka',
      category: 'צדקה',
      amount: 100,
      note: '',
      dayOfMonth: 10,
      enabled: true,
      createdAt: '2026-09-28T12:00:00.000Z',
    };

    const onCreateDay = applyRecurringRules([rule], [], new Date(2026, 8, 28, 12));
    expect(onCreateDay.added).toBe(0);
    expect(onCreateDay.ledger).toHaveLength(0);
    expect(onCreateDay.rules[0]?.lastAppliedPeriod).toBeUndefined();

    const nextMonth = applyRecurringRules(
      onCreateDay.rules,
      onCreateDay.ledger,
      new Date(2026, 9, 10, 12)
    );
    expect(nextMonth.added).toBe(1);
    expect(nextMonth.ledger).toHaveLength(1);
    expect(nextMonth.ledger[0]?.period).toBe('2026-10');
    expect(nextMonth.rules[0]?.lastAppliedPeriod).toBe('2026-10');

    const again = applyRecurringRules(nextMonth.rules, nextMonth.ledger, new Date(2026, 9, 15, 12));
    expect(again.added).toBe(0);
    expect(again.ledger).toHaveLength(1);
  });
});

describe('withCarryForward', () => {
  it('13: Aug surplus 300 → Sept remainder 200', () => {
    const byPeriod = {
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
    const carried = withCarryForward(['2025-08', '2025-09'], byPeriod);
    expect(carried['2025-08']!.carryOut).toBe(300);
    expect(carried['2025-09']!.remaining).toBe(200);
  });
});

describe('yearSummary (Hebrew)', () => {
  it('14: 1-Jan-2026 → 5786; 15-Sep-2026 → 5787', () => {
    expect(hebrewYearOf('2026-01-01T12:00:00.000Z')).toBe(5786);
    expect(hebrewYearOf('2026-09-15T12:00:00.000Z')).toBe(5787);

    const txs: LedgerEntry[] = [
      {
        id: 'jan',
        period: '2026-01',
        kind: 'income',
        category: 'משכורת',
        amount: 1000,
        note: '',
        createdAt: '2026-01-01T12:00:00.000Z',
        date: '2026-01-01',
      },
      {
        id: 'sep',
        period: '2026-09',
        kind: 'income',
        category: 'משכורת',
        amount: 2000,
        note: '',
        createdAt: '2026-09-15T12:00:00.000Z',
        date: '2026-09-15',
      },
    ];

    const profile = {
      rate: 0.1,
      includeSpouse: false,
      maritalStatus: 'single' as const,
      advanced: {
        enabled: false,
        taxDeductionMode: 'after_mandatory' as const,
        giftMode: 'include' as const,
        inheritanceMode: 'exclude' as const,
        allowanceMode: 'exclude' as const,
        deductLoans: false,
      },
    };

    const y5786 = yearSummary(txs, profile, 'hebrew', 5786);
    const y5787 = yearSummary(txs, profile, 'hebrew', 5787);

    expect(y5786.entries.map((x) => x.id)).toEqual(['jan']);
    expect(y5787.entries.map((x) => x.id)).toEqual(['sep']);
  });
});

describe('backup round-trip', () => {
  it('15: export → read → restore data identical to source', () => {
    const source: Record<string, unknown> = {
      maaser_profile_v2: { displayName: 'בדיקה', rate: 0.1, onboardingDone: true },
      maaser_ledger_v1: [
        {
          id: '1',
          period: '2026-09',
          kind: 'income',
          category: 'משכורת',
          amount: 10000,
          note: '',
          createdAt: '2026-09-01T12:00:00.000Z',
        },
      ],
      maaser_recurring_v1: [],
      maaser_history_v1: [],
      maaser_tax_v1: { year: 2026 },
      '@maaser/a11y-v2': { fontSize: 0 },
    };

    // exportBackup → buildBackupPayload
    const exported = buildBackupPayload(source, '2026-09-12T10:00:00.000Z');
    // readBackup → parseBackupJson(file.text())
    const read = parseBackupJson(JSON.stringify(exported));
    // restoreBackup → validateBackup then write data
    const restored = validateBackup(read);

    expect(restored.data).toEqual(source);
    expect(JSON.stringify(restored.data)).toBe(JSON.stringify(source));
  });
});
