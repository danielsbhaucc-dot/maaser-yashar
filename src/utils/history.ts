import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MaaserInputs, MaaserResult } from '../types';
import {
  safeLoadJsonArray,
  safeSetJson,
  type SafeLoadResult,
} from './safeStorage';

export const HISTORY_KEY = 'maaser_history_v1';

export interface HistoryEntry {
  id: string;
  /** YYYY-MM */
  period: string;
  label: string;
  savedAt: string;
  inputs: MaaserInputs;
  result: Pick<
    MaaserResult,
    'netBase' | 'obligation' | 'alreadyGiven' | 'remaining' | 'ratePercent'
  >;
  note?: string;
}

export async function loadHistory(): Promise<SafeLoadResult<HistoryEntry[]>> {
  return safeLoadJsonArray<HistoryEntry>(HISTORY_KEY);
}

export async function saveHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'savedAt'>,
  opts?: { force?: boolean }
): Promise<HistoryEntry[]> {
  const { data: list, corrupt } = await loadHistory();
  if (corrupt && !opts?.force) return list;
  const full: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  // Replace same period if exists, else prepend
  const withoutSame = list.filter((e) => e.period !== entry.period);
  const next = [full, ...withoutSame].slice(0, 60);
  const ok = await safeSetJson(HISTORY_KEY, next, opts);
  return ok ? next : list;
}

export async function deleteHistoryEntry(
  id: string,
  opts?: { force?: boolean }
): Promise<HistoryEntry[]> {
  const { data: list, corrupt } = await loadHistory();
  if (corrupt && !opts?.force) return list;
  const next = list.filter((e) => e.id !== id);
  const ok = await safeSetJson(HISTORY_KEY, next, opts);
  return ok ? next : list;
}

export function currentPeriod(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

const MONTH_NAMES = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const;

export function formatPeriod(period: string): string {
  const [y, m] = period.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_NAMES[idx] ?? m} ${y}`;
}

/** תאריך ברירת מחדל לחודש יעד: היום בחודש, או היום האחרון אם החודש קצר יותר */
export function defaultDateFor(period: string, now = new Date()): string {
  const [ys, ms] = period.split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return now.toISOString().slice(0, 10);
  }
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(now.getDate(), lastDay);
  const local = new Date(y, m - 1, day, 12, 0, 0, 0);
  const yy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, '0');
  const dd = String(local.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** 12 החודשים האחרונים כולל הנוכחי (YYYY-MM), מהחדש לישן */
export function lastNPeriods(n = 12, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export async function clearHistory(opts?: { force?: boolean }): Promise<HistoryEntry[]> {
  const ok = await safeSetJson(HISTORY_KEY, [], opts);
  if (!ok) return (await loadHistory()).data;
  await AsyncStorage.removeItem(HISTORY_KEY);
  return [];
}
