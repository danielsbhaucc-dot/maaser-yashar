/**
 * NEW-1 / NEW-2 / NEW-3 / N-03 — הקשר פנקס, grounding, שאלה, סכום שלילי, confirmed.
 */
import { describe, expect, it } from 'vitest';
import {
  NEGATIVE_AMOUNT_RE,
  applyIntentGates,
  detectNegativeAmount,
  dropConfirmedDuplicates,
  isAmountGrounded,
  isLedgerQuestionWithoutAmount,
  isClarifyingFollowUp,
  negativeAmountReply,
  sanitizeConfirmed,
} from '../../../netlify/functions/chatSafety.mjs';
import {
  moneyLabel,
  reconcileReplyWithContext,
} from '../../../netlify/functions/chatLedger.mjs';
import { buildContextFromLedger } from '../noamContext';
import type { LedgerEntry } from '../../types/ledger';
import type { UserProfile } from '../../utils/profile';
import { defaultAdvancedSettings } from '../../utils/totalsAdvanced';

const baseProfile = {
  displayName: 'דניאל',
  gender: 'male' as const,
  maritalStatus: 'married' as const,
  includeSpouse: true,
  rate: 0.1 as const,
  carryForwardSurplus: false,
  onboardingDone: true,
  chatConsentDone: true,
  chatShareTotals: true,
  saveChatHistory: true,
  advanced: defaultAdvancedSettings(),
} as UserProfile;

function entry(
  partial: Partial<LedgerEntry> & Pick<LedgerEntry, 'kind' | 'amount'>
): LedgerEntry {
  return {
    id: partial.id || `e-${partial.kind}-${partial.amount}`,
    period: partial.period || '2026-09',
    kind: partial.kind,
    category: partial.category || 'משכורת',
    amount: partial.amount,
    note: partial.note || '',
    createdAt: partial.createdAt || '2026-09-01T00:00:00.000Z',
    date: partial.date || '2026-09-01',
  };
}

describe('buildContextFromLedger (NEW-1 / N-03)', () => {
  it('is idempotent: income 9800 @ 10% → obligation/remaining 980', () => {
    const ledger = [
      entry({ kind: 'income', amount: 9800, category: 'משכורת' }),
    ];
    const a = buildContextFromLedger(baseProfile, ledger, '2026-09');
    const b = buildContextFromLedger(baseProfile, ledger, '2026-09');
    expect(a).toEqual(b);
    expect(a.income).toBe(9800);
    expect(a.obligation).toBe(980);
    expect(a.tzedaka).toBe(0);
    expect(a.remaining).toBe(980);
    expect(a.rate).toBe(0.1);
  });
});

describe('amount grounding (NEW-3)', () => {
  it('grounds amounts that appear in recent user messages', () => {
    const msgs = [
      { role: 'user', content: 'קיבלתי משכורת 9,800 ש"ח החודש' },
      { role: 'user', content: 'נטו' },
    ];
    expect(isAmountGrounded(9800, msgs)).toBe(true);
    expect(isAmountGrounded(620, msgs)).toBe(false);
  });

  it('grounds FX product (5000 × 3.7 = 18500)', () => {
    const msgs = [
      { role: 'user', content: 'קיבלתי משכורת 5000 דולר' },
      { role: 'user', content: 'נטו, שער 3.7' },
    ];
    expect(isAmountGrounded(18500, msgs)).toBe(true);
    expect(isAmountGrounded(5000, msgs)).toBe(true);
  });

  it('drops ungrounded 620 donation in empty-ledger question (C-03b)', () => {
    const msgs = [
      { role: 'user', content: 'קיבלתי משכורת 9,800 ש"ח החודש' },
      { role: 'assistant', content: 'נטו או ברוטו?' },
      { role: 'user', content: 'נטו' },
      { role: 'assistant', content: 'אפשר להוסיף — אשר למטה' },
      { role: 'user', content: 'תרמתי 360 ש"ח לבית כנסת' },
      { role: 'assistant', content: 'אפשר להוסיף לפנקס' },
      { role: 'user', content: 'כמה נשאר לי לתת?' },
    ];
    const g = applyIntentGates(
      [
        {
          type: 'add_entry',
          kind: 'tzedaka',
          amount: 620,
          category: 'צדקה / מעשר',
          note: '',
        },
      ],
      msgs,
      {
        rate: 0.1,
        income: 0,
        expenses: 0,
        tzedaka: 0,
        obligation: 0,
        remaining: 0,
      }
    );
    expect(g.actions).toEqual([]);
    expect(g.dropped).toBe(true);
  });
});

