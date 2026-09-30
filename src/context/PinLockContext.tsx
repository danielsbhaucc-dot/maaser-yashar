import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import {
  PIN_BACKGROUND_LOCK_MS,
  clearPinLock,
  hasPinLock,
  savePinLock,
  verifyPinLock,
} from '../utils/pinLock';

export type PinAttempt = 'ok' | 'format' | 'mismatch' | 'wrong' | 'unavailable' | 'delayed';

/** השהייה אחרי 5 ניסיונות שגויים (מ״ש) */
export const PIN_LOCKOUT_MS = 15_000;

type PinLockValue = {
  ready: boolean;
  enabled: boolean;
  locked: boolean;
  unlock: (pin: string) => Promise<PinAttempt>;
  enable: (pin: string, confirm: string) => Promise<PinAttempt>;
  change: (current: string, next: string, confirm: string) => Promise<PinAttempt>;
  disable: (current: string) => Promise<PinAttempt>;
};

const PinLockContext = createContext<PinLockValue | null>(null);

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const failCount = useRef(0);
  const lockUntil = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const on = await hasPinLock();
      if (cancelled) return;
      setEnabled(on);
      setLocked(on);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const markHidden = () => {
      if (hiddenAt.current == null) hiddenAt.current = Date.now();
    };
    const markVisible = () => {
      const started = hiddenAt.current;
      hiddenAt.current = null;
      if (started != null && Date.now() - started >= PIN_BACKGROUND_LOCK_MS) {
        setLocked(true);
      }
    };

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') markVisible();
      else markHidden();
    };
    const sub = AppState.addEventListener('change', onAppState);

    const onVis = () => {
      if (document.visibilityState === 'hidden') markHidden();
      else markVisible();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      sub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [enabled]);

  const unlock = async (pin: string): Promise<PinAttempt> => {
    if (!/^\d{4,6}$/.test(pin)) return 'format';
    const waitMs = lockUntil.current - Date.now();
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, Math.min(waitMs, PIN_LOCKOUT_MS)));
      if (Date.now() < lockUntil.current) return 'delayed';
    }
    const ok = await verifyPinLock(pin);
    if (!ok) {
      failCount.current += 1;
      if (failCount.current >= 5) {
        failCount.current = 0;
        lockUntil.current = Date.now() + PIN_LOCKOUT_MS;
        await new Promise((r) => setTimeout(r, PIN_LOCKOUT_MS));
        return 'delayed';
      }
      return 'wrong';
    }
    failCount.current = 0;
    lockUntil.current = 0;
    setLocked(false);
    return 'ok';
  };

  const enable = async (pin: string, confirm: string): Promise<PinAttempt> => {
    if (!/^\d{4,6}$/.test(pin)) return 'format';
    if (pin !== confirm) return 'mismatch';
    try {
      await savePinLock(pin);
    } catch {
      return 'unavailable';
    }
    setEnabled(true);
    setLocked(false);
    return 'ok';
  };

  const change = async (current: string, next: string, confirm: string): Promise<PinAttempt> => {
    if (!/^\d{4,6}$/.test(next)) return 'format';
    if (next !== confirm) return 'mismatch';
    const ok = await verifyPinLock(current);
    if (!ok) return 'wrong';
    try {
      await savePinLock(next);
    } catch {
      return 'unavailable';
    }
    return 'ok';
  };

  const disable = async (current: string): Promise<PinAttempt> => {
    const ok = await verifyPinLock(current);
    if (!ok) return 'wrong';
    await clearPinLock();
    setEnabled(false);
    setLocked(false);
    return 'ok';
  };

  const value: PinLockValue = { ready, enabled, locked, unlock, enable, change, disable };

  return <PinLockContext.Provider value={value}>{children}</PinLockContext.Provider>;
}

export function usePinLock(): PinLockValue {
  const ctx = useContext(PinLockContext);
  if (!ctx) throw new Error('usePinLock outside provider');
  return ctx;
}
