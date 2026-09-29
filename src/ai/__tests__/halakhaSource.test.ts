/**
 * מקור אמת הלכתי — drift, overclaim guard, אין טענת «נסקר» בזמן approved=false.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import clientHalakha from '../../../shared/halakha.json';
import serverHalakha from '../../../netlify/functions/_halakhaData.mjs';
import {
  HALAKHA_NEUTRAL_FALLBACK,
  HALAKHA_OVERCLAIM_RE,
  neutralizeHalakhaOverclaim,
  N07_DISPUTED_TOPICS_BLOCK,
  NOAM_HALAKHA_REVIEW_STATUS,
} from '../../../netlify/functions/chatHalakha.mjs';
import { RABBI_REVIEW } from '../../constants/rabbiReview';
import { HALACHA_GUIDE, HALAKHA_PENDING_BANNER } from '../../constants/guides';

const root = join(__dirname, '../../..');

describe('halakha source of truth', () => {
  it('client JSON matches server generated copy', () => {
    expect(serverHalakha).toEqual(clientHalakha);
  });

  it('review status awaiting rabbi', () => {
    expect(clientHalakha.reviewStatus).toBe('ממתין לביקורת רב');
    expect(NOAM_HALAKHA_REVIEW_STATUS).toBe('ממתין לביקורת רב');
    expect(RABBI_REVIEW.approved).toBe(false);
  });

  it('FAQ has 15 entries in stable order', () => {
    expect(clientHalakha.faq).toHaveLength(15);
    expect(HALACHA_GUIDE).toHaveLength(15);
    expect(HALACHA_GUIDE.map((g) => g.title)).toEqual(
      clientHalakha.faq.map((f: { question: string }) => f.question)
    );
  });

  it('every FAQ entry has source line or no-agreed-source sentence', () => {
    for (const item of HALACHA_GUIDE) {
      const hasSource = !!(item.sources && item.sources.length > 0);
      const hasFallback = item.body.includes(clientHalakha.noAgreedSource);
      expect(hasSource || hasFallback).toBe(true);
    }
  });

  it('pending banner matches shared JSON', () => {
    expect(HALAKHA_PENDING_BANNER).toBe(clientHalakha.pendingBanner);
    expect(HALAKHA_PENDING_BANNER).toMatch(/לא נסקר על ידי רב/);
  });

  it('N07 block has no majority-priority phrasing', () => {
    const banned = [
      ['רוב ה', 'אנשים'].join(''),
      ['רוב ה', 'פוסקים'].join(''),
      ['עדיפות ל', 'רוב'].join(''),
    ];
    for (const b of banned) {
      expect(N07_DISPUTED_TOPICS_BLOCK).not.toContain(b);
    }
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/יש דעות|יש כמה גישות/);
    expect(N07_DISPUTED_TOPICS_BLOCK).toMatch(/כדאי לשאול את הרב/);
  });
});

describe('HALAKHA_OVERCLAIM_RE / neutralizeHalakhaOverclaim', () => {
  const samples = [
    ['עדיפות ל', 'רוב הדעות — עניים קודמים'].join(''),
    ['רוב ה', 'פוסקים נוהגים כך'].join(''),
    ['רוב ה', 'אנשים על 10%'].join(''),
    'לפי ההלכה צריך להפריש מהנטו',
    'ההלכה היא שמעשר חובה',
    'אסור לתת לקרוב',
    'מותר לשלם שכר לימוד ממעשר',
    'חייב להפריש ממתנה',
  ];

  it('has 8 regression samples', () => {
    expect(samples).toHaveLength(8);
  });

  for (const sample of samples) {
    it(`neutralizes: ${sample.slice(0, 28)}…`, () => {
      expect(HALAKHA_OVERCLAIM_RE.test(sample)).toBe(true);
      const { text, notes } = neutralizeHalakhaOverclaim(sample);
      expect(text).toBe(HALAKHA_NEUTRAL_FALLBACK);
      expect(notes).toContain('halakha_overclaim');
    });
  }

  it('cuts false review claims', () => {
    const claim = ['נסקר על ', 'ידי הרב'].join('');
    const { text, notes } = neutralizeHalakhaOverclaim(
      `יש דעות שונות. התוכן ${claim} כהן. כדאי לשאול רב.`
    );
    expect(text).not.toMatch(new RegExp(['נסקר על ', 'ידי'].join('')));
    expect(notes).toContain('halakha_review_claim_cut');
  });
});

describe('no positive reviewed claim while approved=false', () => {
  function walk(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (
        name === 'node_modules' ||
        name === 'dist' ||
        name === 'coverage' ||
        name === '__tests__'
      ) {
        continue;
      }
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p, acc);
      else if (/\.(ts|tsx|js|mjs|html|json)$/.test(name)) acc.push(p);
    }
    return acc;
  }

  it('src/ and public/ have no unsanctioned positive review claim', () => {
    expect(RABBI_REVIEW.approved).toBe(false);
    const allow = new Set([
      join(root, 'src', 'constants', 'rabbiReview.ts'),
      join(root, 'public', 'about.html'),
    ]);
    // positive claim = "נסקר על ידי" not preceded by "לא "
    const positive = /(?<!לא )נסקר על ידי/;
    const hits: string[] = [];
    for (const base of [join(root, 'src'), join(root, 'public')]) {
      for (const file of walk(base)) {
        if (allow.has(file)) continue;
        const text = readFileSync(file, 'utf8');
        if (positive.test(text)) {
          hits.push(relative(root, file));
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
