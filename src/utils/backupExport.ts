import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';
import { A11Y_STORAGE_KEY } from '../accessibility/types';
import { SCHEMA_VERSION_KEY } from './schemaMigrate';
import { TAX_STORAGE_KEY } from './taxForm';

const BACKUP_KEYS = [
  'maaser_profile_v2',
  'maaser_ledger_v1',
  'maaser_recurring_v1',
  'maaser_history_v1',
  TAX_STORAGE_KEY,
  'noam_chat_threads_v1',
  SCHEMA_VERSION_KEY,
  A11Y_STORAGE_KEY,
] as const;

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

/** גיבוי JSON של מפתחות קריטיים (למסך שגיאה / חירום) */
export async function exportDeviceBackupJson(): Promise<void> {
  const pairs = await AsyncStorage.multiGet([...BACKUP_KEYS]);
  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    keys: {},
  };
  const keys: Record<string, unknown> = {};
  for (const [k, v] of pairs) {
    if (v == null) continue;
    try {
      keys[k] = JSON.parse(v);
    } catch {
      keys[k] = v;
    }
  }
  // גם גיבויי corrupt_* אם קיימים
  try {
    const all = await AsyncStorage.getAllKeys();
    const corrupt = all.filter((k) => k.includes('__corrupt_'));
    if (corrupt.length) {
      const cp = await AsyncStorage.multiGet(corrupt);
      for (const [k, v] of cp) {
        if (v != null) keys[k] = v;
      }
    }
  } catch {
    // ignore
  }
  payload.keys = keys;
  const content = JSON.stringify(payload, null, 2);
  const filename = `maaser-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === 'web') {
    downloadWeb(filename, content, 'application/json;charset=utf-8');
    return;
  }
  await Share.share({
    title: 'גיבוי מעשר ישר',
    message: content,
  });
}
