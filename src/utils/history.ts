import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MaaserInputs, MaaserResult } from '../types';

const STORAGE_KEY = 'maaser_history_v1';

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

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'savedAt'>
): Promise<HistoryEntry[]> {
  const list = await loadHistory();
  const full: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  // Replace same period if exists, else prepend
  const withoutSame = list.filter((e) => e.period !== entry.period);
  const next = [full, ...withoutSame].slice(0, 60);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const list = await loadHistory();
  const next = list.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function currentPeriod(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

export function formatPeriod(period: string): string {
  const [y, m] = period.split('-');
  const months = [
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
  ];
  const idx = Number(m) - 1;
  return `${months[idx] ?? m} ${y}`;
}
