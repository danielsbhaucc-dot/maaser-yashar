import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LedgerEntry, LedgerKind, Section46Status } from '../types/ledger';

export const SCHEMA_VERSION = 1;
export const SCHEMA_VERSION_KEY = 'maaser_schema_version';

const LEDGER_KEY = 'maaser_ledger_v1';
const KINDS = new Set<LedgerKind>(['income', 'expense', 'tzedaka']);

/**
 * מנרמל רשומות פנקס ישנות (בלי date / ruleId וכו').
 * רשומות בלי date עוברות כמו שהן — הקוד משתמש ב־createdAt כגיבוי.
 */
export function migrateLedgerEntries(raw: unknown[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    if (typeof e.id !== 'string' || !e.id) continue;
    if (typeof e.period !== 'string' || !e.period) continue;
    const kind = e.kind as LedgerKind;
    if (!KINDS.has(kind)) continue;
    const amount = Number(e.amount);
    if (!Number.isFinite(amount)) continue;

    const createdAt =
      typeof e.createdAt === 'string' && e.createdAt
        ? e.createdAt
        : new Date().toISOString();

    const entry: LedgerEntry = {
      id: e.id,
      period: e.period,
      kind,
      category: typeof e.category === 'string' ? e.category : 'אחר',
      amount: Math.max(0, amount),
      note: typeof e.note === 'string' ? e.note : '',
      createdAt,
    };

    if (typeof e.date === 'string' && e.date) entry.date = e.date;
    if (typeof e.ruleId === 'string' && e.ruleId) entry.ruleId = e.ruleId;
    if (typeof e.org === 'string' && e.org.trim()) entry.org = e.org.trim();
    if (e.has46 === 'yes' || e.has46 === 'no' || e.has46 === 'unknown') {
      entry.has46 = e.has46 as Section46Status;
    } else if (e.section46Approved === true || e.hasSection46 === true) {
      entry.has46 = 'yes';
    } else if (e.section46Approved === false || e.hasSection46 === false) {
      entry.has46 = 'no';
    }
    if (typeof e.receiptNo === 'string' && e.receiptNo.trim()) {
      entry.receiptNo = e.receiptNo.trim();
    }
    out.push(entry);
  }
  return out;
}

/** מריץ מיגרציות סכמה בהפעלה — לא דורס נתונים פגומים */
export async function runSchemaMigrations(): Promise<void> {
  let from = 0;
  try {
    const raw = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) from = n;
    }
  } catch {
    from = 0;
  }

  if (from < 1) {
    try {
      const ledgerRaw = await AsyncStorage.getItem(LEDGER_KEY);
      if (ledgerRaw) {
        const parsed = JSON.parse(ledgerRaw) as unknown;
        if (Array.isArray(parsed)) {
          const migrated = migrateLedgerEntries(parsed);
          await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(migrated));
        }
      }
    } catch {
      // JSON פגום — safe-load יטפל; לא דורסים
    }
  }

  await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
}
