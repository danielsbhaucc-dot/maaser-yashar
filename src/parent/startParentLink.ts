import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import appJson from '../../app.json';
import { pingParent, PARENT_PRODUCT_ID, type Platform as P } from './parentLink';
import { applyManifest, lastManifest, parentKey } from './modules';
import { PARENT_MANIFEST_JWK } from './publicKey';

let started = false;

/**
 * קריאה אחת בעליית האפליקציה. קודם מיישמים את רשימת המודולים האחרונה שנשמרה (עובד בלי רשת),
 * ואחרי 4 שניות פינג ברקע ויישום הרשימה המעודכנת. שקט לגמרי בכשל.
 */
export function startParentLink(): void {
  if (started) return;
  started = true;
  const platform: P = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const origin = platform === 'web' && typeof window !== 'undefined' ? window.location?.origin : null;
  const version = String((appJson as { expo?: { version?: string } }).expo?.version ?? '0.0.0');
  const store = {
    get: (k: string) => AsyncStorage.getItem(k).catch(() => null),
    set: (k: string, v: string) => AsyncStorage.setItem(k, v).catch(() => undefined),
  };
  const sync = async () => { try { await applyManifest(await lastManifest(store, await parentKey(PARENT_MANIFEST_JWK), PARENT_PRODUCT_ID)); } catch { /* keep built-in */ } };
  void sync();
  setTimeout(() => { void parentKey(PARENT_MANIFEST_JWK).then((manifestKey) => pingParent({ platform, version, store, origin, manifestKey })).then((ok) => (ok ? sync() : undefined)); }, 4000);
}
