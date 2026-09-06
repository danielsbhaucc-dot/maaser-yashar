import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import {
  A11Y_STORAGE_KEY,
  DEFAULT_A11Y,
  type A11yProfileId,
  type A11ySettings,
  type TextMetric,
} from './types';
import { applyProfile } from './profiles';
import { applyWebAccessibility, hasActiveAdjustments } from './effects';

type A11yContextValue = {
  settings: A11ySettings;
  ready: boolean;
  active: boolean;
  setSetting: <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => void;
  patch: (partial: Partial<A11ySettings>) => void;
  toggle: (key: keyof A11ySettings) => void;
  cycleMetric: (metric: TextMetric, max?: number) => void;
  setProfile: (id: A11yProfileId) => void;
  resetAll: () => void;
  openPanel: () => void;
  closePanel: () => void;
  hideWidget: () => void;
  showWidget: () => void;
  speak: (text: string) => void;
  stopSpeak: () => void;
};

const A11yContext = createContext<A11yContextValue | null>(null);

const META_KEYS = new Set<keyof A11ySettings>([
  'widgetHidden',
  'panelOpen',
  'profile',
]);

function clampLevel(n: number, max = 4) {
  if (n < 0) return 0;
  if (n > max) return 0; // מחזור
  return n;
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_A11Y);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(A11Y_STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<A11ySettings>;
          setSettings({ ...DEFAULT_A11Y, ...parsed, panelOpen: false });
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const { panelOpen: _p, ...persist } = settings;
    AsyncStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(persist)).catch(() => {});
    applyWebAccessibility(settings);
  }, [settings, ready]);

  const patch = useCallback((partial: Partial<A11ySettings>) => {
    setSettings((cur) => {
      const touchesContent = Object.keys(partial).some(
        (k) => !META_KEYS.has(k as keyof A11ySettings)
      );
      return {
        ...cur,
        ...partial,
        profile: partial.profile ?? (touchesContent ? 'none' : cur.profile),
      };
    });
  }, []);

  const setSetting = useCallback(
    <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => {
      setSettings((cur) => ({
        ...cur,
        [key]: value,
        profile:
          key === 'profile'
            ? (value as A11yProfileId)
            : META_KEYS.has(key)
              ? cur.profile
              : 'none',
      }));
    },
    []
  );

  const toggle = useCallback((key: keyof A11ySettings) => {
    setSettings((cur) => {
      const curVal = cur[key];
      if (typeof curVal !== 'boolean') return cur;
      return {
        ...cur,
        [key]: !curVal,
        profile: META_KEYS.has(key) ? cur.profile : 'none',
      };
    });
  }, []);

  const cycleMetric = useCallback((metric: TextMetric, max = 4) => {
    setSettings((cur) => ({
      ...cur,
      [metric]: clampLevel((cur[metric] as number) + 1, max),
      profile: 'none',
    }));
  }, []);

  const setProfile = useCallback((id: A11yProfileId) => {
    setSettings((cur) => applyProfile(cur, id));
  }, []);

  const resetAll = useCallback(() => {
    Speech.stop();
    setSettings((cur) => ({
      ...DEFAULT_A11Y,
      widgetHidden: cur.widgetHidden,
      panelOpen: cur.panelOpen,
    }));
  }, []);

  const openPanel = useCallback(() => {
    setSettings((cur) => ({ ...cur, panelOpen: true, widgetHidden: false }));
  }, []);

  const closePanel = useCallback(() => {
    setSettings((cur) => ({ ...cur, panelOpen: false }));
  }, []);

  const hideWidget = useCallback(() => {
    setSettings((cur) => ({ ...cur, widgetHidden: true, panelOpen: false }));
  }, []);

  const showWidget = useCallback(() => {
    setSettings((cur) => ({ ...cur, widgetHidden: false }));
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!settings.textToSpeech && !text) return;
      Speech.stop();
      Speech.speak(text, { language: 'he-IL', rate: 0.95 });
    },
    [settings.textToSpeech]
  );

  const stopSpeak = useCallback(() => {
    Speech.stop();
  }, []);

  const active = hasActiveAdjustments(settings);

  const value = useMemo<A11yContextValue>(
    () => ({
      settings,
      ready,
      active,
      setSetting,
      patch,
      toggle,
      cycleMetric,
      setProfile,
      resetAll,
      openPanel,
      closePanel,
      hideWidget,
      showWidget,
      speak,
      stopSpeak,
    }),
    [
      settings,
      ready,
      active,
      setSetting,
      patch,
      toggle,
      cycleMetric,
      setProfile,
      resetAll,
      openPanel,
      closePanel,
      hideWidget,
      showWidget,
      speak,
      stopSpeak,
    ]
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error('useA11y must be used within AccessibilityProvider');
  return ctx;
}
