import { Platform, Share } from 'react-native';
import type { HistoryEntry } from './history';
import type { LedgerEntry } from '../types/ledger';

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadWeb(filename: string, content: string) {
  if (typeof document === 'undefined') return false;
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
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
  const header = [
    'period',
    'label',
    'netBase',
    'obligation',
    'alreadyGiven',
    'remaining',
    'ratePercent',
    'savedAt',
  ].join(',');
  const rows = entries.map((e) =>
    [
      e.period,
      e.label,
      e.result.netBase,
      e.result.obligation,
      e.result.alreadyGiven,
      e.result.remaining,
      e.result.ratePercent,
      e.savedAt,
    ]
      .map(csvEscape)
      .join(',')
  );
  const csv = [header, ...rows].join('\n');
  await shareOrDownload('maaser-history.csv', csv, 'ייצוא היסטוריית מעשר');
}

/** ייצוא פנקס תנועות ל־CSV */
export async function exportLedgerCsv(entries: LedgerEntry[]): Promise<void> {
  const header = ['id', 'period', 'kind', 'category', 'amount', 'note', 'createdAt'].join(',');
  const rows = entries.map((e) =>
    [e.id, e.period, e.kind, e.category, e.amount, e.note ?? '', e.createdAt]
      .map(csvEscape)
      .join(',')
  );
  const csv = [header, ...rows].join('\n');
  await shareOrDownload('maaser-ledger.csv', csv, 'ייצוא פנקס תנועות');
}
