import { BOT_NAME, t, type Gender } from './copy';
import type { LedgerEntry, LedgerTotals } from '../types/ledger';
import type { MaaserRate } from '../types';
import type { HistoryEntry } from './history';
import type { UserProfile } from './profile';
import { formatPeriod } from './history';
import { getMinDonation } from './taxCalc';
import {
  daysLeftInMonthLabel,
  endsInDaysLabel,
  monthsCoveredLabel,
  monthsWithBalanceLabel,
} from './plural';

export type SmartTone = 'tip' | 'warn' | 'ok' | 'action';

export type SmartInsight = {
  id: string;
  title: string;
  body: string;
  tone: SmartTone;
  /** תווית לפעולה אופציונלית */
  actionLabel?: string;
  actionKind?: 'income' | 'expense' | 'tzedaka' | 'save' | 'tax_fill' | 'none';
};

function money(n: number) {
  return `₪${Math.round(n).toLocaleString('he-IL')}`;
}

function daysLeftInMonth(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, end - now.getDate());
}

function dayOfMonth(now = new Date()) {
  return now.getDate();
}

/** תובנות חכמות למסך הבית */
export function homeSmartInsights(opts: {
  name: string;
  gender: Gender;
  totals: LedgerTotals;
  entries: LedgerEntry[];
  rate: MaaserRate;
  period: string;
  isCurrentPeriod: boolean;
}): SmartInsight[] {
  const { name, gender: g, totals, entries, rate, period, isCurrentPeriod } = opts;
  const out: SmartInsight[] = [];
  const left = daysLeftInMonth();
  const day = dayOfMonth();
  const hasIncome = entries.some((e) => e.kind === 'income');
  const hasExpense = entries.some((e) => e.kind === 'expense');
  const hasTzedaka = entries.some((e) => e.kind === 'tzedaka');

  if (entries.length === 0) {
    out.push({
      id: 'start',
      title: 'צעד ראשון חכם',
      body: t(
        g,
        `${name}, רוב האנשים מתחילים ממשכורת. תוסיף הכנסה אחת — ואני אחשב את החובה.`,
        `${name}, רוב האנשים מתחילות ממשכורת. תוסיפי הכנסה אחת — ואני אחשב את החובה.`
      ),
      tone: 'action',
      actionLabel: 'הוסף הכנסה',
      actionKind: 'income',
    });
    return out;
  }

  if (hasIncome && !hasExpense) {
    out.push({
      id: 'taxes',
      title: 'חסרים ניכויים?',
      body: t(
        g,
        'יש הכנסה בלי מס/ביטוח. אם כבר ירד מהתלוש — כדאי לרשום, כדי שהמעשר יהיה מהנטו.',
        'יש הכנסה בלי מס/ביטוח. אם כבר ירד מהתלוש — כדאי לרשום, כדי שהמעשר יהיה מהנטו.'
      ),
      tone: 'tip',
      actionLabel: 'הוסף הוצאה',
      actionKind: 'expense',
    });
  }

  if (totals.obligation > 0 && !hasTzedaka) {
    const weekly =
      left > 0 ? Math.ceil(totals.remaining / Math.max(1, Math.ceil(left / 7))) : totals.remaining;
    out.push({
      id: 'pace',
      title: 'קצב נתינה מומלץ',
      body: t(
        g,
        `נשאר ${money(totals.remaining)}. ${daysLeftInMonthLabel(left)} — בערך ${money(weekly)} לשבוע וזה נסגר ברכות.`,
        `נשאר ${money(totals.remaining)}. ${daysLeftInMonthLabel(left)} — בערך ${money(weekly)} לשבוע וזה נסגר ברכות.`
      ),
      tone: 'action',
      actionLabel: 'רשום צדקה',
      actionKind: 'tzedaka',
    });
  }

  if (totals.remaining > 0 && totals.tzedaka > 0 && isCurrentPeriod && left <= 7) {
    out.push({
      id: 'month_end',
      title: 'סוף חודש מתקרב',
      body: t(
        g,
        `${formatPeriod(period)} ${endsInDaysLabel(left)}. נשאר ${money(totals.remaining)} — שווה לסגור או לשמור סיכום.`,
        `${formatPeriod(period)} ${endsInDaysLabel(left)}. נשאר ${money(totals.remaining)} — שווה לסגור או לשמור סיכום.`
      ),
      tone: 'warn',
      actionLabel: 'שמור סיכום',
      actionKind: 'save',
    });
  }

  if (totals.remaining <= 0 && totals.obligation > 0) {
    out.push({
      id: 'done',
      title: 'החודש מכוסה',
      body: t(
        g,
        `כל הכבוד. שיעור ${Math.round(rate * 100)}% הושלם. כדאי לשמור סיכום לארכיון.`,
        `כל הכבוד. שיעור ${Math.round(rate * 100)}% הושלם. כדאי לשמור סיכום לארכיון.`
      ),
      tone: 'ok',
      actionLabel: 'שמור סיכום',
      actionKind: 'save',
    });
  }

  if (day >= 25 && isCurrentPeriod && entries.length > 0 && totals.obligation === 0 && hasIncome) {
    out.push({
      id: 'check',
      title: 'בדיקת דיוק',
      body: `${BOT_NAME}: בסוף חודש שווה לוודא שכל ההכנסות והמסים בפנקס — אחרת החובה יוצאת מעוותת.`,
      tone: 'tip',
    });
  }

  return out.slice(0, 3);
}

