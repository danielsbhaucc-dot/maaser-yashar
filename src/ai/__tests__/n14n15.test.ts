/**
 * N-14 / N-15 — מבוא: בועה אחת, פנייה ניטרלית, פרסור דילוג/מצב משפחתי.
 */
import { describe, expect, it } from 'vitest';
import {
  isRateExplainPhrase,
  isSkipPhrase,
  localOnboardParse,
  parseGenderPhrase,
  parseMaritalPhrase,
  parseOnboardStep,
  skipNameContinue,
} from '../onboardApi';
import { introBubble, GENDER_ASK, INTROS, ASK_NAME } from '../../utils/chatScript';

describe('N-14 intro phrasing', () => {
  it('opening bubble is a single combined message', () => {
    const bubble = introBubble();
    expect(bubble.length).toBeGreaterThan(20);
    expect(bubble).toMatch(/איך קוראים|מה השם|לפנות|שם פרטי/);
  });

  it('intros avoid masculine second-person toward the user', () => {
    const joined = [...INTROS, ...ASK_NAME].join('\n');
    expect(joined).not.toMatch(/\bבוא\b/);
    expect(joined).not.toMatch(/תדע\b/);
    expect(joined).not.toMatch(/זרוק לי/);
    // Noam may self-describe; user-facing titles like חבר alone are ok in friendWord later
  });

  it('gender ask has no jokes and offers neutral option wording', () => {
    const joined = GENDER_ASK.join('\n');
    expect(joined).toMatch(/זכר|נקבה/);
    expect(joined).not.toMatch(/בדיחה|חחח|😂/);
  });

  it('skipNameContinue is gender-neutral', () => {
    const a = skipNameContinue('male');
    const b = skipNameContinue('female');
    const c = skipNameContinue('unspecified');
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).not.toMatch(/חבר בינתיים|חברה בינתיים/);
    expect(a).not.toMatch(/ממשיכות/);
  });
});

describe('N-15 free-text parser', () => {
  it('recognizes skip / prefer-not phrases', () => {
    expect(isSkipPhrase('דלג')).toBe(true);
    expect(isSkipPhrase('לא רוצה להגיד')).toBe(true);
    expect(isSkipPhrase("don't want to say")).toBe(true);
    expect(isSkipPhrase('prefer not to say')).toBe(true);
    expect(isSkipPhrase('יוסף')).toBe(false);
  });

  it('parses divorced with kids and widow', () => {
    expect(parseMaritalPhrase('גרוש עם 2 ילדים')?.maritalStatus).toBe('divorced');
    expect(parseMaritalPhrase('divorced')?.maritalStatus).toBe('divorced');
    expect(parseMaritalPhrase('אלמנה')?.maritalStatus).toBe('widowed');
  });

  it('parses prefer-not gender and rate explain', () => {
    expect(parseGenderPhrase('מעדיפים לא לומר')).toBe('unspecified');
    expect(parseGenderPhrase('זכר')).toBe('male');
    expect(isRateExplainPhrase('מה ההבדל?')).toBe(true);
    expect(isRateExplainPhrase("what's the difference")).toBe(true);
  });

  it('parseOnboardStep handles step intents', () => {
    // M19: דילוג חופשי → skip_step (המסך מאשר בכפתור)
    expect(parseOnboardStep(1, 'דלג').intent).toBe('skip_step');
    expect(parseOnboardStep(1, 'מעדיפים לא לומר').gender).toBe('unspecified');
    expect(parseOnboardStep(2, 'גרוש עם 2 ילדים').maritalStatus).toBe('divorced');
    expect(parseOnboardStep(3, 'מה ההבדל?').intent).toBe('rate_explain');
    expect(parseOnboardStep(3, 'חומש').rate).toBe(0.2);
  });

  it('still extracts names on step 0', () => {
    const r = localOnboardParse('יוסף');
    expect(r.intent).toBe('name');
    expect(r.name).toBe('יוסף');
  });
});
