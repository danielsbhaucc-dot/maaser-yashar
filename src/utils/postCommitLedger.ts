import type { LedgerEntry } from '../types/ledger';

/**
 * מוסיף תנועות שנוצרו פעם אחת לרשימה שלפני האישור.
 * אסור להעביר לכאן ref שכבר כולל את אותן שורות — זה מכפיל את הפנקס.
 */
export function appendEntriesOnce(
  current: readonly LedgerEntry[],
  created: readonly LedgerEntry[]
): LedgerEntry[] {
  if (!created.length) return [...current];
  return [...created, ...current];
}

/**
 * אחרי addEntries, המערך שחזר הוא הפנקס שאחרי הרישום.
 * לא ממזגים אותו עם עותק נוסף של השורות החדשות (גם אם ל-ref יש אותן
 * אחרי useEffect, ובלי תלות ב-id — createEntry מייצר מזהים שונים).
 */
export function selectPostCommitLedger(
  committed: readonly LedgerEntry[]
): LedgerEntry[] {
  return [...committed];
}
