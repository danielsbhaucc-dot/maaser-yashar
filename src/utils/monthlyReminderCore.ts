export const CLOSE_MONTH_DISMISS_KEY = 'maaser_close_month_dismiss_v1';
export const APP_URL = 'https://maaser-yashar.netlify.app';
export const MONTHLY_REMINDER_ICS_UID = 'monthly-reminder@maaser-yashar.netlify.app';

const MONTH_NAMES = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const;

/** YYYY-MM של החודש הקודם */
export function previousPeriod(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** שם חודש בעברית בלי שנה */
export function periodMonthName(period: string): string {
  const [, m] = period.split('-');
  const idx = Number(m) - 1;
  return MONTH_NAMES[idx] ?? m ?? period;
}

export function closeMonthBannerText(prevPeriod: string): string {
  return `לסגור את ${periodMonthName(prevPeriod)}? שמור סיכום חודש וגבה.`;
}

/**
 * באנר סגירת חודש: ימים 1–5 בחודש הנוכחי,
 * רק אם החודש הקודם לא בארכיון, ולא נסגר ידנית.
 */
export function shouldShowCloseMonthBanner(
  historyPeriods: Iterable<string>,
  dismissedPeriod: string | null,
  now = new Date()
): boolean {
  const day = now.getDate();
  if (day < 1 || day > 5) return false;
  const prev = previousPeriod(now);
  for (const p of historyPeriods) {
    if (p === prev) return false;
  }
  if (dismissedPeriod === prev) return false;
  return true;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ה־1 הקרוב (כולל היום אם זה ה־1) */
export function nextFirstOfMonth(now = new Date()): Date {
  if (now.getDate() === 1) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function formatIcsDate(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function formatIcsUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** קובץ .ics עם RRULE חודשי ב־1 בכל חודש */
export function buildMonthlyReminderIcs(now = new Date()): string {
  const start = nextFirstOfMonth(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//maaser-yashar//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${MONTHLY_REMINDER_ICS_UID}`,
    `DTSTAMP:${formatIcsUtcStamp(now)}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(start)}`,
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=1',
    `SUMMARY:${escapeIcsText('מעשר ישר: לרשום את החודש ולגבות')}`,
    `DESCRIPTION:${escapeIcsText('תזכורת חודשית לשמור סיכום חודש ולגבות את הנתונים במעשר ישר.')}`,
    `URL:${APP_URL}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}
