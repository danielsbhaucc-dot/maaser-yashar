import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import {
  BACKUP_KEYS,
  BACKUP_REMINDER_DAYS,
  CHAT_THREADS_KEY,
  LAST_BACKUP_KEY,
  PRE_RESTORE_KEY,
  buildBackupPayload,
  buildRestoreSummary,
  formatBackupDateHe,
  isBackupStale,
  parseBackupJson,
  parseStored,
  serializeForStorage,
  shouldRemindBackup,
  validateBackup,
  type Backup,
} from './backupFormat';

export {
  BACKUP_KEYS,
  BACKUP_REMINDER_DAYS,
  CHAT_THREADS_KEY,
  LAST_BACKUP_KEY,
  PRE_RESTORE_KEY,
  buildBackupPayload,
  buildRestoreSummary,
  formatBackupDateHe,
  isBackupStale,
  parseBackupJson,
  shouldRemindBackup,
  validateBackup,
};
export type { Backup };

type ReminderListener = () => void;
const reminderListeners = new Set<ReminderListener>();

export function subscribeBackupReminder(fn: ReminderListener): () => void {
  reminderListeners.add(fn);
  return () => {
    reminderListeners.delete(fn);
  };
}

function notifyBackupReminder() {
  reminderListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

function downloadWeb(filename: string, content: string, mime: string) {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([content], { type: mime });
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

async function tryShareFile(filename: string, content: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof File === 'undefined') return false;
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (!nav.share) return false;
  try {
    const file = new File([content], filename, { type: 'application/json' });
    const data: ShareData = { files: [file], title: 'גיבוי מעשר ישר' };
    if (typeof nav.canShare === 'function' && !nav.canShare(data)) return false;
    await nav.share(data);
    return true;
  } catch {
    return false;
  }
}

export async function collectBackupData(
  keys: readonly string[] = BACKUP_KEYS
): Promise<Record<string, unknown>> {
  const pairs = await AsyncStorage.multiGet([...keys]);
  const data: Record<string, unknown> = {};
  for (const [k, v] of pairs) {
    if (v == null) continue;
    data[k] = parseStored(v);
  }
  return data;
}

export type ExportBackupOptions = {
  /** לכלול גם שיחות עם נועם */
  includeChat?: boolean;
  /** שיתוף קובץ בנייד כשזמין (בנוסף להורדה ב־web) */
  preferShare?: boolean;
};

/** ייצוא גיבוי JSON מלא + עדכון maaser_last_backup */
export async function exportBackup(opts: ExportBackupOptions = {}): Promise<Backup> {
  const keys: string[] = [...BACKUP_KEYS];
  if (opts.includeChat) keys.push(CHAT_THREADS_KEY);

  const data = await collectBackupData(keys);
  const backup = buildBackupPayload(data);
  const content = JSON.stringify(backup, null, 2);
  const filename = `maaser-backup-${backup.exportedAt.slice(0, 10)}.json`;

  let shared = false;
  if (opts.preferShare !== false) {
    shared = await tryShareFile(filename, content);
  }

  if (!shared) {
    if (Platform.OS === 'web') {
      downloadWeb(filename, content, 'application/json;charset=utf-8');
    } else {
      const { Share } = await import('react-native');
      await Share.share({
        title: 'גיבוי מעשר ישר',
        message: content,
      });
    }
  }

  await AsyncStorage.setItem(LAST_BACKUP_KEY, backup.exportedAt);
  notifyBackupReminder();
  return backup;
}

/** גיבוי חירום ממסך שגיאה — כולל שיחות */
export async function exportDeviceBackupJson(): Promise<void> {
  await exportBackup({ includeChat: true, preferShare: true });
}

export async function readBackup(file: File): Promise<Backup> {
  const text = await file.text();
  return parseBackupJson(text);
}

/** שמירת מצב נוכחי ל־maaser_pre_restore ואז כתיבת הגיבוי + רענון */
export async function restoreBackup(backup: Backup): Promise<void> {
  const validated = validateBackup(backup);
  const keysToSnapshot = new Set<string>([...BACKUP_KEYS, CHAT_THREADS_KEY]);
  for (const k of Object.keys(validated.data)) keysToSnapshot.add(k);

  const preData = await collectBackupData([...keysToSnapshot]);
  const snapshot = buildBackupPayload(preData);
  await AsyncStorage.setItem(PRE_RESTORE_KEY, JSON.stringify(snapshot));

  const pairs: [string, string][] = [];
  for (const [k, v] of Object.entries(validated.data)) {
    if (v === undefined) continue;
    pairs.push([k, serializeForStorage(v)]);
  }
  if (pairs.length) {
    await AsyncStorage.multiSet(pairs);
  }

  await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  notifyBackupReminder();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign('/');
    return;
  }
  await reloadAppAsync('restore-backup');
}

export async function getLastBackupAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_BACKUP_KEY);
}

/** באנר תזכורת: יש תנועות + גיבוי ישן / חסר כשהתנועה הוותיקה מעל 30 יום */
export async function shouldShowBackupReminder(
  ledgerLength: number,
  oldestEntryIso?: string | null
): Promise<boolean> {
  const last = await getLastBackupAt();
  return shouldRemindBackup(ledgerLength, last, oldestEntryIso);
}

/** בחירת קובץ גיבוי (web) */
export function pickBackupFile(): Promise<File | null> {
  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    const cleanup = () => {
      input.remove();
    };
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    };
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}
