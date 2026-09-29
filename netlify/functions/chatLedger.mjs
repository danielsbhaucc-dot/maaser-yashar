/**
 * N-03 — מקור אמת יחיד: מספרי הפנקס מ־context בלבד.
 * לוגיקה טהורה לתיקון נותר/חובה/ניתן בתשובת המודל מול context.
 */

function num(v, max = 1e9) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.round(n * 100) / 100);
}

/** פורמט כמו בממשק: ₪1,960 */
export function moneyLabel(n) {
  const v = num(n);
  const formatted = v.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `₪${formatted}`;
}

function isEmptyLedger(ctx) {
  return (
    num(ctx.income) === 0 &&
    num(ctx.expenses) === 0 &&
    num(ctx.tzedaka) === 0 &&
    num(ctx.obligation) === 0 &&
    num(ctx.remaining) === 0
  );
}

function isPendingPhrase(seg) {
  return /לאחר אישור|אחרי אישור|כשתאשר|אם תאשר|באישור|לפני אישור/.test(seg);
}

/** ביטוי חשבוני מומצא: מספר אופרטור מספר = מספר */
const FABRICATED_ARITH =
  /[\d,]+(?:\.\d+)?\s*[+\-×xX*]\s*[\d,]+(?:\.\d+)?\s*=\s*[\d,]+(?:\.\d+)?/g;

/**
 * מתקן סכומי נותר/חובה/ניתן/נתרם בתשובה אם הם לא תואמים ל־context.
 * משפטים על סכומים «לאחר אישור» לא נוגעים.
 * ביטויים חשבוניים מומצאים מוחלפים במשפט פנקס.
 */
export function reconcileReplyWithContext(reply, ctx) {
  if (!ctx || typeof ctx !== 'object') return String(reply || '');
  const text = String(reply || '');
  if (!text.trim()) return text;

  const remaining = num(ctx.remaining);
  const obligation = num(ctx.obligation);
  const tzedaka = num(ctx.tzedaka);
  const empty = isEmptyLedger(ctx);

  const segments = text.split(/(?<=[.!?\n])/);
  const fixed = segments.map((seg) => {
    if (!seg || isPendingPhrase(seg)) return seg;
    let s = seg;
    s = s.replace(
      /((?:ה)?נותר|(?:מה )?נשאר(?:\s+לתת)?)\s*(?:החודש)?\s*[:\-]?\s*(?:₪\s*)?([\d,]+(?:\.\d+)?)/gi,
      (full, label, numStr) => {
        const stated = Number(String(numStr).replace(/,/g, ''));
        if (!Number.isFinite(stated) || Math.abs(stated - remaining) < 0.51) {
          return full;
        }
        return `${label} ${moneyLabel(remaining)}`;
      }
    );
    s = s.replace(
      /(חובה)\s*(?:החודש)?\s*[:\-]?\s*(?:₪\s*)?([\d,]+(?:\.\d+)?)/gi,
      (full, label, numStr) => {
        const stated = Number(String(numStr).replace(/,/g, ''));
        if (!Number.isFinite(stated) || Math.abs(stated - obligation) < 0.51) {
          return full;
        }
        return `${label} ${moneyLabel(obligation)}`;
      }
    );
    s = s.replace(
      /((?:ה)?ניתן|נתרם)\s*(?:החודש)?\s*[:\-]?\s*(?:₪\s*)?([\d,]+(?:\.\d+)?)/gi,
      (full, label, numStr) => {
        const stated = Number(String(numStr).replace(/,/g, ''));
        if (!Number.isFinite(stated) || Math.abs(stated - tzedaka) < 0.51) {
          return full;
        }
        return `${label} ${moneyLabel(tzedaka)}`;
      }
    );
    return s;
  });

  let out = fixed.join('');

  // ביטוי חשבוני מומצא → משפט פנקס
  if (!isPendingPhrase(out) && FABRICATED_ARITH.test(out)) {
    FABRICATED_ARITH.lastIndex = 0;
    const ledgerSentence = `החובה ${moneyLabel(obligation)}, ניתן ${moneyLabel(tzedaka)}, נותר ${moneyLabel(remaining)}.`;
    out = out
      .replace(FABRICATED_ARITH, ledgerSentence)
      .replace(/\n{3,}/g, '\n\n');
  }
  FABRICATED_ARITH.lastIndex = 0;

  // פנקס ריק + תשובה שעדיין מציגה נותר חיובי (בלי «לאחר אישור») → תיקון חד
  if (
    empty &&
    !isPendingPhrase(out) &&
    /(?:נותר|נשאר)/.test(out) &&
    /(?:₪\s*)?[1-9]\d{1,}/.test(out)
  ) {
    return 'אין תנועות החודש בפנקס — נותר ₪0.';
  }

  return out;
}