describe('question gate (NEW-3)', () => {
  it('detects ledger questions without digits', () => {
    expect(isLedgerQuestionWithoutAmount('כמה נשאר לי לתת?')).toBe(true);
    expect(isLedgerQuestionWithoutAmount('מה החובה החודש')).toBe(true);
    expect(isLedgerQuestionWithoutAmount('תרמתי 200')).toBe(false);
  });

  it('allows נטו follow-up after clarifying question (C-01b)', () => {
    const msgs = [
      { role: 'user', content: 'קיבלתי משכורת 9800' },
      { role: 'assistant', content: 'נטו או ברוטו?' },
      { role: 'user', content: 'נטו' },
    ];
    expect(isClarifyingFollowUp(msgs)).toBe(true);
    const g = applyIntentGates(
      [
        {
          type: 'add_entry',
          kind: 'income',
          amount: 9800,
          category: 'משכורת',
          note: '',
        },
      ],
      msgs,
      null
    );
    expect(g.actions).toHaveLength(1);
  });

  it('allows FX follow-up נטו, שער 3.7 (C-10b)', () => {
    const msgs = [
      { role: 'user', content: 'קיבלתי משכורת 5000 דולר' },
      {
        role: 'assistant',
        content: 'מה שער ההמרה ל־₪, וזה נטו או ברוטו?',
      },
      { role: 'user', content: 'נטו, שער 3.7' },
    ];
    expect(isClarifyingFollowUp(msgs)).toBe(true);
  });
});

describe('NEGATIVE_AMOUNT_RE (NEW-2 / C-09)', () => {
  const positives = [
    'תרמתי מינוס 200',
    'מינוס 200 תרמתי',
    '-200 לצדקה',
    '−200 ₪',
    '–150 צדקה',
    'סכום שלילי 50',
    'minus 100',
    'מינוס הכנסה 50',
  ];
  const negatives = [
    'תרמתי 200-300',
    '3-4 ימים',
    'תרמתי 200',
    'קיבלתי 9800 נטו',
    'שער 3.7',
    'בין 100 ל-200',
    'תאריך 2026-09',
    'עמוד 12-15',
  ];

  it.each(positives)('matches: %s', (s) => {
    expect(NEGATIVE_AMOUNT_RE.test(s)).toBe(true);
    expect(detectNegativeAmount(s)).not.toBeNull();
  });

  it.each(negatives)('does NOT match: %s', (s) => {
    expect(detectNegativeAmount(s)).toBeNull();
  });

  it('builds the exact refusal reply with the amount', () => {
    expect(negativeAmountReply(200)).toBe(
      'אי אפשר לרשום סכום שלילי. התכוונת לתרומה של ₪200, או לתקן או למחוק תנועה שכבר נרשמה? אם למחוק, אפשר לעשות את זה ישירות בפנקס.'
    );
  });
});

describe('confirmed-duplicate drop (NEW-1)', () => {
  it('drops identical confirmed action unless user restated the amount', () => {
    const confirmed = sanitizeConfirmed([
      {
        kind: 'income',
        category: 'משכורת',
        amount: 9800,
        period: '2026-09',
      },
    ]);
    const action = {
      type: 'add_entry',
      kind: 'income',
      category: 'משכורת',
      amount: 9800,
      note: '',
      period: '2026-09',
    };
    const dropped = dropConfirmedDuplicates(
      [action],
      confirmed,
      [{ role: 'user', content: 'כמה נשאר לי?' }]
    );
    expect(dropped.actions).toEqual([]);
    expect(dropped.droppedDuplicate).toBe(true);

    const kept = dropConfirmedDuplicates(
      [action],
      confirmed,
      [{ role: 'user', content: 'קיבלתי משכורת 9800 ש"ח החודש נטו' }]
    );
    expect(kept.actions).toHaveLength(1);
  });
});

describe('reconcile with ניתן (N-03)', () => {
  const ctx = {
    rate: 0.1,
    income: 9800,
    expenses: 0,
    tzedaka: 360,
    obligation: 980,
    remaining: 620,
  };

  it('corrects mismatched ניתן / נתרם', () => {
    const out = reconcileReplyWithContext('ניתן 999 החודש.', ctx);
    expect(out).toMatch(/ניתן\s*₪360/);
    expect(out).not.toMatch(/999/);
  });

  it('formats moneyLabel with thousands separators and ₪', () => {
    expect(moneyLabel(1960)).toBe('₪1,960');
    expect(moneyLabel(980)).toBe('₪980');
  });

  it('replaces fabricated arithmetic with ledger sentence', () => {
    const out = reconcileReplyWithContext(
      'חישבתי: 980 - 360 = 999. זה מה שנותר.',
      ctx
    );
    expect(out).toMatch(/החובה ₪980/);
    expect(out).toMatch(/ניתן ₪360/);
    expect(out).toMatch(/נותר ₪620/);
    expect(out).not.toMatch(/980\s*-\s*360\s*=\s*999/);
  });
});
