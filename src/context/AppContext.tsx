import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LedgerEntry, LedgerKind } from '../types/ledger';
import type { RecurringRule } from '../types/recurring';
import {
  defaultProfile,
  loadProfile,
  saveProfile,
  type UserProfile,
} from '../utils/profile';
import {
  createEntry,
  loadLedger,
  saveLedger,
} from '../utils/ledger';
import {
  applyRecurringRules,
  createRecurringRule,
  loadRecurring,
  saveRecurring,
} from '../utils/recurring';

type AppCtx = {
  ready: boolean;
  profile: UserProfile;
  ledger: LedgerEntry[];
  recurring: RecurringRule[];
  setProfile: (p: UserProfile) => Promise<void>;
  patchProfile: (partial: Partial<UserProfile>) => Promise<void>;
  addEntry: (data: Omit<LedgerEntry, 'id' | 'createdAt'>) => Promise<void>;
  addEntries: (data: Omit<LedgerEntry, 'id' | 'createdAt'>[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  updateEntry: (id: string, patch: Partial<LedgerEntry>) => Promise<void>;
  addRecurring: (
    data: Omit<RecurringRule, 'id' | 'createdAt' | 'enabled' | 'lastAppliedPeriod'> & {
      enabled?: boolean;
    }
  ) => Promise<RecurringRule>;
  removeRecurring: (id: string) => Promise<void>;
  toggleRecurring: (id: string, enabled: boolean) => Promise<void>;
  addOpen: boolean;
  addKind: LedgerKind;
  openAdd: (kind?: LedgerKind) => void;
  closeAdd: () => void;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile());
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<LedgerKind>('tzedaka');

  useEffect(() => {
    (async () => {
      const [p, entries, rules] = await Promise.all([
        loadProfile(),
        loadLedger(),
        loadRecurring(),
      ]);
      const applied = applyRecurringRules(rules, entries);
      setProfileState(p);
      setLedger(applied.ledger);
      setRecurring(applied.rules);
      if (
        applied.added > 0 ||
        applied.rules.some((r, i) => r.lastAppliedPeriod !== rules[i]?.lastAppliedPeriod)
      ) {
        await Promise.all([
          saveLedger(applied.ledger),
          saveRecurring(applied.rules),
        ]);
      }
      setReady(true);
    })();
  }, []);

  const setProfile = useCallback(async (p: UserProfile) => {
    setProfileState(p);
    await saveProfile(p);
  }, []);

  const patchProfile = useCallback(
    async (partial: Partial<UserProfile>) => {
      const next = { ...profile, ...partial };
      setProfileState(next);
      await saveProfile(next);
    },
    [profile]
  );

  const persistLedger = useCallback(async (next: LedgerEntry[]) => {
    setLedger(next);
    await saveLedger(next);
  }, []);

  const persistRecurring = useCallback(async (next: RecurringRule[]) => {
    setRecurring(next);
    await saveRecurring(next);
  }, []);

  const addEntry = useCallback(
    async (data: Omit<LedgerEntry, 'id' | 'createdAt'>) => {
      const entry = createEntry(data);
      await persistLedger([entry, ...ledger]);
    },
    [ledger, persistLedger]
  );

  const addEntries = useCallback(
    async (data: Omit<LedgerEntry, 'id' | 'createdAt'>[]) => {
      if (!data.length) return;
      const created = data.map((d) => createEntry(d));
      await persistLedger([...created, ...ledger]);
    },
    [ledger, persistLedger]
  );

  const removeEntry = useCallback(
    async (id: string) => {
      await persistLedger(ledger.filter((e) => e.id !== id));
    },
    [ledger, persistLedger]
  );

  const updateEntry = useCallback(
    async (id: string, patch: Partial<LedgerEntry>) => {
      await persistLedger(ledger.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    [ledger, persistLedger]
  );

  const addRecurring = useCallback(
    async (
      data: Omit<RecurringRule, 'id' | 'createdAt' | 'enabled' | 'lastAppliedPeriod'> & {
        enabled?: boolean;
      }
    ) => {
      const rule = createRecurringRule(data);
      const withRule = [rule, ...recurring];
      const applied = applyRecurringRules(withRule, ledger);
      setRecurring(applied.rules);
      setLedger(applied.ledger);
      await Promise.all([
        saveRecurring(applied.rules),
        saveLedger(applied.ledger),
      ]);
      return rule;
    },
    [recurring, ledger]
  );

  const removeRecurring = useCallback(
    async (id: string) => {
      await persistRecurring(recurring.filter((r) => r.id !== id));
    },
    [recurring, persistRecurring]
  );

  const toggleRecurring = useCallback(
    async (id: string, enabled: boolean) => {
      const next = recurring.map((r) => (r.id === id ? { ...r, enabled } : r));
      if (enabled) {
        const applied = applyRecurringRules(next, ledger);
        setRecurring(applied.rules);
        setLedger(applied.ledger);
        await Promise.all([
          saveRecurring(applied.rules),
          saveLedger(applied.ledger),
        ]);
      } else {
        await persistRecurring(next);
      }
    },
    [recurring, ledger, persistRecurring]
  );

  const openAdd = useCallback((kind: LedgerKind = 'tzedaka') => {
    setAddKind(kind);
    setAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => setAddOpen(false), []);

  const value = useMemo(
    () => ({
      ready,
      profile,
      ledger,
      recurring,
      setProfile,
      patchProfile,
      addEntry,
      addEntries,
      removeEntry,
      updateEntry,
      addRecurring,
      removeRecurring,
      toggleRecurring,
      addOpen,
      addKind,
      openAdd,
      closeAdd,
    }),
    [
      ready,
      profile,
      ledger,
      recurring,
      setProfile,
      patchProfile,
      addEntry,
      addEntries,
      removeEntry,
      updateEntry,
      addRecurring,
      removeRecurring,
      toggleRecurring,
      addOpen,
      addKind,
      openAdd,
      closeAdd,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
