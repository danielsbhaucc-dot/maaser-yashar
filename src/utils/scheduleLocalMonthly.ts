import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const MONTHLY_LOCAL_ID = 'maaser-monthly-local-v1';
export const MONTHLY_CHANNEL_ID = 'maaser-monthly';

export type LocalReminderStatus = 'scheduled' | 'denied' | 'unsupported' | 'error';

/**
 * תזכורת מקומית חוזרת ב־1 בכל חודש (בלי Push / שרת).
 * Android + iOS בלבד.
 */
export async function scheduleLocalMonthlyReminder(): Promise<LocalReminderStatus> {
  if (Platform.OS === 'web') return 'unsupported';

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(MONTHLY_CHANNEL_ID, {
        name: 'תזכורת חודשית',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return 'denied';

    await Notifications.cancelScheduledNotificationAsync(MONTHLY_LOCAL_ID).catch(() => {
      // אין מתוזמן קודם — בסדר
    });

    await Notifications.scheduleNotificationAsync({
      identifier: MONTHLY_LOCAL_ID,
      content: {
        title: 'מעשר ישר',
        body: 'לרשום את החודש ולגבות',
        data: { kind: 'monthly-reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 1,
        hour: 9,
        minute: 0,
        ...(Platform.OS === 'android' ? { channelId: MONTHLY_CHANNEL_ID } : {}),
      },
    });

    return 'scheduled';
  } catch {
    return 'error';
  }
}

export async function cancelLocalMonthlyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(MONTHLY_LOCAL_ID);
  } catch {
    // ignore
  }
}
