import { Platform, Share } from 'react-native';
import type { HistoryEntry } from './history';
import type { LedgerEntry } from '../types/ledger';
import { formatCsvDate, ledgerKindHe, toCsv } from './csvFormat';

function downloadWeb(filename: string, content: string) {
  if (typeof document === 'undefined') return false;
  // toCsv כבר כולל BOM — לא מוסיפים שוב
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

async function shareOrDownload(filename: string, content: string, title: string) {
  if (Platform.OS === 'web') {
    downloadWeb(filename, content);
    return;
  }
  await Share.share({
    title,
    message: content,
  });
}

/** ייצוא ארכיון חודשים ל־CSV (לרו״ח / גיבוי מקומי) */
export async function exportHistoryCsv(entries: HistoryEntry[]): Promise<void> {
  const headers = [
    'חודש',
    'תווית',
    'בסיס נטו',
    'חובה',
    'כבר ניתן',
    'יתרה',
    'אחוז',
    'תאריך',
  ];
  const rows = entries.map((e) => [
    e.period,
    e.label,
    e.result.netBase,
    e.result.obligation,
    e.result.alreadyGiven,
    e.result.remaining,
    e.result.ratePercent,
    formatCsvDate(e.savedAt),
  ]);
  await shareOrDownload('maaser-history.csv', toCsv(headers, rows), 'ייצוא היסטוריית מעשר');
}

/** ייצוא פנקס תנועות ל־CSV */
export async function exportLedgerCsv(entries: LedgerEntry[]): Promise<void> {
  const headers = ['מזהה', 'חודש', 'סוג', 'קטגוריה', 'סכום', 'הערה', 'תאריך'];
  const rows = entries.map((e) => [
    e.id,
    e.period,
    ledgerKindHe(e.kind),
    e.category,
    e.amount,
    e.note ?? '',
    formatCsvDate(e.date ?? e.createdAt),
  ]);
  await shareOrDownload('maaser-ledger.csv', toCsv(headers, rows), 'ייצוא פנקס תנועות');
}

export { toCsv } from './csvFormat';
