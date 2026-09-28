/** פורמט CSV משותף — BOM ל־Excel, בריחה של פסיקים/מרכאות */

export function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** בונה CSV עם UTF-8 BOM כדי שאקסל יפתח עברית נכון */
export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  return `\ufeff${lines.join('\n')}`;
}

/** תאריך לייצוא: YYYY-MM-DD */
export function formatCsvDate(isoOrDate: string): string {
  if (!isoOrDate) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(isoOrDate)) return isoOrDate.slice(0, 10);
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const KIND_HE: Record<string, string> = {
  income: 'הכנסה',
  expense: 'ניכוי',
  tzedaka: 'צדקה',
};

export function ledgerKindHe(kind: string): string {
  return KIND_HE[kind] ?? kind;
}
