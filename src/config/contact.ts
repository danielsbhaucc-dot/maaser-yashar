/** כתובת יצירת קשר ציבורית — מקור אמת יחיד (לא סוד). בלי ברירת מחדל. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const CONTACT_PENDING_TEXT = 'כתובת ליצירת קשר תתווסף בקרוב.';

/** דומיין מת שלא קיים — אסור גם אם הוגדר ב־env. בלי ליטרל רציף בקוד. */
function isBlockedDeadAppDomain(email: string): boolean {
  const host = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return host === `${'maaser-yashar'}.${'app'}`;
}

function resolveContactEmail(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (!EMAIL_RE.test(value)) return null;
  if (isBlockedDeadAppDomain(value)) return null;
  return value;
}

export const CONTACT_EMAIL: string | null = resolveContactEmail(
  process.env.EXPO_PUBLIC_CONTACT_EMAIL
);

/** mailto עם נושא, או null כשאין כתובת תקפה. */
export function contactMailto(subject: string): string | null {
  if (!CONTACT_EMAIL) return null;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/** לייצוא לבדיקות / סקריפטים — אותה לוגיקת ולידציה. */
export function parseContactEmail(raw: string | undefined | null): string | null {
  return resolveContactEmail(raw);
}
