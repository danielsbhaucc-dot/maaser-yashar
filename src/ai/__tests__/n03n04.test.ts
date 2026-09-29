/**
 * N-03 / N-04 — מקור אמת לפנקס + גילוי AI.
 */
import { describe, expect, it } from 'vitest';
import { reconcileReplyWithContext } from '../../../netlify/functions/chatLedger.mjs';
import { localOnboardParse } from '../onboardApi';
import {
  NOAM_AI_DISCLOSURE_FIRST_PERSON,
  NOAM_AI_DISCLOSURE_LINE,
} from '../../constants/noamDisclosure';

const emptyCtx = {
  rate: 0.1,
  income: 0,
  expenses: 0,
  tzedaka: 0,
  obligation: 0,
  remaining: 0,
};

const filledCtx = {
  rate: 0.1,
  income: 9800,
  expenses: 0,
  tzedaka: 360,
  obligation: 980,
  remaining: 620,
};

describe('reconcileReplyWithContext (N-03)', () => {
  it('forces empty-ledger answer when invented remaining appears', () => {
    const out = reconcileReplyWithContext('נותר לך 620 ₪ לתת החודש.', emptyCtx);
    expect(out).toMatch(/אין תנועות החודש/);
    expect(out).not.toMatch(/620/);
  });

  it('corrects mismatched remaining to context', () => {
    const out = reconcileReplyWithContext('נותר 999 לתת.', filledCtx);
    expect(out).toMatch(/נותר\s*₪?620/);
    expect(out).not.toMatch(/999/);
  });

  it('corrects mismatched ניתן', () => {
    const out = reconcileReplyWithContext('ניתן 100 החודש.', filledCtx);
    expect(out).toMatch(/ניתן\s*₪360/);
  });

  it('leaves לאחר אישור amounts alone', () => {
    const out = reconcileReplyWithContext(
      'לאחר אישור יישאר נותר 620.',
      emptyCtx
    );
    expect(out).toContain('לאחר אישור');
    expect(out).toContain('620');
  });

  it('keeps matching remaining unchanged', () => {
    const out = reconcileReplyWithContext('נותר ₪620 החודש.', filledCtx);
    expect(out).toContain('620');
  });
});

describe('AI disclosure (N-04)', () => {
  it('exposes stable disclosure constants with AI wording', () => {
    expect(NOAM_AI_DISCLOSURE_LINE).toMatch(/עוזר AI/);
    expect(NOAM_AI_DISCLOSURE_FIRST_PERSON).toMatch(/עוזר ה-AI|עוזר AI/);
    expect(NOAM_AI_DISCLOSURE_FIRST_PERSON).toMatch(/לא רב/);
  });

  it('answers bot / person questions with AI assistant wording', () => {
    const a = localOnboardParse('האם אתה בוט?');
    expect(a.intent).toBe('question');
    expect(a.reply).toMatch(/עוזר ה-AI|עוזר AI|AI/);
    expect(a.reply).not.toMatch(/לא בוט|לא AI|אני אדם/);

    const b = localOnboardParse('האם אתה מלאכותי או אדם?');
    expect(b.reply).toMatch(/AI/);
    expect(b.reply).not.toMatch(/אני אדם/);
  });

  it('does not deny being a model', () => {
    const r = localOnboardParse('איזה מודל אתה?');
    expect(r.intent).toBe('question');
    expect(r.reply).toMatch(/AI/);
    expect(r.reply).not.toMatch(/לא מודל|לא GPT|לא Llama/);
  });
});
