/** פורמט גיבוי JSON — לוגיקה טהורה (בלי AsyncStorage / RN) */

export const LAST_BACKUP_KEY = 'maaser_last_backup';
export const PRE_RESTORE_KEY = 'maaser_pre_restore';
export const CHAT_THREADS_KEY = 'noam_chat_threads_v1';

export const BACKUP_KEYS = [
  'maaser_profile_v2',
  'maaser_ledger_v1',
  'maaser_recurring_v1',
  'maaser_history_v1',
  'maaser_tax_v1',
  '@maaser/a11y-v2',
] as const;

export type Backup = {
  app: 'maaser-yashar';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
};

export const BACKUP_REMINDER_DAYS = 30;

export function buildBackupPayload(
  data: Record<string, unknown>,
  exportedAt = new Date().toISOString()
): Backup {
  return {
    app: 'maaser-yashar',
    version: 1,
    exportedAt,
    data,
  };
}

export function validateBackup(raw: unknown): Backup {
  if (!raw || typeof raw !== 'object') {
    throw new Error('זה לא קובץ גיבוי של מעשר ישר');
  }
  const obj = raw as Record<string, unknown>;
  if (
    obj.app !== 'maaser-yashar' ||
    obj.version !== 1 ||
    !obj.data ||
    typeof obj.data !== 'object' ||
    Array.isArray(obj.data)
  ) {
    throw new Error('זה לא קובץ גיבוי של מעשר ישר');
  }
  const data = obj.data as Record<string, unknown>;
  if ('maaser_ledger_v1' in data && data.maaser_ledger_v1 != null) {
    if (!Array.isArray(data.maaser_ledger_v1)) {
      throw new Error('קובץ הגיבוי פגום');
    }
  }
  if (typeof obj.exportedAt !== 'string') {
    throw new Error('זה לא קובץ גיבוי של מעשר ישר');
  }
  return {
    app: 'maaser-yashar',
    version: 1,
    exportedAt: obj.exportedAt,
    data,
  };
}

export function parseBackupJson(text: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('קובץ הגיבוי פגום');
  }
  return validateBackup(parsed);
}

function countLedger(data: Record<string, unknown> | null | undefined): number {
  const ledger = data?.maaser_ledger_v1;
  return Array.isArray(ledger) ? ledger.length : 0;
}

function countHistoryMonths(data: Record<string, unknown> | null | undefined): number {
  const history = data?.maaser_history_v1;
  return Array.isArray(history) ? history.length : 0;
}

/** תאריך עברי־מספרי: 12.9.2026 */
export function formatBackupDateHe(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export function buildRestoreSummary(
  backup: Backup,
  currentData: Record<string, unknown>
): string {
  const backupTx = countLedger(backup.data);
  const archiveMonths = countHistoryMonths(backup.data);
  const currentTx = countLedger(currentData);
  const date = formatBackupDateHe(backup.exportedAt);
  const archivePart =
    archiveMonths > 0
      ? archiveMonths === 1
        ? ', חודש אחד בארכיון'
        : archiveMonths === 2
          ? ', חודשיים בארכיון'
          : `, ${archiveMonths} חודשים בארכיון`
      : '';
  return `גיבוי מתאריך ${date}, ${backupTx} תנועות${archivePart}. להחליף את הנתונים הנוכחיים (${currentTx} תנועות)?`;
}

export function isBackupStale(lastBackupIso: string | null, now = Date.now()): boolean {
  if (!lastBackupIso) return true;
  const t = Date.parse(lastBackupIso);
  if (!Number.isFinite(t)) return true;
  return now - t > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * באנר «עבר יותר מחודש בלי גיבוי»:
 * רק כשיש לפחות תנועה אחת, ו־(גיבוי ישן מ־30 יום, או אין גיבוי והתנועה הוותיקה ביותר מעל 30 יום).
 * פרופיל ריק / נתונים טריים בלי גיבוי — לא מציגים.
 */
export function shouldRemindBackup(
  ledgerLength: number,
  lastBackupIso: string | null,
  oldestEntryIso: string | null | undefined,
  now = Date.now()
): boolean {
  if (ledgerLength <= 0) return false;
  if (lastBackupIso) return isBackupStale(lastBackupIso, now);
  if (!oldestEntryIso) return false;
  return isBackupStale(oldestEntryIso, now);
}

export function parseStored(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function serializeForStorage(value: unknown): string {
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return value;
    }
  }
  return JSON.stringify(value);
}

/** סימולציית round-trip: אובייקטים → JSON storage → parse חזרה */
export function roundTripStorageValue(value: unknown): unknown {
  return parseStored(serializeForStorage(value));
}
