/**
 * סטטוס סקירת רב לתוכן ההלכתי (T-62).
 * אל תסמנו approved: true בלי הסכמה מפורשת של הרב להצגת שמו באפליקציה.
 */
export const RABBI_REVIEW = {
  approved: false,
  /** שם להצגה אחרי אישור — למשל "פלוני אלמוני". ריק = לא מציגים שורה. */
  name: '',
} as const;

/** שורת אישור להצגה ב־Guidelines / About — רק אחרי approved + name. */
export function rabbiReviewLine(): string | null {
  if (!RABBI_REVIEW.approved) return null;
  const name = RABBI_REVIEW.name.trim();
  if (!name) return null;
  return `התוכן ההלכתי נסקר על ידי הרב ${name}`;
}
