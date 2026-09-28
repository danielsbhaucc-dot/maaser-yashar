import type { LedgerEntry, LedgerTotals } from '../types/ledger';
import type { MaaserRate } from '../types';
import { migrateLedgerEntries } from './schemaMigrate';
import {
  isSaveBlocked,
  safeLoadJsonArray,
  safeSetJson,
  type SafeLoadResult,
} from './safeStorage';

export const LEDGER_KEY = 'maaser_ledger_v1';

export async function loadLedger(): Promise<SafeLoadResult<LedgerEntry[]>> {
  const result = await safeLoadJsonArray<LedgerEntry>(LEDGER_KEY);
  if (result.corrupt) return { ...result, data: [] };
  return { data: migrateLedgerEntries(result.data), corrupt: false };
}

export async function isLedgerSaveBlocked(): Promise<boolean> {
  return isSaveBlocked(LEDGER_KEY);
}

/** @returns false אם נחסם בגלל נתון פגום (בלי force) */
export async function saveLedger(
  entries: LedgerEntry[],
  opts?: { force?: boolean }
): Promise<boolean> {
  return safeSetJson(LEDGER_KEY, entries, opts);
}

function entryTimeKey(e: LedgerEntry): string {
  return e.date ?? e.createdAt;
}

export function entriesForPeriod(entries: LedgerEntry[], period: string): LedgerEntry[] {
  return entries
    .filter((e) => e.period === period)
    .sort((a, b) => (entryTimeKey(a) < entryTimeKey(b) ? 1 : -1));
}

export function computeTotals(
  entries: LedgerEntry[],
  rate: MaaserRate
): LedgerTotals {
  let income = 0;
  let expenses = 0;
  let tzedaka = 0;

  for (const e of entries) {
    const amt = Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0;
    if (e.kind === 'income') income += amt;
    else if (e.kind === 'expense') expenses += amt;
    else if (e.kind === 'tzedaka') tzedaka += amt;
  }

  const netBase = Math.max(0, income - expenses);
  const obligation = Math.round(netBase * rate * 100) / 100;
  const remaining = Math.max(0, Math.round((obligation - tzedaka) * 100) / 100);

  return { income, expenses, tzedaka, netBase, obligation, remaining };
}

export function createEntry(
  partial: Omit<LedgerEntry, 'id' | 'createdAt'>
): LedgerEntry {
  return {
    ...partial,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
}
