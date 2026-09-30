/**
 * M19 — היכרות חכמה: סירוב → אישור בכפתור → ברירות מחדל + לשון רבים.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_ONBOARD_CLARIFY,
  ONBOARD_DEFAULTS,
  isNoPhrase,
  isSkipPhrase,
  isYesPhrase,
  localOnboardParse,
  nameTokenQuality,
  parseGenderPhrase,
  parseMaritalPhrase,
  parseOnboardStep,
  parseRatePhrase,
  refuseAskSureMessage,
  refuseButtonLabel,
  refuseFieldForStep,
  skipNameContinue,
} from '../onboardApi';
import { friendWord, t } from '../../utils/copy';

describe('M19 onboard defaults', () => {
  it('locks friendly defaults for refusal', () => {
    expect(ONBOARD_DEFAULTS.displayName).toBe('');
    expect(ONBOARD_DEFAULTS.gender).toBe('unspecified');
    expect(ONBOARD_DEFAULTS.maritalStatus).toBe('unknown');
    expect(ONBOARD_DEFAULTS.rate).toBe(0.1);
    expect(MAX_ONBOARD_CLARIFY).toBeGreaterThanOrEqual(2);
  });

  it('maps steps to refuse fields', () => {
    expect(refuseFieldForStep(0)).toBe('name');
    expect(refuseFieldForStep(1)).toBe('gender');
    expect(refuseFieldForStep(2)).toBe('marital');
    expect(refuseFieldForStep(3)).toBe('rate');
    expect(refuseFieldForStep(4)).toBeNull();
  });

  it('exposes Hebrew confirm copy for each field', () => {
    for (const field of ['name', 'gender', 'marital', 'rate'] as const) {
      expect(refuseAskSureMessage(field).length).toBeGreaterThan(10);
      expect(refuseButtonLabel(field).length).toBeGreaterThan(4);
    }
    expect(refuseButtonLabel('name')).toMatch(/בלי שם|ממשיכים/);
    expect(refuseButtonLabel('gender')).toMatch(/ניטרל/);
    expect(refuseButtonLabel('rate')).toMatch(/10%/);
  });
});

describe('M19 yes/no + skip phrases', () => {
  it('detects affirmative and negative replies', () => {
    expect(isYesPhrase('כן')).toBe(true);
    expect(isYesPhrase('בטוחים')).toBe(true);
    expect(isYesPhrase('yes')).toBe(true);
    expect(isNoPhrase('לא')).toBe(true);
    expect(isNoPhrase('ביטול')).toBe(true);
    expect(isYesPhrase('יוסף')).toBe(false);
  });

  it('treats prefer-not / skip as skip phrases', () => {
    expect(isSkipPhrase('דלג')).toBe(true);
    expect(isSkipPhrase('מעדיף לא')).toBe(true);
    expect(isSkipPhrase('prefer not to say')).toBe(true);
    expect(isSkipPhrase('רווק')).toBe(false);
  });
});

describe('M19 parseOnboardStep refusal vs choice', () => {
  it('skip_name on intro', () => {
    expect(localOnboardParse('בלי שם').intent).toBe('skip_name');
    expect(localOnboardParse('יוסף').intent).toBe('name');
  });

  it('skip phrases become skip_step (UI מדלג מיד עם undo)', () => {
    expect(parseOnboardStep(1, 'דלג').intent).toBe('skip_step');
    expect(parseOnboardStep(2, 'לא רוצה להגיד').intent).toBe('skip_step');
    expect(parseOnboardStep(3, 'skip').intent).toBe('skip_step');
  });

  it('explicit plural gender applies without skip_step', () => {
    expect(parseGenderPhrase('לשון רבים')).toBe('unspecified');
    expect(parseGenderPhrase('ניטרלי')).toBe('unspecified');
    expect(parseOnboardStep(1, 'לשון רבים')).toEqual(
      expect.objectContaining({ intent: 'gender', gender: 'unspecified' })
    );
  });

  it('parses gender / marital / rate answers', () => {
    expect(parseOnboardStep(1, 'נקבה').gender).toBe('female');
    expect(parseMaritalPhrase('אלמנה')?.maritalStatus).toBe('widowed');
    expect(parseMaritalPhrase('גרוש')?.maritalStatus).toBe('divorced');
    expect(parseRatePhrase('חומש')).toBe(0.2);
    expect(parseOnboardStep(3, 'מעשר').rate).toBe(0.1);
  });

  it('skip name continue is gender-neutral', () => {
    expect(skipNameContinue()).toMatch(/בלי שם|הגדרות/);
    expect(skipNameContinue()).not.toMatch(/חבר בינתיים|ממשיכות/);
  });
});

describe('name judgment + confirm', () => {
  it('rejects keyboard smash / gibberish as name', () => {
    expect(localOnboardParse('שדגכ').intent).toBe('gibberish');
    expect(localOnboardParse('asdf').intent).toBe('gibberish');
    expect(localOnboardParse('qwer').intent).toBe('gibberish');
    expect(nameTokenQuality('שדגכ')).toBe('reject');
    expect(nameTokenQuality('asdfgh')).toBe('reject');
  });

  it('accepts clear Hebrew names', () => {
    expect(localOnboardParse('יוסף').intent).toBe('name');
    expect(localOnboardParse('מיכל').intent).toBe('name');
    expect(localOnboardParse('דניאל').name).toBe('דניאל');
    expect(nameTokenQuality('מיכל')).toBe('high');
  });

  it('asks confirmation for doubtful short consonant clusters', () => {
    const r = localOnboardParse('בגד');
    expect(r.intent).toBe('confirm_name');
    expect(r.name).toBe('בגד');
    expect(r.reply).toMatch(/באמת/);
  });

  it('accepts doubtful name when user affirms in the same message', () => {
    const r = localOnboardParse('שמי בגד זה באמת השם שלי');
    expect(r.intent).toBe('name');
    expect(r.name).toBe('בגד');
  });

  it('yes phrase detects explicit name confirmation', () => {
    expect(isYesPhrase('כן זה השם שלי')).toBe(true);
    expect(isYesPhrase('כן')).toBe(true);
  });

  it('gibberish on later steps asks for a real answer', () => {
    expect(parseOnboardStep(1, 'שדגכ').intent).toBe('gibberish');
    expect(parseOnboardStep(2, 'asdf').intent).toBe('gibberish');
  });
});

describe('M19 plural address helpers', () => {
  it('friendWord uses inclusive form when gender unspecified', () => {
    expect(friendWord('unspecified')).toBe('חבר/ה');
    expect(friendWord('male')).toBe('חבר');
    expect(friendWord('female')).toBe('חברה');
  });

  it('t() uses neutral / plural-leaning forms when unspecified', () => {
    expect(t('unspecified', 'ברוך הבא', 'ברוכה הבאה', 'ברוכים הבאים')).toBe(
      'ברוכים הבאים'
    );
    expect(t('unspecified', 'רווק', 'רווקה', 'רווק/ה')).toBe('רווק/ה');
  });
});
