import { useSyncExternalStore } from 'react';
import { installedModules, subscribeModules } from './modules';

/** true כשהמודול מספריית חברת האם מותקן כרגע (למשל 'a11y' → מסתירים את הכפתור המובנה). */
export function useParentModule(id: string): boolean {
  return useSyncExternalStore(subscribeModules, () => installedModules().has(id), () => false);
}
