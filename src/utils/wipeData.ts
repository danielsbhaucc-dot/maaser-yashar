import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import { A11Y_STORAGE_KEY } from '../accessibility/types';
import { PIN_STORAGE_KEY } from './pinLock';
import { TAX_STORAGE_KEY } from './taxForm';
import { SCHEMA_VERSION_KEY } from './schemaMigrate';

/** כל מפתחות האחסון של האפליקציה — למחיקה מלאה */
export const APP_STORAGE_KEYS = [
  'maaser_profile_v2',
  'maaser_ledger_v1',
  'maaser_recurring_v1',
  'maaser_history_v1',
  SCHEMA_VERSION_KEY,
  TAX_STORAGE_KEY,
  'noam_chat_threads_v1',
  PIN_STORAGE_KEY,
  A11Y_STORAGE_KEY,
  '@maaser/a11y-v1',
  '__maaser_rtl_reload_v3',
] as const;

/** מוחק את כל נתוני האפליקציה מהמכשיר ומרענן כמו ביקור ראשון */
export async function wipeAllData(): Promise<void> {
  const known = new Set<string>(APP_STORAGE_KEYS);
  try {
    const all = await AsyncStorage.getAllKeys();
    for (const k of all) {
      if (
        known.has(k) ||
        k.startsWith('maaser_') ||
        k.startsWith('@maaser/') ||
        k.includes('__corrupt_') ||
        k.includes('__save_blocked')
      ) {
        known.add(k);
      }
    }
  } catch {
    // fallback לרשימה הקבועה
  }
  await AsyncStorage.multiRemove([...known]);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
    return;
  }
  await reloadAppAsync('wipe-all-data');
}
