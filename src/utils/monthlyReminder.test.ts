/**
 * בדיקות לוגיקת תזכורת חודשית / באנר סגירת חודש:
 *   npx --yes tsx src/utils/monthlyReminder.test.ts
 */
import {
  buildMonthlyReminderIcs,
  closeMonthBannerText,
  nextFirstOfMonth,
  periodMonthName,
  previousPeriod,
  shouldShowCloseMonthBanner,
} from './monthlyReminderCore';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const midSep = new Date(2026, 8, 28, 12, 0, 0);
  assert(previousPeriod(midSep) === '2026-08', `prev mid: ${previousPeriod(midSep)}`);
  assert(periodMonthName('2026-08') === 'אוגוסט', 'month name');
  assert(
    closeMonthBannerText('2026-08') === 'לסגור את אוגוסט? שמור סיכום חודש וגבה.',
    'banner copy'
  );

  const day3 = new Date(2026, 8, 3, 10, 0, 0);
  assert(
    shouldShowCloseMonthBanner([], null, day3) === true,
    'show when prev not archived'
  );
  assert(
    shouldShowCloseMonthBanner(['2026-08'], null, day3) === false,
    'hide when archived'
  );
  assert(
    shouldShowCloseMonthBanner([], '2026-08', day3) === false,
    'hide when dismissed'
  );
  assert(
    shouldShowCloseMonthBanner([], null, midSep) === false,
    'hide after day 5'
  );
  assert(
    shouldShowCloseMonthBanner([], null, new Date(2026, 8, 1, 8, 0, 0)) === true,
    'show on day 1'
  );
  assert(
    shouldShowCloseMonthBanner([], null, new Date(2026, 8, 5, 23, 0, 0)) === true,
    'show on day 5'
  );
  assert(
    shouldShowCloseMonthBanner([], null, new Date(2026, 8, 6, 0, 30, 0)) === false,
    'hide on day 6'
  );

  const next = nextFirstOfMonth(midSep);
  assert(next.getFullYear() === 2026 && next.getMonth() === 9 && next.getDate() === 1, 'next Oct 1');
  const onFirst = nextFirstOfMonth(new Date(2026, 9, 1, 9, 0, 0));
  assert(onFirst.getMonth() === 9 && onFirst.getDate() === 1, 'stay on Oct 1');

  const ics = buildMonthlyReminderIcs(midSep);
  assert(ics.includes('BEGIN:VCALENDAR'), 'ics calendar');
  assert(ics.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=1'), 'ics rrule');
  assert(ics.includes('DTSTART;VALUE=DATE:20261001'), `ics dtstart: ${ics}`);
  assert(ics.includes('מעשר ישר'), 'ics summary he');
  assert(ics.includes('\r\n'), 'ics crlf');

  console.log('OK: monthlyReminder banner + ics');
}

run();
