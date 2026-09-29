/**
 * Unit tests for N-01 / N-02 / N-09 / N-10 / N-11 chat helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  validActions,
  stripSaveClaims,
  stripMarkdownHeadings,
  textSuggestsEntry,
  gateProposedActions,
  isEntryClarifyingQuestion,
} from '../../../netlify/functions/chatSafety.mjs';

describe('validActions (N-01)', () => {
  it('keeps a valid income entry', () => {
    const out = validActions([
      {
        type: 'add_entry',
        kind: 'income',
        amount: 9800,
        category: 'משכורת',
        note: 'נטו',
      },
    ]);
    expect(out).toEqual([
      {
        type: 'add_entry',
        kind: 'income',
        amount: 9800,
        category: 'משכורת',
        note: 'נטו',
      },
    ]);
  });

  it('maps synagogue donation to tzedaka with fallback category', () => {
    const out = validActions([
      {
        type: 'add_entry',
        kind: 'tzedaka',
        amount: 360,
        category: 'בית כנסת',
        note: '',
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('tzedaka');
    expect(out[0].amount).toBe(360);
    expect(out[0].category).toBe('אחר');
  });

  it('rejects obligation / remainder / negative / zero', () => {
    expect(
      validActions([
        { type: 'add_entry', kind: 'חובה', amount: 100, category: 'אחר' },
        { type: 'add_entry', kind: 'נותר', amount: 50, category: 'אחר' },
        { type: 'add_entry', kind: 'income', amount: 0, category: 'משכורת' },
        { type: 'add_entry', kind: 'income', amount: -5, category: 'משכורת' },
        { type: 'add_entry', kind: 'obligation', amount: 10, category: 'אחר' },
      ])
    ).toEqual([]);
  });

  it('caps at 3 actions and coerces unknown income category to אחר', () => {
    const raw = [1, 2, 3, 4].map((n) => ({
      type: 'add_entry',
      kind: 'income',
      amount: n * 10,
      category: 'לא קיים',
    }));
    const out = validActions(raw);
    expect(out).toHaveLength(3);
    expect(out.every((a) => a.category === 'אחר')).toBe(true);
  });

  it('drops expense with non-AI category (N-06)', () => {
    expect(
      validActions([
        {
          type: 'add_entry',
          kind: 'expense',
          amount: 100,
          category: 'החזר הלוואה',
        },
      ])
    ).toEqual([]);
  });
});

describe('stripSaveClaims (N-02)', () => {
  it('strips sentences that claim the entry was saved', () => {
    const cleaned = stripSaveClaims(
      'מעולה. זה יעבור לפנקס שלך. אפשר לבדוק כמה נשאר.'
    );
    expect(cleaned).not.toMatch(/יעבור לפנקס/);
    expect(cleaned).toMatch(/נשאר/);
  });

  it('falls back when the whole reply was a save claim', () => {
    expect(stripSaveClaims('רשמתי לך בפנקס.')).toBe(
      'להוסיף לפנקס? אשר בכפתור למטה'
    );
  });
});

describe('stripMarkdownHeadings (N-11)', () => {
  it('strips ### headings from line starts', () => {
    expect(stripMarkdownHeadings('### סיכום\nנותר ₪100')).toBe(
      'סיכום\nנותר ₪100'
    );
  });

  it('strips multiple heading levels', () => {
    expect(stripMarkdownHeadings('# א\n## ב\n### ג')).toBe('א\nב\nג');
  });

  it('leaves mid-line hashes alone', () => {
    expect(stripMarkdownHeadings('סכום #1 בסדר')).toBe('סכום #1 בסדר');
  });
});

describe('textSuggestsEntry (N-01 retry)', () => {
  it('detects explicit suggestion phrasing', () => {
    expect(textSuggestsEntry('אני מציע לרשום משכורת')).toBe(true);
  });

  it('detects amount + kind words', () => {
    expect(textSuggestsEntry('קיבלת משכורת של 9800 נטו')).toBe(true);
  });

  it('ignores plain chat without amounts', () => {
    expect(textSuggestsEntry('כמה נשאר לתת החודש?')).toBe(false);
  });

  it('does not retry on N-09 clarifying questions', () => {
    expect(isEntryClarifyingQuestion('נטו או ברוטו?')).toBe(true);
    expect(textSuggestsEntry('קיבלתי משכורת 9800 — נטו או ברוטו?')).toBe(false);
  });
});

describe('gateProposedActions (N-09 / N-10)', () => {
  it('blocks income without net/gross', () => {
    const g = gateProposedActions(
      [
        {
          type: 'add_entry',
          kind: 'income',
          amount: 9800,
          category: 'משכורת',
          note: '',
        },
      ],
      [{ role: 'user', content: 'קיבלתי משכורת 9,800' }]
    );
    expect(g.actions).toEqual([]);
    expect(g.reason).toBe('net_gross');
  });

  it('allows after net + exchange rate', () => {
    const g = gateProposedActions(
      [
        {
          type: 'add_entry',
          kind: 'income',
          amount: 18500,
          category: 'משכורת',
          note: 'נטו',
        },
      ],
      [
        { role: 'user', content: 'קיבלתי משכורת 5000 דולר' },
        { role: 'user', content: 'נטו, שער 3.7' },
      ]
    );
    expect(g.actions).toHaveLength(1);
    expect(g.actions[0].amount).toBe(18500);
  });

  it('keeps prior-month entry when period is set', () => {
    const g = gateProposedActions(
      [
        {
          type: 'add_entry',
          kind: 'tzedaka',
          amount: 100,
          category: 'צדקה / מעשר',
          note: '',
          period: '2026-08',
        },
      ],
      [{ role: 'user', content: 'תרשום לי תרומה של 100 ש"ח בחודש שעבר' }]
    );
    expect(g.actions).toHaveLength(1);
    expect(g.actions[0].period).toBe('2026-08');
  });

  it('keeps optional period on validActions', () => {
    const out = validActions([
      {
        type: 'add_entry',
        kind: 'tzedaka',
        amount: 100,
        category: 'צדקה / מעשר',
        note: '',
        period: '2026-08',
      },
    ]);
    expect(out[0].period).toBe('2026-08');
  });
});
