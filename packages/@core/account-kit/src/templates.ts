/**
 * תבנית עיצוב לכל מוצר מעל אותו ווק: טקסטים בעברית, צבעים ופינות. הערכה לא מציירת כלום בעצמה — כל מוצר מצייר
 * ברכיבים שלו (React Native, ‏DOM) לפי התבנית, כך שהמראה נשאר של המוצר וההתנהגות אחת לכולם.
 * defineAccountTemplate דוחה צבעים לא תקינים וניגודיות נמוכה מ־4.5:1 (טקסט ורקע, כפתור וטקסט הכפתור).
 */
import type { AccountError, AccountState } from './core.ts';

export interface AccountLabels {
  title: string; note: string; signIn: string; signUp: string; signOut: string;
  signedInAs: string; busy: string; errors: Record<AccountError, string>;
}
export interface AccountColors { surface: string; text: string; muted: string; accent: string; onAccent: string; border: string }
export interface AccountTemplate { id: string; labels: AccountLabels; colors: AccountColors; radius: number }

/** ברירת המחדל: המשתמש יודע שזה חשבון מרכזי של חברת האם (החלטה מ־9.11), אבל הכניסה נראית כמו כניסה רגילה. */
export const DEFAULT_LABELS: AccountLabels = {
  title: 'החשבון המרכזי',
  note: 'חשבון אחד לכל המוצרים שלנו. הכניסה מתבצעת בעמוד המאובטח של החשבון המרכזי, ואפשר לצאת בכל רגע.',
  signIn: 'כניסה',
  signUp: 'הרשמה',
  signOut: 'יציאה',
  signedInAs: 'מחובר/ת בתור',
  busy: 'רגע…',
  errors: {
    state: 'הכניסה לא הושלמה. אפשר לנסות שוב.',
    expired: 'עבר יותר מדי זמן. אפשר לנסות שוב.',
    denied: 'אין הרשאה לחשבון הזה כאן.',
    exchange: 'הכניסה לא הושלמה. אפשר לנסות שוב.',
    not_configured: 'הכניסה עדיין לא זמינה.',
    network: 'אין חיבור כרגע. אפשר לנסות שוב מאוחר יותר.',
    parent: 'הכניסה לא הושלמה. אפשר לנסות שוב.',
  },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };

export function defineAccountTemplate(t: { id: string; colors: AccountColors; radius?: number; labels?: Partial<Omit<AccountLabels, 'errors'>> & { errors?: Partial<Record<AccountError, string>> } }): AccountTemplate {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(t.id)) throw new Error('account-kit: bad template id');
  for (const [k, v] of Object.entries(t.colors)) if (!HEX.test(v)) throw new Error(`account-kit: ${k} must be #rrggbb`);
  if (contrast(t.colors.text, t.colors.surface) < 4.5) throw new Error('account-kit: text/surface contrast < 4.5');
  if (contrast(t.colors.muted, t.colors.surface) < 4.5) throw new Error('account-kit: muted/surface contrast < 4.5');
  if (contrast(t.colors.onAccent, t.colors.accent) < 4.5) throw new Error('account-kit: onAccent/accent contrast < 4.5');
  const radius = Math.max(0, Math.min(32, Math.round(t.radius ?? 14)));
  const labels: AccountLabels = { ...DEFAULT_LABELS, ...t.labels, errors: { ...DEFAULT_LABELS.errors, ...t.labels?.errors } };
  for (const v of [labels.title, labels.note, labels.signIn, labels.signUp, labels.signOut, labels.signedInAs, labels.busy, ...Object.values(labels.errors)]) {
    if (typeof v !== 'string' || !v.trim() || v.length > 240 || /[<>]/.test(v)) throw new Error('account-kit: bad label');
  }
  return Object.freeze({ id: t.id, colors: Object.freeze({ ...t.colors }), radius, labels: Object.freeze(labels) });
}

/** מה להציג למצב נתון (שורת מצב + כפתור ראשי). */
export function accountView(t: AccountTemplate, s: AccountState): { line: string; action: 'signIn' | 'signOut' | null; actionLabel: string; error: string | null } {
  if (s.status === 'busy') return { line: t.labels.busy, action: null, actionLabel: t.labels.busy, error: null };
  if (s.status === 'signed-in') return { line: `${t.labels.signedInAs} ${s.user.emailHint}`.trim(), action: 'signOut', actionLabel: t.labels.signOut, error: null };
  return { line: t.labels.note, action: 'signIn', actionLabel: t.labels.signIn, error: s.error ? t.labels.errors[s.error] : null };
}

/** נהורא: טורקיז על קרם (tokens של נהורא). ההתקדמות בקריאה נשארת במכשיר. */
export const NEHORA_ACCOUNT = defineAccountTemplate({
  id: 'nehora',
  colors: { surface: '#F7F3EC', text: '#0F3A40', muted: '#3A5C64', accent: '#0D5C63', onAccent: '#FFFFFF', border: '#D9E4E2' },
  radius: 18,
  labels: { note: 'חשבון אחד לכל המוצרים שלנו, לא חובה. ההתקדמות בקריאה נשארת במכשיר הזה. הכניסה מתבצעת בעמוד המאובטח של החשבון המרכזי.' },
});

/** מעשר ישר: סגול על כהה (theme של מעשר ישר). הרישומים נשארים במכשיר. */
export const MAASER_ACCOUNT = defineAccountTemplate({
  id: 'maaser-yashar',
  colors: { surface: '#12182C', text: '#F5F7FF', muted: '#C9CEE8', accent: '#8B9BFF', onAccent: '#0B1024', border: '#2A3352' },
  radius: 16,
  labels: { note: 'חשבון אחד לכל המוצרים שלנו, לא חובה. הרישומים שלך נשארים במכשיר. הכניסה מתבצעת בעמוד המאובטח של החשבון המרכזי.' },
});
