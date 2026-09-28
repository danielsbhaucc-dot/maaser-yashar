import { Platform, Share } from 'react-native';
import type { HistoryEntry } from './history';
import type { LedgerEntry } from '../types/ledger';
import { formatCsvDate, ledgerKindHe, toCsv } from './csvFormat';
import type { YearMode, YearSummaryResult } from './yearSummary';
import { yearLabel } from './yearSummary';

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

/** ייצוא סיכום שנתי ל־CSV */
export async function exportYearSummaryCsv(
  summary: YearSummaryResult,
  opts: { mode: YearMode; year: number }
): Promise<void> {
  const label = yearLabel(opts.mode, opts.year);
  const modeHe = opts.mode === 'hebrew' ? 'עברית' : 'אזרחית';
  const headers = [
    'סוג',
    'תווית',
    'הכנסות',
    'ניכויים',
    'בסיס',
    'חובה',
    'ניתן',
    'נותר',
  ];
  const rows: Array<Array<string | number>> = [
    [
      'סיכום שנה',
      `${label} (${modeHe})`,
      summary.totals.income,
      summary.totals.expenses,
      summary.totals.netBase,
      summary.totals.obligation,
      summary.totals.tzedaka,
      summary.totals.remaining,
    ],
    ...summary.months.map((m) => [
      'חודש',
      m.label,
      m.totals.income,
      m.totals.expenses,
      m.totals.netBase,
      m.totals.obligation,
      m.totals.tzedaka,
      m.totals.remaining,
    ]),
  ];
  if (summary.section46Approved != null) {
    rows.push([
      'סעיף 46',
      'תרומות עם אישור',
      '',
      '',
      '',
      '',
      summary.section46Approved,
      '',
    ]);
  }
  const filename =
    opts.mode === 'hebrew'
      ? `maaser-year-he-${opts.year}.csv`
      : `maaser-year-${opts.year}.csv`;
  await shareOrDownload(filename, toCsv(headers, rows), `ייצוא סיכום ${label}`);
}

/** הדפסת סיכום שנתי (web: חלון הדפסה; נייטיב: שיתוף טקסט) */
export async function printYearSummary(
  summary: YearSummaryResult,
  opts: { mode: YearMode; year: number }
): Promise<void> {
  const label = yearLabel(opts.mode, opts.year);
  const modeHe = opts.mode === 'hebrew' ? 'עברית' : 'אזרחית';
  const t = summary.totals;
  const lines = [
    `סיכום מעשר — ${label} (${modeHe})`,
    `הכנסות: ${t.income}`,
    `ניכויים: ${t.expenses}`,
    `בסיס: ${t.netBase}`,
    `חובה: ${t.obligation}`,
    `ניתן: ${t.tzedaka}`,
    `נותר: ${t.remaining}`,
    `סכום חובות חודשיות: ${summary.monthlyObligationsSum}`,
    '',
    ...summary.months.map(
      (m) =>
        `${m.label}: בסיס ${m.totals.netBase} · חובה ${m.totals.obligation} · ניתן ${m.totals.tzedaka} · נותר ${m.totals.remaining}`
    ),
  ];
  if (summary.section46Approved != null) {
    lines.splice(7, 0, `תרומות עם אישור 46: ${summary.section46Approved}`);
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"/><title>${label}</title>
<style>
body{font-family:Heebo,Arial,sans-serif;padding:24px;color:#111;background:#fff}
h1{font-size:20px;margin:0 0 12px}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
th,td{border:1px solid #ccc;padding:8px;text-align:right}
th{background:#f5f5f5}
.note{margin-top:16px;font-size:12px;color:#444}
</style></head><body>
<h1>סיכום מעשר — ${label} (${modeHe})</h1>
<p>הכנסות: ${t.income} · ניכויים: ${t.expenses} · בסיס: ${t.netBase}</p>
<p>חובה: ${t.obligation} · ניתן: ${t.tzedaka} · נותר: ${t.remaining}</p>
${
  summary.section46Approved != null
    ? `<p>תרומות עם אישור 46: ${summary.section46Approved}</p>`
    : ''
}
<p class="note">חובת השנה המחושבת יחד עלולה להיבדל מסכום החובות החודשיות (${summary.monthlyObligationsSum}) בגלל עודפים/חוסרים חודשיים.</p>
<table><thead><tr><th>חודש</th><th>בסיס</th><th>חובה</th><th>ניתן</th><th>נותר</th></tr></thead>
<tbody>${summary.months
      .map(
        (m) =>
          `<tr><td>${m.label}</td><td>${m.totals.netBase}</td><td>${m.totals.obligation}</td><td>${m.totals.tzedaka}</td><td>${m.totals.remaining}</td></tr>`
      )
      .join('')}</tbody></table>
</body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        try {
          w.print();
        } catch {
          /* ignore */
        }
      }, 250);
      return;
    }
  }

  await Share.share({
    title: `סיכום ${label}`,
    message: lines.join('\n'),
  });
}

export { toCsv } from './csvFormat';
