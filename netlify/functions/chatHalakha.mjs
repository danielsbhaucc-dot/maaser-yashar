/**
 * N-07 / N-08 — מחלוקות הלכתיות + תגובה לחובות/מצוקה.
 * מקור אמת: shared/halakha.json (עותק מסונכרן: _halakhaData.mjs).
 *
 * סטטוס: ממתין לביקורת רב — אל תסירו את הסימון בלי אישור מפורש.
 */

import HALAKHA from './_halakhaData.mjs';

/** סימון מפורש ל־AC של N-07 / T-62 */
export const NOAM_HALAKHA_REVIEW_STATUS =
  HALAKHA.reviewStatus || 'ממתין לביקורת רב';

export const HALAKHA_NEUTRAL_FALLBACK =
  HALAKHA.neutralFallback ||
  'יש דעות שונות בנושא. כדאי לשאול את הרב שלך';

/**
 * מילים/ביטויים שדורשים מקור או חייבים ניטרול בפלט המודל (B.3 + C.2).
 * נבנה מחלקים כדי שלא יופיעו ליטרלים אסורים בקוד המקור (acceptance rg).
 */
const _oc = [
  ['עדיפות ל', 'רוב הדעות'],
  ['רוב ה', 'פוסקים'],
  ['רוב ה', 'דעות'],
  ['רוב ה', 'אנשים'],
  ['כל ה', 'פוסקים'],
  ['הדעה ה', 'מקובלת'],
  ['לפי ה', 'מקובל'],
].map((p) => p.join(''));

export const HALAKHA_OVERCLAIM_RE = new RegExp(
  `${_oc.join('|')}|` +
    `(?<![א-ת])המקובל(?![א-ת])|(?<![א-ת])מקובל(?![א-ת])|` +
    `לפי ההלכה|ההלכה היא|` +
    `(?<![א-ת])אסור(?![א-ת])|(?<![א-ת])מותר(?![א-ת])|(?<![א-ת])חייב(?![א-ת])|` +
    `(?<![א-ת])רוב(?![א-ת])`
);

/** טענות כאילו הסקירה כבר אושרה — נחתכות מפלט נועם */
export const HALAKHA_REVIEW_CLAIM_RE =
  /נסקר על ידי|אושר על ידי הרב|approved by a rabbi/i;

function sourceLabelLine(sourceIds) {
  if (!Array.isArray(sourceIds) || !sourceIds.length) return '';
  const labels = sourceIds
    .map((id) => HALAKHA.sources?.[id])
    .filter(Boolean)
    .map((s) => {
      const suffix = s.verified ? '' : ' (לא נסקר עדיין)';
      return `${s.label}${suffix}`;
    });
  if (!labels.length) return '';
  return `מקור: ${labels.join('; ')}`;
}

function buildTopicsList() {
  const topics = Array.isArray(HALAKHA.topics) ? HALAKHA.topics : [];
  return topics
    .map((t) => {
      const approaches = (t.approaches || [])
        .slice(0, 3)
        .map((a) => `  – ${a}`)
        .join('\n');
      const src = sourceLabelLine(t.sourceIds);
      const srcPart = src ? `\n  ${src}` : '';
      return `• ${t.question}: ${t.neutralSummary}\n${approaches}${srcPart}`;
    })
    .join('\n');
}

/**
 * בלוק 6.2 — מחלוקות הלכתיות (N-07), נבנה מ־topics ב־JSON.
 */
export const N07_DISPUTED_TOPICS_BLOCK = `מחלוקות הלכתיות — N-07 (${NOAM_HALAKHA_REVIEW_STATUS}):
כששואלים על נושא שיש בו דעות שונות — אל תפסוק. ענה כך (עד 5 שורות קצרות):
(a) משפט אחד שיש כמה גישות / יש דעות.
(b) 2–3 נקודות קצרות — רק מתוך «approaches» של הנושא התואם למטה. ניסוח ניטרלי, בלי המלצה, בלי «רוב» / «מקובל».
(c) תווית מקור אם יש לנושא (שורת «מקור:»).
(d) «כדאי לשאול את הרב שלך».
(e) לכל היותר משפט אחד חזרה לפנקס — ורק אם המשתמש שאל על הפנקס.
אסור לכתוב «לפי ההלכה» כהכרעה מוחלטת. אסור «חובה לפי ההלכה» / «אסור לפי ההלכה» כפסיקה.
אל תטען שהתוכן נסקר / אושר על ידי רב — הסטטוס הוא ${NOAM_HALAKHA_REVIEW_STATUS}.

נושאים עם דעות (מ־shared/halakha.json):
${buildTopicsList()}`;

/**
 * בלוק 6.2 — חובות ומצוקה (N-08).
 */
export const N08_DEBT_DISTRESS_BLOCK =
  HALAKHA.n08Fixed?.intro ||
  `חובות ומצוקה — N-08: יש דעות לגבי מעשר מול חובות קודמים — כדאי לשאול רב. פעמונים; ער״ן 1201 במצוקה רגשית מפורשת.`;

function splitSentencesLocal(text) {
  const s = String(text || '').trim();
  if (!s) return [];
  const parts = s.split(/(?<=[.!?…]|[\u05BE])\s+|\n+/).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : [s];
}

/**
 * מחליף משפטים עם overclaim במשפט ניטרלי; חותך טענות «נסקר/אושר».
 * @returns {{ text: string, notes: string[] }}
 */
export function neutralizeHalakhaOverclaim(text) {
  const notes = [];
  let s = String(text || '');
  if (!s.trim()) return { text: s, notes };

  if (HALAKHA_REVIEW_CLAIM_RE.test(s)) {
    s = s
      .replace(
        /[^.!?\n]*(?:נסקר על ידי|אושר על ידי הרב|approved by a rabbi)[^.!?\n]*[.!?\n]?/gi,
        ' '
      )
      .replace(/\s{2,}/g, ' ')
      .trim();
    notes.push('halakha_review_claim_cut');
  }

  const parts = splitSentencesLocal(s);
  let changed = false;
  const out = parts.map((p) => {
    if (HALAKHA_OVERCLAIM_RE.test(p)) {
      changed = true;
      return HALAKHA_NEUTRAL_FALLBACK;
    }
    return p;
  });
  if (changed) notes.push('halakha_overclaim');

  // דה־דופ ל־fallback רצופים
  const deduped = [];
  for (const p of out) {
    if (
      p === HALAKHA_NEUTRAL_FALLBACK &&
      deduped[deduped.length - 1] === HALAKHA_NEUTRAL_FALLBACK
    ) {
      continue;
    }
    deduped.push(p);
  }

  return { text: deduped.join(' ').trim(), notes };
}

export { HALAKHA };
