/** בדפדפן אין תזמון התראות חוזרות אמין בלי שרת — משתמשים ב־ICS. */
export type LocalReminderStatus = 'scheduled' | 'denied' | 'unsupported' | 'error';

export const MONTHLY_LOCAL_ID = 'maaser-monthly-local-v1';
export const MONTHLY_CHANNEL_ID = 'maaser-monthly';

export async function scheduleLocalMonthlyReminder(): Promise<LocalReminderStatus> {
  return 'unsupported';
}

export async function cancelLocalMonthlyReminder(): Promise<void> {
  // no-op on web
}
