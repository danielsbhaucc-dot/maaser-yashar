export type MoneyResult = { ok: true; value: number } | { ok: false; error: string };

/** מנקה מפרידי אלפים וסימני מטבע נפוצים */
function normalizeMoneyInput(raw: string): string {
  return raw
    .trim()
    .replace(/[\u00A0\s]/g, '')
    .replace(/[₪$€£]/g, '')
    .replace(/,(?=\d{3}(?:\D|$))/g, '');
}

export function parseMoney(raw: string): MoneyResult {
  // "1,250" -> "1250" (comma as thousands separator only)
  // "₪ 300" -> "300"
  const s = normalizeMoneyInput(raw);
  if (!s) return { ok: false, error: 'צריך להזין סכום' };
  if (s.startsWith('-')) return { ok: false, error: 'סכום לא יכול להיות שלילי' };
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    return { ok: false, error: 'סכום לא תקין: רק ספרות, ועד שתי ספרות אחרי הנקודה' };
  const value = Number(s);
  if (value <= 0) return { ok: false, error: 'צריך סכום גדול מאפס' };
  if (value > 100_000_000) return { ok: false, error: 'הסכום גדול מדי' };
  return { ok: true, value };
}

export function formatMoney(value: number): string {
  return `${value.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₪`;
}
