import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { LedgerEntry, LedgerKind } from '../types/ledger';
import type { RecurringRule } from '../types/recurring';
import {
  defaultProfile,
  loadProfile,
  saveProfile,
  type UserProfile,
} from '../utils/profile';
import { defaultAdvancedSettings } from '../utils/totalsAdvanced';
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
import {
  clearHistory as clearHistoryStorage,
  deleteHistoryEntry,
  loadHistory,
  saveHistoryEntry,
  type HistoryEntry,
} from '../utils/history';
import { runSchemaMigrations } from '../utils/schemaMigrate';

type NewHistoryEntry = Omit<HistoryEntry, 'id' | 'savedAt'>;

export type CorruptStore = 'ledger' | 'profile' | 'recurring' | 'history';

type AppCtx = {
  ready: boolean;
  profile: UserProfile;
  ledger: LedgerEntry[];
  recurring: RecurringRule[];
  history: HistoryEntry[];
  /** מאגרי אחסון שזוהו כפגומים בטעינה */
  corrupt: Partial<Record<CorruptStore, boolean>>;
  /** מאשר דריסה מפורשת אחרי נתון פגום */
  acknowledgeCorrupt: (store?: CorruptStore) => Promise<void>;
  setProfile: (p: UserProfile) => Promise<void>;
  patchProfile: (partial: Partial<UserProfile>) => Promise<void>;
  addEntry: (data: Omit<LedgerEntry, 'id' | 'createdAt'>) => Promise<void>;
  addEntries: (data: Omit<LedgerEntry, 'id' | 'createdAt'>[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  updateEntry: (id: string, patch: Partial<LedgerEntry>) => Promise<void>;
  addRecurring: (
    data: Omit<RecurringRule, 'id' | 'createdAt' | 'enabled'> & {
      enabled?: boolean;
      lastAppliedPeriod?: string;
    }
  ) => Promise<RecurringRule>;
  removeRecurring: (id: string) => Promise<void>;
  toggleRecurring: (id: string, enabled: boolean) => Promise<void>;
  saveMonth: (entry: NewHistoryEntry) => Promise<void>;
  deleteMonth: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  addOpen: boolean;
  addKind: LedgerKind;
  addPeriod: string | null;
  editingEntry: LedgerEntry | null;
  openAdd: (kind?: LedgerKind, period?: string) => void;
  openEdit: (entry: LedgerEntry) => void;
  closeAdd: () => void;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile());
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [corrupt, setCorrupt] = useState<Partial<Record<CorruptStore, boolean>>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<LedgerKind>('tzedaka');
  const [addPeriod, setAddPeriod] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);

  useEffect(() => {
    (async () => {
      await runSchemaMigrations();

      const [pRes, ledgerRes, rulesRes, histRes] = await Promise.all([
        loadProfile(),
        loadLedger(),
        loadRecurring(),
        loadHistory(),
      ]);

      const nextCorrupt: Partial<Record<CorruptStore, boolean>> = {};
      if (pRes.corrupt) nextCorrupt.profile = true;
      if (ledgerRes.corrupt) nextCorrupt.ledger = true;
      if (rulesRes.corrupt) nextCorrupt.recurring = true;
      if (histRes.corrupt) nextCorrupt.history = true;
      setCorrupt(nextCorrupt);

      setProfileState(pRes.data);
      setHistory(histRes.data);

      const canMutateDisk = !ledgerRes.corrupt && !rulesRes.corrupt;
      if (canMutateDisk) {
        const applied = applyRecurringRules(rulesRes.data, ledgerRes.data);
        setLedger(applied.ledger);
        setRecurring(applied.rules);
        if (
          applied.added > 0 ||
          applied.rules.some(
            (r, i) => r.lastAppliedPeriod !== rulesRes.data[i]?.lastAppliedPeriod
          )
        ) {
          await Promise.all([
            saveLedger(applied.ledger),
            saveRecurring(applied.rules),
          ]);
        }
      } else {
        setLedger(ledgerRes.data);
        setRecurring(rulesRes.data);
      }

      setReady(true);
    })();
  }, []);

  const acknowledgeCorrupt = useCallback(
    async (store?: CorruptStore) => {
      const targets: CorruptStore[] = store
        ? [store]
        : (Object.keys(corrupt).filter((k) => corrupt[k as CorruptStore]) as CorruptStore[]);

      for (const t of targets) {
        if (t === 'ledger') await saveLedger(ledger, { force: true });
        if (t === 'recurring') await saveRecurring(recurring, { force: true });
        if (t === 'profile') await saveProfile(profile, { force: true });
        if (t === 'history') await clearHistoryStorage({ force: true });
      }

      setCorrupt((prev) => {
        const next = { ...prev };
        for (const t of targets) delete next[t];
        return next;
      });
    },
    [corrupt, ledger, recurring, profile]
  );

  const setProfile = useCallback(
    async (p: UserProfile) => {
      setProfileState(p);
      const force = !!corrupt.profile;
      await saveProfile(p, force ? { force: true } : undefined);
      if (force) {
        setCorrupt((prev) => {
          const next = { ...prev };
          delete next.profile;
          return next;
        });
      }
    },
    [corrupt.profile]
  );

  const patchProfile = useCallback(
    async (partial: Partial<UserProfile>) => {
      const next: UserProfile = {
        ...profile,
        ...partial,
        advanced: {
          ...defaultAdvancedSettings(),
          ...(profile.advanced ?? {}),
          ...(partial.advanced ?? {}),
        },
      };
      setProfileState(next);
      const force = !!corrupt.profile;
      await saveProfile(next, force ? { force: true } : undefined);
      if (force) {
        setCorrupt((prev) => {
          const n = { ...prev };
          delete n.profile;
          return n;
        });
      }
    },
    [profile, corrupt.profile]
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
      data: Omit<RecurringRule, 'id' | 'createdAt' | 'enabled'> & {
        enabled?: boolean;
        lastAppliedPeriod?: string;
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

  const saveMonth = useCallback(async (entry: NewHistoryEntry) => {
    setHistory(await saveHistoryEntry(entry));
  }, []);

  const deleteMonth = useCallback(async (id: string) => {
    setHistory(await deleteHistoryEntry(id));
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory(await clearHistoryStorage());
  }, []);

  const openAdd = useCallback((kind: LedgerKind = 'tzedaka', period?: string) => {
    setEditingEntry(null);
    setAddKind(kind);
    setAddPeriod(period ?? null);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((entry: LedgerEntry) => {
    setEditingEntry(entry);
    setAddKind(entry.kind);
    setAddPeriod(entry.period);
    setAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setAddPeriod(null);
    setEditingEntry(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      profile,
      ledger,
      recurring,
      history,
      corrupt,
      acknowledgeCorrupt,
      setProfile,
      patchProfile,
      addEntry,
      addEntries,
      removeEntry,
      updateEntry,
      addRecurring,
      removeRecurring,
      toggleRecurring,
      saveMonth,
      deleteMonth,
      clearHistory,
      addOpen,
      addKind,
      addPeriod,
      editingEntry,
      openAdd,
      openEdit,
      closeAdd,
    }),
    [
      ready,
      profile,
      ledger,
      recurring,
      history,
      corrupt,
      acknowledgeCorrupt,
      setProfile,
      patchProfile,
      addEntry,
      addEntries,
      removeEntry,
      updateEntry,
      addRecurring,
      removeRecurring,
      toggleRecurring,
      saveMonth,
      deleteMonth,
      clearHistory,
      addOpen,
      addKind,
      addPeriod,
      editingEntry,
      openAdd,
      openEdit,
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
