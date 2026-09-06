import type { Tax46Inputs, Tax46Result } from '../types';

/** נתוני סעיף 46 — לפי כל זכות / רשות המסים (2024–2027 מוקפאים) */
export const SECTION_46 = {
  individualCreditRate: 0.35,
  companyCreditRate: 0.3,
  minDonationByYear: {
    2020: 190,
    2021: 190,
    2022: 190,
    2023: 200,
    2024: 207,
    2025: 207,
    2026: 207,
    2027: 207,
  } as Record<number, number>,
  absoluteCapByYear: {
    2020: 9_350_000,
    2021: 9_294_000,
    2022: 9_517_000,
    2023: 10_019_808,
    2024: 10_354_816,
    2025: 10_354_816,
    2026: 10_354_816,
    2027: 10_354_816,
  } as Record<number, number>,
  incomeCapPercent: 0.3,
  retroactiveYears: 6,
};

export function getMinDonation(year: number): number {
  return SECTION_46.minDonationByYear[year] ?? 207;
}

export function getAbsoluteCap(year: number): number {
  return SECTION_46.absoluteCapByYear[year] ?? 10_354_816;
}

export function calculateSection46(inputs: Tax46Inputs): Tax46Result {
  const minDonation = getMinDonation(inputs.taxYear);
  const absoluteCap = getAbsoluteCap(inputs.taxYear);
  const incomeCap = Math.max(0, inputs.taxableIncome * SECTION_46.incomeCapPercent);
  const creditRate = inputs.isCompany
    ? SECTION_46.companyCreditRate
    : SECTION_46.individualCreditRate;

  const reasons: string[] = [];
  const tips: string[] = [];

  if (inputs.donationsTotal < minDonation) {
    reasons.push(
      `סכום התרומות (${formatIls(inputs.donationsTotal)}) נמוך מהמינימום השנתי (${formatIls(minDonation)}). אין זיכוי.`
    );
  }

  const cappedDonation = Math.min(inputs.donationsTotal, absoluteCap, incomeCap || Infinity);
  const eligible = inputs.donationsTotal >= minDonation && cappedDonation > 0;
  const creditAmount = eligible ? Math.round(cappedDonation * creditRate * 100) / 100 : 0;

  if (inputs.donationsTotal > incomeCap && incomeCap > 0) {
    reasons.push(
      `התרומה חורגת מ־30% מההכנסה החייבת (${formatIls(incomeCap)}). הזיכוי מחושב רק עד התקרה.`
    );
  }
  if (inputs.donationsTotal > absoluteCap) {
    reasons.push(`התרומה חורגת מהתקרה הכספית (${formatIls(absoluteCap)}).`);
  }

  if (eligible && inputs.taxAlreadyPaid > 0 && creditAmount > inputs.taxAlreadyPaid) {
    tips.push(
      `הזיכוי המחושב (${formatIls(creditAmount)}) גבוה מהמס ששילמת (${formatIls(inputs.taxAlreadyPaid)}). בפועל תקבל עד גובה המס ששולם (אין "מזומן עודף" מזיכוי תרומה).`
    );
  }

  tips.push('התרומה חייבת להיות למוסד עם אישור סעיף 46 בתוקף לאותה שנה.');
  tips.push('שמרו קבלות עם שם התורם, המילה "תרומה", ואזכור סעיף 46.');
  if (inputs.taxYear >= 2026) {
    tips.push(
      'מ־2026: העמותה חייבת לדווח דיגיטלית במערכת "תרומות ישראל". קבלה שלא דווחה עלולה לא להיות מוכרת.'
    );
  }
  tips.push('שכיר: אפשר לנסות תיאום מס / עדכון בתלוש במהלך השנה, או החזר מס אחרי סוף השנה.');
  tips.push(`ניתן לדרוש החזר רטרואקטיבית עד ${SECTION_46.retroactiveYears} שנים אחורה (סעיף 160).`);

  return {
    eligible,
    creditRate,
    creditAmount: Math.min(creditAmount, inputs.taxAlreadyPaid > 0 ? inputs.taxAlreadyPaid : creditAmount),
    cappedDonation: eligible ? cappedDonation : 0,
    minDonation,
    absoluteCap,
    incomeCap,
    reasons,
    tips,
  };
}

function formatIls(n: number): string {
  return `${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`;
}
