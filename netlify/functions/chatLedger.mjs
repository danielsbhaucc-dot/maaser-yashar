/**
 * N-03 — מקור אמת יחיד: מספרי הפנקס מ־context בלבד.
 * לוגיקה טהורה לתיקון נותר/חובה בתשובת המודל מול context.
 */

function num(v, max = 1e9) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.round(n * 100) / 100);
}

function moneyLabel(n) {
  const v = num(n);
  return Number.isInteger(v) ? String(v) : String(v);
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

/**
 * מתקן סכומי נותר/חובה בתשובה אם הם לא תואמים ל־context.
 * משפטים על סכומים «לאחר אישור» לא נוגעים.
 */
export function reconcileReplyWithContext(reply, ctx) {
  if (!ctx || typeof ctx !== 'object') return String(reply || '');
  const text = String(reply || '');
  if (!text.trim()) return text;

  const remaining = num(ctx.remaining);
  const obligation = num(ctx.obligation);
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
        return `${label} ₪${moneyLabel(remaining)}`;
      }
    );
    s = s.replace(
      /(חובה)\s*(?:החודש)?\s*[:\-]?\s*(?:₪\s*)?([\d,]+(?:\.\d+)?)/gi,
      (full, label, numStr) => {
        const stated = Number(String(numStr).replace(/,/g, ''));
        if (!Number.isFinite(stated) || Math.abs(stated - obligation) < 0.51) {
          return full;
        }
        return `${label} ₪${moneyLabel(obligation)}`;
      }
    );
    return s;
  });

  let out = fixed.join('');

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
