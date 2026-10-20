/**
 * זיהוי סכום שלילי / לא חד-משמעי, ונרמול סימן השקל.
 * מודול טהור — משותף לשרת וללקוח בלי קנרי ובלי הנחיות.
 */

/** ₦ (ניירה) → ₪ בכל מקום בפלט */
export function forceIlsSymbol(text) {
  return String(text || '').replace(/₦/g, '₪');
}

/**
 * NEW-2 / C-09 — סכום שלילי בהודעת המשתמש.
 * מתאים: "מינוס 200", "מינוס200", "-200", "−200 ₪", "מינוס הכנסה 50".
 * לא מתאים: "200-300", "3-4 ימים" (טווח / ימים).
 */
export const NEGATIVE_AMOUNT_RE =
  /(?:(?:מינוס|שלילי|minus|negative)(?:\s+[^\d\s₪$]+){0,3}\s*[₪$]?\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:מינוס|שלילי|minus|negative)|(?:^|[\s,;:])[-−–]\s*[₪$]?\s*([\d,]+(?:\.\d+)?))/i;

/** מחזיר את הסכום החיובי מהודעה שלילית, או null אם אין התאמה */
export function detectNegativeAmount(text) {
  const m = String(text || '').match(NEGATIVE_AMOUNT_RE);
  if (!m) return null;
  const raw = m[1] || m[2] || m[3];
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** תשובת סירוב לסכום שלילי (D.2) */
export function negativeAmountReply(amount) {
  const label = Number.isInteger(amount) ? String(amount) : String(amount);
  return `אי אפשר לרשום סכום שלילי. התכוונת לתרומה של ₪${label}, או לתקן או למחוק תנועה שכבר נרשמה? אם למחוק, אפשר לעשות את זה ישירות בפנקס.`;
}

const MONEY_RANGE_RE =
  /(?<![\d.])(\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.\d+)?\s*[-–−]\s*(\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.\d+)?(?![\d])/g;

const BETWEEN_RE =
  /בין\s+(\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.\d+)?\s+ל\s*[-–−]?\s*(\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.\d+)?/;

const NON_MONEY_TAIL =
  /^\s*(?:ימים|יום|שעות|שעה|דקות|דקה|שבועות|שבוע|חודשים|חודש|עמודים|עמוד|שנים|שנה)(?![\u0590-\u05FF])/;

function parseNum(raw) {
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * טווח סכומים בלי מספר אחד ברור («200-300», «בין 100 ל-200»).
 * לא תופס תאריך YYYY-MM, «3-4 ימים», או «עמוד 12-15».
 * סכום שלילי מטופל בנפרד — כאן מחזירים null.
 */
export function detectAmbiguousAmount(text) {
  const s = String(text || '');
  if (!s.trim()) return null;
  if (detectNegativeAmount(s) != null) return null;

  const between = s.match(BETWEEN_RE);
  if (between) {
    const a = parseNum(between[1]);
    const b = parseNum(between[2]);
    if (a > 0 && b > 0 && a !== b) {
      return { low: Math.min(a, b), high: Math.max(a, b) };
    }
  }

  const re = new RegExp(MONEY_RANGE_RE.source, 'g');
  let m;
  while ((m = re.exec(s))) {
    const aRaw = m[1];
    const bRaw = m[2];
    if (/^\d{4}$/.test(aRaw) && /^\d{1,2}$/.test(bRaw)) continue;
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 16);
    if (NON_MONEY_TAIL.test(after)) continue;
    const pre = s.slice(Math.max(0, m.index - 8), m.index);
    if (/עמוד\s*$/.test(pre)) continue;
    const a = parseNum(aRaw);
    const b = parseNum(bRaw);
    if (!(a > 0 && b > 0) || a === b) continue;
    return { low: Math.min(a, b), high: Math.max(a, b) };
  }
  return null;
}

export function ambiguousAmountReply(low, high) {
  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(n));
  return `הסכום לא חד-משמעי. התכוונת ל־₪${fmt(low)} או ל־₪${fmt(high)}? כתוב סכום אחד ואז אוכל להציע כרטיס.`;
}

/** אין כרטיס כשההודעה האחרונה שלילית או לא חד-משמעית */
export function userMessageBlocksCard(text) {
  return detectNegativeAmount(text) != null || detectAmbiguousAmount(text) != null;
}
