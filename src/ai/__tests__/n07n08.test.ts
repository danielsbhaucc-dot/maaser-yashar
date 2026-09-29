/**
 * N-07 / N-08 — בלוקי הלכה בפרומפט נועם + FAQ מסונכרן.
 */
import { describe, expect, it } from 'vitest';
import {
  N07_DISPUTED_TOPICS_BLOCK,
  N08_DEBT_DISTRESS_BLOCK,
  NOAM_HALAKHA_REVIEW_STATUS,
} from '../../../netlify/functions/chatHalakha.mjs';
import { HALACHA_GUIDE } from '../../constants/guides';

describe('N-07 disputed topics block', () => {
  it('marks awaiting rabbi review', () => {
    expect(NOAM_HALAKHA_REVIEW_STATUS).toBe('ממתין לביקורת רב');
    expect(N07_DISPUTED_TOPICS_BLOCK).toContain('ממתין לביקורת רב');
  });

  it('requires multi-opinion template and rabbi referral', () => {
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/יש דעות|יש כמה גישות/);
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/כדאי לשאול את הרב|יש לשאול את הרב/);
    expect(N07_DISPUTED_TOPICS_BLOCK).toContain('לפי ההלכה');
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/אסור לכתוב «לפי ההלכה»/);
  });

  it('covers regression topics 4–7 wording aligned with FAQ', () => {
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/ברוטו|נטו/);
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/מתנות/);
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/אח|קרוב/);
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/שכר לימוד/);
  });

  it('FAQ includes brother / tuition entries matching prompt', () => {
    const brother = HALACHA_GUIDE.find((g) => g.title.includes('לאח'));
    const tuition = HALACHA_GUIDE.find((g) => g.title.includes('שכר לימוד'));
    expect(brother?.body).toMatch(/יש דעות/);
    expect(brother?.body).toMatch(/שאלו רב/);
    expect(tuition?.body).toMatch(/יש דעות/);
    expect(tuition?.body).toMatch(/שאלו רב/);
  });
});

describe('N-08 debt / distress block', () => {
  it('includes Paamonim, ERAN gate, previous-debts opinion, no amounts', () => {
    expect(N08_DEBT_DISTRESS_BLOCK).toMatch(/פעמונים/);
    expect(N08_DEBT_DISTRESS_BLOCK).toMatch(/ער.?ן\s*1201|ער״ן 1201/);
    expect(N08_DEBT_DISTRESS_BLOCK).toMatch(/חובות קודמים/);
    expect(N08_DEBT_DISTRESS_BLOCK).toMatch(/כדאי לשאול|הפנה לרב|לשאול את הרב/);
    expect(N08_DEBT_DISTRESS_BLOCK).toMatch(/אל תבקש פירוט סכומי חובות/);
    expect(N08_DEBT_DISTRESS_BLOCK).toMatch(/מה שאתה צריך לעשות/);
    expect(N08_DEBT_DISTRESS_BLOCK).toMatch(/קצת דחוק|קצת לחוץ/);
    expect(N08_DEBT_DISTRESS_BLOCK).toMatch(/בלי ער.?ן|בלי ער״ן/);
  });

  it('FAQ debts entry mentions Paamonim and ERAN', () => {
    const debts = HALACHA_GUIDE.find((g) => g.title.includes('חובות'));
    expect(debts?.body).toMatch(/חובות קודמים/);
    expect(debts?.body).toMatch(/פעמונים/);
    expect(debts?.body).toMatch(/1201/);
    expect(debts?.body).toMatch(/שאלו רב/);
  });
});
