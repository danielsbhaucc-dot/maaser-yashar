import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LedgerEntry, LedgerKind } from '../types/ledger';
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

type AppCtx = {
  ready: boolean;
  profile: UserProfile;
  ledger: LedgerEntry[];
  setProfile: (p: UserProfile) => Promise<void>;
  patchProfile: (partial: Partial<UserProfile>) => Promise<void>;
  addEntry: (data: Omit<LedgerEntry, 'id' | 'createdAt'>) => Promise<void>;
  addEntries: (data: Omit<LedgerEntry, 'id' | 'createdAt'>[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  updateEntry: (id: string, patch: Partial<LedgerEntry>) => Promise<void>;
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
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<LedgerKind>('tzedaka');

  useEffect(() => {
    (async () => {
      const [p, entries] = await Promise.all([loadProfile(), loadLedger()]);
      setProfileState(p);
      setLedger(entries);
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

  const persist = useCallback(async (next: LedgerEntry[]) => {
    setLedger(next);
    await saveLedger(next);
  }, []);

  const addEntry = useCallback(
    async (data: Omit<LedgerEntry, 'id' | 'createdAt'>) => {
      const entry = createEntry(data);
      await persist([entry, ...ledger]);
    },
    [ledger, persist]
  );

  const addEntries = useCallback(
    async (data: Omit<LedgerEntry, 'id' | 'createdAt'>[]) => {
      if (!data.length) return;
      const created = data.map((d) => createEntry(d));
      await persist([...created, ...ledger]);
    },
    [ledger, persist]
  );

  const removeEntry = useCallback(
    async (id: string) => {
      await persist(ledger.filter((e) => e.id !== id));
    },
    [ledger, persist]
  );

  const updateEntry = useCallback(
    async (id: string, patch: Partial<LedgerEntry>) => {
      await persist(ledger.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    [ledger, persist]
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
      setProfile,
      patchProfile,
      addEntry,
      addEntries,
      removeEntry,
      updateEntry,
      addOpen,
      addKind,
      openAdd,
      closeAdd,
    }),
    [
      ready,
      profile,
      ledger,
      setProfile,
      patchProfile,
      addEntry,
      addEntries,
      removeEntry,
      updateEntry,
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
