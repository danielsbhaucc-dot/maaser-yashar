/** שיעור נתינה — תווית אחידה בכל האפליקציה */

const EPS = 1e-9;

export const RATE_MIN_PCT = 1;
export const RATE_MAX_PCT = 50;

export function approxRate(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < EPS;
}

/** אחוז לתצוגה — עד ספרה אחת אחרי הנקודה */
export function formatRatePercent(rate: number): string {
  const pct = Math.round(Number(rate) * 1000) / 10;
  if (!Number.isFinite(pct)) return '10';
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

/**
 * תווית שיעור:
 * 10% → מעשר · 20% → חומש · אחר → "15%" (לא מעשר/חומש)
 */
export function rateLabel(rate: number): string {
  const n = Number(rate);
  if (!Number.isFinite(n)) return 'מעשר';
  if (approxRate(n, 0.1)) return 'מעשר';
  if (approxRate(n, 0.2)) return 'חומש';
  return `${formatRatePercent(n)}%`;
}

/** תווית מלאה: מעשר 10% / חומש 20% / 15% */
export function rateLabelFull(rate: number): string {
  const n = Number(rate);
  if (!Number.isFinite(n)) return 'מעשר 10%';
  if (approxRate(n, 0.1)) return 'מעשר 10%';
  if (approxRate(n, 0.2)) return 'חומש 20%';
  return `${formatRatePercent(n)}%`;
}

export function rateCaption(rate: number): string {
  const n = Number(rate);
  if (approxRate(n, 0.1)) return 'מעשר — אחד מעשרה';
  if (approxRate(n, 0.2)) return 'חומש — אחד מחמישה';
  return `שיעור מותאם — ${formatRatePercent(n)}%`;
}

export type ParseRateResult =
  | { ok: true; rate: number; percent: number }
  | { ok: false; error: string };

/** מפרסר אחוז מהשדה (1–50, לכל היותר ספרה אחת אחרי הנקודה) → rate כשבר */
export function parseRatePercentInput(raw: string): ParseRateResult {
  const cleaned = String(raw ?? '')
    .trim()
    .replace('%', '')
    .replace(',', '.');
  if (!cleaned) {
    return { ok: false, error: 'הזינו אחוז בין 1% ל־50%' };
  }
  if (!/^\d+(\.\d)?$/.test(cleaned)) {
    return { ok: false, error: 'הזינו מספר תקין (עד ספרה אחת אחרי הנקודה)' };
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'הזינו מספר תקין' };
  }
  const percent = Math.round(n * 10) / 10;
  if (percent < RATE_MIN_PCT || percent > RATE_MAX_PCT) {
    return { ok: false, error: `האחוז חייב להיות בין ${RATE_MIN_PCT}% ל־${RATE_MAX_PCT}%` };
  }
  return { ok: true, rate: percent / 100, percent };
}

export function isValidMaaserRate(rate: number): boolean {
  const n = Number(rate);
  if (!Number.isFinite(n)) return false;
  const percent = Math.round(n * 1000) / 10;
  return percent >= RATE_MIN_PCT && percent <= RATE_MAX_PCT;
}
