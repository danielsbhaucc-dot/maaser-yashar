import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';
import { scheduleLocalMonthlyReminder } from './scheduleLocalMonthly';
import {
  APP_URL,
  CLOSE_MONTH_DISMISS_KEY,
  MONTHLY_REMINDER_ICS_UID,
  buildMonthlyReminderIcs,
  closeMonthBannerText,
  nextFirstOfMonth,
  periodMonthName,
  previousPeriod,
  shouldShowCloseMonthBanner,
} from './monthlyReminderCore';

export {
  APP_URL,
  CLOSE_MONTH_DISMISS_KEY,
  MONTHLY_REMINDER_ICS_UID,
  buildMonthlyReminderIcs,
  closeMonthBannerText,
  nextFirstOfMonth,
  periodMonthName,
  previousPeriod,
  shouldShowCloseMonthBanner,
};

export async function loadCloseMonthDismissed(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLOSE_MONTH_DISMISS_KEY);
  } catch {
    return null;
  }
}

export async function dismissCloseMonthBanner(period: string): Promise<void> {
  await AsyncStorage.setItem(CLOSE_MONTH_DISMISS_KEY, period);
}

function downloadWebIcs(filename: string, content: string): boolean {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/** הורדת / שיתוף קובץ יומן חודשי */
export async function exportMonthlyReminderIcs(now = new Date()): Promise<void> {
  const content = buildMonthlyReminderIcs(now);
  const filename = 'maaser-monthly-reminder.ics';
  if (Platform.OS === 'web') {
    downloadWebIcs(filename, content);
    return;
  }
  await Share.share({
    title: 'תזכורת מעשר ישר',
    message: content,
  });
}

export type EnableReminderResult = {
  ics: boolean;
  notification: 'scheduled' | 'denied' | 'unsupported' | 'error';
  message: string;
};

/**
 * תזכורת חודשית בלי שרת:
 * - native: התראה מקומית חוזרת (expo-notifications) + ICS כגיבוי
 * - web: ICS ליומן (הדרך האמינה בלי שרת בדפדפן)
 */
export async function enableMonthlyReminder(): Promise<EnableReminderResult> {
  let ics = false;
  try {
    await exportMonthlyReminderIcs();
    ics = true;
  } catch {
    ics = false;
  }

  const notification = await scheduleLocalMonthlyReminder();

  if (notification === 'scheduled' && ics) {
    return {
      ics,
      notification,
      message: 'נקבעה התראה מקומית ל־1 בכל חודש, וגם הורד קובץ יומן (.ics).',
    };
  }
  if (notification === 'scheduled') {
    return {
      ics,
      notification,
      message: 'נקבעה התראה מקומית ל־1 בכל חודש.',
    };
  }
  if (ics) {
    return {
      ics,
      notification,
      message:
        notification === 'denied'
          ? 'הורד קובץ יומן (.ics). ההתראה המקומית לא אושרה — אפשר לאשר בהגדרות המכשיר.'
          : 'הורד קובץ יומן (.ics) — פתח ביומן Google / iPhone / Outlook לאירוע חוזר.',
    };
  }
  return {
    ics,
    notification,
    message: 'לא הצלחנו להגדיר תזכורת. נסה שוב.',
  };
}

export function reminderSettingsHint(): string {
  if (Platform.OS === 'web') {
    return 'בדפדפן: מורידים קובץ .ics ליומן (Google / Apple / Outlook) — בלי שרת. באפליקציה בנייד אפשר גם התראה מקומית.';
  }
  return 'התראה מקומית במכשיר ב־1 בכל חודש, ובנוסף קובץ יומן (.ics) כגיבוי — בלי שרת Push.';
}
