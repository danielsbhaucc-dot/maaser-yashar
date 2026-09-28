import AsyncStorage from '@react-native-async-storage/async-storage';

export type SafeLoadResult<T> = {
  data: T;
  corrupt: boolean;
  corruptBackupKey?: string;
};

/** שומר עותק גולמי של נתון פגום לפני שחוזרים ל־fallback */
export async function backupCorruptRaw(key: string, raw: string): Promise<string> {
  const backupKey = `${key}__corrupt_${Date.now()}`;
  await AsyncStorage.setItem(backupKey, raw);
  return backupKey;
}

export function saveBlockKey(storageKey: string): string {
  return `${storageKey}__save_blocked`;
}

export async function isSaveBlocked(storageKey: string): Promise<boolean> {
  return (await AsyncStorage.getItem(saveBlockKey(storageKey))) === '1';
}

export async function setSaveBlocked(storageKey: string, blocked: boolean): Promise<void> {
  const k = saveBlockKey(storageKey);
  if (blocked) await AsyncStorage.setItem(k, '1');
  else await AsyncStorage.removeItem(k);
}

/**
 * טוען מערך JSON מאחסון.
 * בשגיאת פיענוח: מעתיק ל־`key__corrupt_<ts>`, מסמן חסימת שמירה, ומחזיר fallback בלי לדרוס את המפתח המקורי.
 */
export async function safeLoadJsonArray<T>(
  key: string,
  fallback: T[] = []
): Promise<SafeLoadResult<T[]>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { data: fallback, corrupt: false };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const corruptBackupKey = await backupCorruptRaw(key, raw);
      await setSaveBlocked(key, true);
      return { data: fallback, corrupt: true, corruptBackupKey };
    }

    if (!Array.isArray(parsed)) {
      const corruptBackupKey = await backupCorruptRaw(key, raw);
      await setSaveBlocked(key, true);
      return { data: fallback, corrupt: true, corruptBackupKey };
    }

    return { data: parsed as T[], corrupt: false };
  } catch {
    return { data: fallback, corrupt: false };
  }
}

/**
 * טוען אובייקט JSON מאחסון (למשל פרופיל).
 * בשגיאת פיענוח: גיבוי + חסימת שמירה, בלי לדרוס את המפתח המקורי.
 */
export async function safeLoadJsonObject<T extends object>(
  key: string,
  fallback: T
): Promise<SafeLoadResult<T>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { data: fallback, corrupt: false };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const corruptBackupKey = await backupCorruptRaw(key, raw);
      await setSaveBlocked(key, true);
      return { data: fallback, corrupt: true, corruptBackupKey };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const corruptBackupKey = await backupCorruptRaw(key, raw);
      await setSaveBlocked(key, true);
      return { data: fallback, corrupt: true, corruptBackupKey };
    }

    return { data: { ...fallback, ...(parsed as object) } as T, corrupt: false };
  } catch {
    return { data: fallback, corrupt: false };
  }
}

/** שמירה שמכבדת חסימה אחרי נתון פגום — דורשת force לאישור מפורש */
export async function safeSetJson(
  key: string,
  value: unknown,
  opts?: { force?: boolean }
): Promise<boolean> {
  if (!opts?.force && (await isSaveBlocked(key))) {
    return false;
  }
  await AsyncStorage.setItem(key, JSON.stringify(value));
  if (opts?.force) await setSaveBlocked(key, false);
  return true;
}