/** תובנות לארכיון */
export function historySmartInsights(opts: {
  name: string;
  gender: Gender;
  entries: HistoryEntry[];
}): SmartInsight[] {
  const { name, gender: g, entries } = opts;
  if (entries.length === 0) return [];

  const out: SmartInsight[] = [];
  const completed = entries.filter((e) => e.result.remaining <= 0).length;
  const open = entries.filter((e) => e.result.remaining > 0);
  const totalGiven = entries.reduce((s, e) => s + e.result.alreadyGiven, 0);
  const totalObl = entries.reduce((s, e) => s + e.result.obligation, 0);
  const avgPct =
    totalObl > 0 ? Math.round((totalGiven / totalObl) * 100) : completed === entries.length ? 100 : 0;

  const best = [...entries].sort(
    (a, b) => b.result.alreadyGiven - a.result.alreadyGiven
  )[0];

  out.push({
    id: 'streak',
    title: 'סיכום מסע',
    body: t(
      g,
      `${name}: ${monthsCoveredLabel(completed, entries.length)} · ממוצע כיסוי ~${avgPct}% · סה״כ צדקה בארכיון ${money(totalGiven)}.`,
      `${name}: ${monthsCoveredLabel(completed, entries.length)} · ממוצע כיסוי ~${avgPct}% · סה״כ צדקה בארכיון ${money(totalGiven)}.`
    ),
    tone: 'ok',
  });

  if (open.length > 0) {
    const sumOpen = open.reduce((s, e) => s + e.result.remaining, 0);
    out.push({
      id: 'open',
      title: 'יתרות פתוחות',
      body: t(
        g,
        `${monthsWithBalanceLabel(open.length)} (סה״כ ${money(sumOpen)}). לא חובה לסגור רטרו — רק שתדע מה פתוח.`,
        `${monthsWithBalanceLabel(open.length)} (סה״כ ${money(sumOpen)}). לא חובה לסגור רטרו — רק שתדעי מה פתוח.`
      ),
      tone: 'warn',
    });
  }

  if (best && best.result.alreadyGiven > 0) {
    out.push({
      id: 'best',
      title: 'חודש שיא',
      body: `${best.label || formatPeriod(best.period)} — נתת ${money(best.result.alreadyGiven)}. יפה מאוד.`,
      tone: 'tip',
    });
  }

  return out.slice(0, 3);
}

/** תובנות למסך מס — כולל מילוי חכם מפנקס */
export function taxSmartInsights(opts: {
  name: string;
  gender: Gender;
  donationsTotal: number;
  taxableIncome: number;
  taxPaid: number;
  taxYear: number;
  ledgerTzedaka: number;
  eligible: boolean;
  creditAmount: number;
  minDonation: number;
}): SmartInsight[] {
  const {
    name,
    gender: g,
    donationsTotal,
    taxableIncome,
    taxPaid,
    taxYear,
    ledgerTzedaka,
    eligible,
    creditAmount,
    minDonation,
  } = opts;
  const out: SmartInsight[] = [];

  if (ledgerTzedaka > 0 && donationsTotal === 0) {
    out.push({
      id: 'autofill',
      title: 'מילוי חכם מהפנקס',
      body: t(
        g,
        `${name}, בפנקס יש צדקה של ${money(ledgerTzedaka)} החודש. אפשר למלא את זה כבסיס לתרומות (אם עם אישור 46).`,
        `${name}, בפנקס יש צדקה של ${money(ledgerTzedaka)} החודש. אפשר למלא את זה כבסיס לתרומות (אם עם אישור 46).`
      ),
      tone: 'action',
      actionLabel: `מלא ${money(ledgerTzedaka)}`,
      actionKind: 'tax_fill',
    });
  }

  if (donationsTotal > 0 && donationsTotal < minDonation) {
    const need = minDonation - donationsTotal;
    out.push({
      id: 'min',
      title: 'מתחת למינימום',
      body: `חסרים עוד ${money(need)} כדי לעבור את מינימום ${taxYear} (${money(minDonation)}). בלי זה אין זיכוי.`,
      tone: 'warn',
    });
  }

  if (eligible && taxPaid > 0 && creditAmount > taxPaid) {
    out.push({
      id: 'cap_tax',
      title: 'תקרת מס ששולם',
      body: `הזיכוי המחושב ${money(creditAmount)} — בפועל עד ${money(taxPaid)} (גובה המס ששולם).`,
      tone: 'tip',
    });
  }

  if (eligible && taxableIncome > 0) {
    const effective = Math.min(creditAmount, taxPaid > 0 ? taxPaid : creditAmount);
    const netCost = Math.max(0, donationsTotal - effective);
    out.push({
      id: 'net_cost',
      title: 'עלות אמיתית משוערת',
      body: t(
        g,
        `תרמת ${money(donationsTotal)} · זיכוי ~${money(effective)} · עלות נטו ~${money(netCost)}. אומדן בלבד.`,
        `תרמת ${money(donationsTotal)} · זיכוי ~${money(effective)} · עלות נטו ~${money(netCost)}. אומדן בלבד.`
      ),
      tone: 'ok',
    });
  }

  if (donationsTotal === 0 && ledgerTzedaka === 0) {
    out.push({
      id: 'empty_tax',
      title: 'איך מתחילים',
      body: `${BOT_NAME}: הזן תרומות למוסד עם סעיף 46. בלי מספרים — אין מה לחשב.`,
      tone: 'tip',
    });
  }

  return out.slice(0, 3);
}

