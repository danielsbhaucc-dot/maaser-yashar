import { Platform, Share } from 'react-native';
import { APP_URL } from './monthlyReminderCore';

export const SHARE_TEXT =
  'מצאתי פנקס מעשר חינמי בעברית, בלי הרשמה, והנתונים נשארים אצלך';

export type ShareAppResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** כתובת מלאה לשיתוף (web: origin נוכחי; native: פרודקשן) */
export function appShareUrl(path = '/'): string {
  const normalized =
    !path || path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${normalized === '/' ? '/' : normalized}`;
  }
  return `${APP_URL}${normalized === '/' ? '' : normalized}`;
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fall through */
    }
  }
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * שיתוף האפליקציה: Web Share API כשזמין, אחרת העתקה ללוח.
 * ב־native ללא share בדפדפן — Share של React Native.
 */
export async function shareApp(opts?: {
  path?: string;
  url?: string;
}): Promise<ShareAppResult> {
  const url = opts?.url ?? appShareUrl(opts?.path ?? '/');
  const title = 'מעשר ישר';
  const message = `${SHARE_TEXT}\n${url}`;

  if (typeof navigator !== 'undefined') {
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    if (typeof nav.share === 'function') {
      const data: ShareData = { title, text: SHARE_TEXT, url };
      try {
        if (typeof nav.canShare === 'function' && !nav.canShare(data)) {
          /* fall through to clipboard */
        } else {
          await nav.share(data);
          return 'shared';
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
        /* fall through */
      }
    }
  }

  if (await copyToClipboard(message)) return 'copied';

  if (Platform.OS !== 'web') {
    try {
      const result = await Share.share({ message, title, url });
      if (result.action === Share.sharedAction) return 'shared';
      if (result.action === Share.dismissedAction) return 'cancelled';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}
