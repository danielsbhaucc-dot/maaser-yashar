import { pluralHe } from './plural';

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function hoursLabel(n: number): string {
  return pluralHe(n, {
    one: 'שעה',
    two: 'שעתיים',
    many: `${n} שעות`,
  });
}

function daysAgoLabel(n: number): string {
  return pluralHe(n, {
    one: 'יום אחד',
    two: 'יומיים',
    many: `${n} ימים`,
  });
}

function monthsAgoLabel(n: number): string {
  if (n === 6) return 'חצי שנה';
  return pluralHe(n, {
    one: 'חודש',
    two: 'חודשיים',
    many: `${n} חודשים`,
  });
}

function yearsAgoLabel(n: number): string {
  if (n === 1) return 'שנה';
  if (n === 1.5) return 'שנה וחצי';
  return pluralHe(n, {
    one: 'שנה',
    two: 'שנתיים',
    many: `${n} שנים`,
  });
}

/**
 * תווית זמן יחסי בעברית — לפי סדר הדליים:
 * שעות → אתמול → שלשום → ימים → שבוע → שבועיים → חודשים → חצי שנה → שנים.
 */
export function formatRelativeTime(
  input: string | number | Date,
  now: Date = new Date()
): string {
  const then = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(then.getTime())) return '';

  const ms = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);

  const dayDiff = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(then).getTime()) / 86_400_000
  );

  // פחות משעה — דקות / עכשיו
  if (hours < 1) {
    if (minutes < 1) return 'עכשיו';
    if (minutes === 1) return 'לפני דקה';
    if (minutes === 2) return 'לפני שתי דקות';
    return `לפני ${minutes} דקות`;
  }

  // אותו יום קלנדרי — שעות
  if (dayDiff === 0) {
    return `לפני ${hoursLabel(Math.min(hours, 23))}`;
  }

  if (dayDiff === 1) return 'אתמול';
  if (dayDiff === 2) return 'שלשום';

  // 3–6 ימים
  if (dayDiff >= 3 && dayDiff <= 6) {
    return `לפני ${daysAgoLabel(dayDiff)}`;
  }

  // שבוע (~7–10 ימים)
  if (dayDiff >= 7 && dayDiff <= 10) {
    return 'לפני שבוע';
  }

  // שבועיים (~11–17 ימים)
  if (dayDiff >= 11 && dayDiff <= 17) {
    return 'לפני שבועיים';
  }

  // 18–24 ימים ≈ כמעט חודש — עדיין בימים
  if (dayDiff >= 18 && dayDiff <= 24) {
    return `לפני ${daysAgoLabel(dayDiff)}`;
  }

  // חודשים לפי הפרש חודשים משוער (≈30.4 ימים)
  const monthApprox = Math.max(1, Math.round(dayDiff / 30.44));

  if (monthApprox < 12) {
    const label = monthsAgoLabel(monthApprox);
    // "חודש" / "חודשיים" / "חצי שנה" / "N חודשים" — בלי "לפני" כפול כשזה כבר שם עצם נקי
    if (monthApprox === 1) return 'לפני חודש';
    if (monthApprox === 2) return 'לפני חודשיים';
    if (monthApprox === 6) return 'לפני חצי שנה';
    return `לפני ${label}`;
  }

  // שנים
  const yearApprox = dayDiff / 365.25;
  if (yearApprox < 1.25) return 'לפני שנה';
  if (yearApprox < 1.75) return 'לפני שנה וחצי';
  if (yearApprox < 2.5) return 'לפני שנתיים';

  const years = Math.round(yearApprox);
  return `לפני ${yearsAgoLabel(years)}`;
}