export function guideSmartInsights(opts: {
  name: string;
  gender: Gender;
  profile: UserProfile;
  remaining: number;
}): SmartInsight[] {
  const { name, gender: g, profile, remaining } = opts;
  const out: SmartInsight[] = [];

  if (remaining > 0) {
    out.push({
      id: 'focus',
      title: 'מומלץ לך עכשיו',
      body: t(
        g,
        `${name}, נשאר לתת ${money(remaining)}. אחרי שסוגרים בפנקס — עבור למפת סעיף 46 אם תרמת למוסד.`,
        `${name}, נשאר לתת ${money(remaining)}. אחרי שסוגרים בפנקס — עברי למפת סעיף 46 אם תרמת למוסד.`
      ),
      tone: 'action',
    });
  }

  if (profile.rate === 0.2) {
    out.push({
      id: 'chumash',
      title: 'אתה על חומש',
      body: '20% זה מידת חסידות. ב־FAQ למטה יש הסבר למה לא עוברים את זה בדרך כלל.',
      tone: 'tip',
    });
  } else {
    out.push({
      id: 'maaser',
      title: 'מעשר קלאסי',
      body: '10% מהנטו — הנתיב הנפוץ. אם מתלבטים על מתנות/ירושה, פתחו את שאלות המעשר.',
      tone: 'tip',
    });
  }

  if (profile.maritalStatus === 'married') {
    out.push({
      id: 'married',
      title: 'חישוב זוגי',
      body: profile.includeSpouse
        ? 'רשום: חישוב ביחד. שמרו על שיטה אחת — מחליפים? כדאי לשאול רב.'
        : 'רשום: כל אחד בנפרד. ודאו שלא סופרים אותה הכנסה פעמיים.',
      tone: 'tip',
    });
  }

  return out.slice(0, 3);
}

export function settingsSmartInsights(opts: {
  name: string;
  gender: Gender;
  profile: UserProfile;
}): SmartInsight[] {
  const { name, gender: g, profile } = opts;
  const out: SmartInsight[] = [];
  let score = 40;
  if (profile.displayName?.trim() && !['חבר', 'חברה'].includes(profile.displayName.trim()))
    score += 25;
  if (profile.maritalStatus !== 'unknown') score += 15;
  if (profile.rate === 0.1 || profile.rate === 0.2) score += 20;

  out.push({
    id: 'complete',
    title: 'שלמות פרופיל',
    body: t(
      g,
      `${name}, הפרופיל שלך על ~${score}%. ${score >= 90 ? 'מוכן לחישוב מדויק.' : 'השלם שם ומגדר — נועם מדבר יותר אישי.'}`,
      `${name}, הפרופיל שלך על ~${score}%. ${score >= 90 ? 'מוכן לחישוב מדויק.' : 'השלימי שם ומגדר — נועם מדבר יותר אישי.'}`
    ),
    tone: score >= 90 ? 'ok' : 'tip',
  });

  if (!profile.displayName?.trim() || ['חבר', 'חברה'].includes(profile.displayName.trim())) {
    out.push({
      id: 'name',
      title: 'שם חסר',
      body: 'בלי שם הפרטי החוויה כללית יותר. אפשר למלא כאן — או בצ׳אט עם נועם.',
      tone: 'warn',
    });
  }

  if (profile.rate === 0.2) {
    out.push({
      id: 'rate20',
      title: 'חומש פעיל',
      body: 'החובה מחושבת ב־20%. אפשר תמיד לחזור ל־10% אם זה לוחץ על התקציב.',
      tone: 'tip',
    });
  }

  return out.slice(0, 3);
}

export function suggestTaxDonationsFromLedger(ledgerTzedaka: number): number {
  return ledgerTzedaka > 0 ? Math.round(ledgerTzedaka * 100) / 100 : 0;
}

export { getMinDonation };
