import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k);
    }),
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null])),
    multiSet: vi.fn(async (pairs: [string, string][]) => {
      for (const [k, v] of pairs) store.set(k, v);
    }),
  },
}));

import {
  LEDGER_KEY,
  isLedgerSaveBlocked,
  loadLedger,
  saveLedger,
} from '../ledger';
import { loadRecurring, saveRecurring } from '../recurring';

describe('storage round-trip (coverage)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('ledger load/save', async () => {
    const empty = await loadLedger();
    expect(empty.data).toEqual([]);
    expect(empty.corrupt).toBe(false);

    const entries = [
      {
        id: '1',
        period: '2026-09',
        kind: 'income' as const,
        category: 'משכורת',
        amount: 100,
        note: '',
        createdAt: '2026-09-01T12:00:00.000Z',
      },
    ];
    expect(await saveLedger(entries)).toBe(true);
    expect(store.has(LEDGER_KEY)).toBe(true);
    const loaded = await loadLedger();
    expect(loaded.data).toHaveLength(1);
    expect(await isLedgerSaveBlocked()).toBe(false);
  });

  it('recurring load/save', async () => {
    const empty = await loadRecurring();
    expect(empty.data).toEqual([]);
    const rules = [
      {
        id: 'r1',
        kind: 'tzedaka' as const,
        category: 'צדקה',
        amount: 10,
        note: '',
        dayOfMonth: 1,
        enabled: true,
        createdAt: '2026-09-01T12:00:00.000Z',
      },
    ];
    expect(await saveRecurring(rules)).toBe(true);
    const loaded = await loadRecurring();
    expect(loaded.data).toHaveLength(1);
  });
});
