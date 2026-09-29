import { describe, it, expect } from 'vitest';
import { computeTotals, createEntry, entriesForPeriod } from '../ledger';
import { formatMoney, parseMoney } from '../money';
import { calculateSection46, getAbsoluteCap, getMinDonation, SECTION_46 } from '../taxCalc';
import {
  applyRecurringRules,
  createRecurringRule,
  displayNote,
  kindLabel,
} from '../recurring';
import type { RecurringRule } from '../../types/recurring';

describe('money extras', () => {
  it('formatMoney formats ILS', () => {
    expect(formatMoney(1250)).toContain('1');
    expect(formatMoney(1250)).toContain('₪');
  });

  it('rejects oversized amounts', () => {
    expect(parseMoney('100000001').ok).toBe(false);
  });
});

describe('ledger helpers', () => {
  it('createEntry fills id and createdAt', () => {
    const entry = createEntry({
      period: '2026-09',
      kind: 'income',
      category: 'משכורת',
      amount: 100,
      note: '',
    });
    expect(entry.id).toBeTruthy();
    expect(entry.createdAt).toMatch(/^\d{4}-/);
  });

  it('entriesForPeriod filters and sorts newest first', () => {
    const a = createEntry({
      period: '2026-09',
      kind: 'income',
      category: 'a',
      amount: 1,
      note: '',
      date: '2026-09-01',
    });
    const b = createEntry({
      period: '2026-09',
      kind: 'income',
      category: 'b',
      amount: 2,
      note: '',
      date: '2026-09-15',
    });
    const other = createEntry({
      period: '2026-08',
      kind: 'income',
      category: 'c',
      amount: 3,
      note: '',
    });
    const list = entriesForPeriod([a, other, b], '2026-09');
    expect(list.map((e) => e.category)).toEqual(['b', 'a']);
  });

  it('computeTotals ignores non-finite and negative amounts', () => {
    const t = computeTotals(
      [
        {
          id: '1',
          period: '2026-09',
          kind: 'income',
          category: 'x',
          amount: Number.NaN,
          note: '',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: '2',
          period: '2026-09',
          kind: 'income',
          category: 'x',
          amount: -50,
          note: '',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: '3',
          period: '2026-09',
          kind: 'income',
          category: 'x',
          amount: 100,
          note: '',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      0.1
    );
    expect(t.income).toBe(100);
    expect(t.obligation).toBe(10);
  });
});

describe('taxCalc edges', () => {
  it('income cap and absolute cap tip paths', () => {
    const overIncome = calculateSection46({
      donationsTotal: 50_000,
      taxableIncome: 100_000,
      isCompany: false,
      taxYear: 2026,
      taxAlreadyPaid: 20_000,
    });
    expect(overIncome.eligible).toBe(true);
    expect(overIncome.reasons.some((r) => r.includes('30%'))).toBe(true);

    const overAbs = calculateSection46({
      donationsTotal: 11_000_000,
      taxableIncome: 50_000_000,
      isCompany: false,
      taxYear: 2026,
      taxAlreadyPaid: 5_000_000,
    });
    expect(overAbs.reasons.some((r) => r.includes('תקרה'))).toBe(true);
    expect(getAbsoluteCap(2026)).toBe(SECTION_46.absoluteCapByYear[2026]);
    expect(getMinDonation(1999)).toBe(207);
    expect(getAbsoluteCap(1999)).toBe(10_354_816);
  });
});

describe('recurring helpers', () => {
  it('createRecurringRule clamps day and defaults', () => {
    const r = createRecurringRule({
      kind: 'income',
      category: 'משכורת',
      amount: 500,
      note: 'שכר',
      dayOfMonth: 40,
    });
    expect(r.dayOfMonth).toBe(28);
    expect(r.enabled).toBe(true);
    expect(r.id.startsWith('r-')).toBe(true);
  });

  it('displayNote strips legacy rule markers', () => {
    expect(displayNote('תרומה #r-abc123 · עוד')).toBe('תרומה · עוד');
    expect(displayNote(null)).toBe('');
  });

  it('kindLabel covers kinds', () => {
    expect(kindLabel('income')).toBe('הכנסה');
    expect(kindLabel('expense')).toBe('ניכוי');
    expect(kindLabel('tzedaka')).toBe('צדקה');
  });

  it('skips disabled / zero-amount rules; applies when created before day', () => {
    const disabled: RecurringRule = {
      id: 'r-off',
      kind: 'tzedaka',
      category: 'צדקה',
      amount: 50,
      note: '',
      dayOfMonth: 5,
      enabled: false,
      createdAt: '2026-09-01T12:00:00.000Z',
    };
    const zero: RecurringRule = {
      ...disabled,
      id: 'r-zero',
      enabled: true,
      amount: 0,
    };
    const ok: RecurringRule = {
      id: 'r-ok',
      kind: 'tzedaka',
      category: 'צדקה',
      amount: 50,
      note: '',
      dayOfMonth: 10,
      enabled: true,
      createdAt: '2026-09-05T12:00:00.000Z',
    };

    const beforeDay = applyRecurringRules([disabled, zero, ok], [], new Date(2026, 8, 8, 12));
    expect(beforeDay.added).toBe(0);

    const onDay = applyRecurringRules([ok], [], new Date(2026, 8, 10, 12));
    expect(onDay.added).toBe(1);
    expect(onDay.ledger[0]?.id).toBe('r-ok-2026-09');
  });
});
