import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LedgerEntry, LedgerKind } from '../types/ledger';
import type { RecurringRule } from '../types/recurring';
import { currentPeriod } from './history';

const KEY = 'maaser_recurring_v1';

export async function loadRecurring(): Promise<RecurringRule[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecurringRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRecurring(rules: RecurringRule[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(rules));
}

export function createRecurringRule(
  data: Omit<RecurringRule, 'id' | 'createdAt' | 'enabled' | 'lastAppliedPeriod'> & {
    enabled?: boolean;
  }
): RecurringRule {
  const day = Math.max(1, Math.min(28, Math.round(data.dayOfMonth) || 1));
  return {
    kind: data.kind,
    category: data.category,
    amount: data.amount,
    note: data.note,
    dayOfMonth: day,
    enabled: data.enabled !== false,
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

function periodKey(y: number, m0: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}`;
}

function parsePeriod(p: string): { y: number; m0: number } | null {
  const [ys, ms] = p.split('-');
  const y = Number(ys);
  const m0 = Number(ms) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m0) || m0 < 0 || m0 > 11) return null;
  return { y, m0 };
}

function nextPeriodAfter(p: string): string {
  const parsed = parsePeriod(p);
  if (!parsed) return currentPeriod();
  let { y, m0 } = parsed;
  m0 += 1;
  if (m0 > 11) {
    m0 = 0;
    y += 1;
  }
  return periodKey(y, m0);
}

function monthsInclusive(from: string, to: string): string[] {
  const a = parsePeriod(from);
  const b = parsePeriod(to);
  if (!a || !b) return [];
  const out: string[] = [];
  let y = a.y;
  let m0 = a.m0;
  while (y < b.y || (y === b.y && m0 <= b.m0)) {
    out.push(periodKey(y, m0));
    m0 += 1;
    if (m0 > 11) {
      m0 = 0;
      y += 1;
    }
    if (out.length > 36) break;
  }
  return out;
}

function shouldApplyInPeriod(rule: RecurringRule, period: string, now: Date): boolean {
  const cur = currentPeriod();
  if (period < cur) return true;
  if (period > cur) return false;
  return now.getDate() >= rule.dayOfMonth;
}

function entryDateISO(period: string, day: number): string {
  const p = parsePeriod(period);
  if (!p) return new Date().toISOString();
  return new Date(p.y, p.m0, day, 12, 0, 0, 0).toISOString();
}

function makeEntry(rule: RecurringRule, period: string): LedgerEntry {
  const noteParts = [
    rule.note.trim(),
    `הוראת קבע · כל ${rule.dayOfMonth} בחודש`,
    `#${rule.id}`,
  ].filter(Boolean);
  return {
    id: `${rule.id}-${period}`,
    period,
    kind: rule.kind,
    category: rule.category,
    amount: rule.amount,
    note: noteParts.join(' · '),
    createdAt: entryDateISO(period, rule.dayOfMonth),
  };
}

/**
 * מייצר תנועות חסרות להוראות קבע ומעדכן lastAppliedPeriod.
 */
export function applyRecurringRules(
  rules: RecurringRule[],
  ledger: LedgerEntry[],
  now = new Date()
): { rules: RecurringRule[]; ledger: LedgerEntry[]; added: number } {
  const cur = currentPeriod();
  const nextLedger = [...ledger];
  let added = 0;

  const nextRules = rules.map((rule) => {
    if (!rule.enabled || !(rule.amount > 0)) return rule;

    const createdPeriod = rule.createdAt.slice(0, 7);
    const start = rule.lastAppliedPeriod
      ? nextPeriodAfter(rule.lastAppliedPeriod)
      : parsePeriod(createdPeriod)
        ? createdPeriod
        : cur;

    if (start > cur) return rule;

    let lastApplied = rule.lastAppliedPeriod;
    for (const period of monthsInclusive(start, cur)) {
      if (!shouldApplyInPeriod(rule, period, now)) continue;

      const exists = nextLedger.some((e) => e.id === `${rule.id}-${period}`);
      if (!exists) {
        nextLedger.unshift(makeEntry(rule, period));
        added += 1;
      }
      lastApplied = period;
    }

    if (lastApplied === rule.lastAppliedPeriod) return rule;
    return { ...rule, lastAppliedPeriod: lastApplied };
  });

  return { rules: nextRules, ledger: nextLedger, added };
}

export function kindLabel(kind: LedgerKind): string {
  if (kind === 'income') return 'הכנסה';
  if (kind === 'expense') return 'הוצאה';
  return 'צדקה';
}
