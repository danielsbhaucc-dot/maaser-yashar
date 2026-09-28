/**
 * T-28 / T-29 — בדיקות שיעור מותאם + שדות תרומה
 * הרצה: npx --yes tsx src/utils/rateLabel.test.ts
 */
import type { LedgerEntry } from '../types/ledger';
import { computeTotals } from './ledger';
import { migrateLedgerEntries } from './schemaMigrate';
import {
  formatRatePercent,
  parseRatePercentInput,
  rateLabel,
  rateLabelFull,
} from './rateLabel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function section46Sum(entries: LedgerEntry[]): number | null {
  let saw = false;
  let sum = 0;
  for (const e of entries) {
    if (e.kind !== 'tzedaka') continue;
    if (e.has46 !== undefined || e.org !== undefined || e.receiptNo !== undefined) {
      saw = true;
      if (e.has46 === 'yes') sum += Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0;
    }
  }
  return saw ? Math.round(sum * 100) / 100 : null;
}

// T-28 acceptance: 15% of 12,500 → 1,875
{
  const entries: LedgerEntry[] = [
    {
      id: '1',
      period: '2026-01',
      kind: 'income',
      category: 'משכורת',
      amount: 12500,
      note: '',
      createdAt: '2026-01-15T10:00:00.000Z',
      date: '2026-01-15',
    },
  ];
  const t = computeTotals(entries, 0.15);
  assert(t.obligation === 1875, `expected 1875 got ${t.obligation}`);
  assert(rateLabel(0.15) === '15%', `rateLabel 15% got ${rateLabel(0.15)}`);
  assert(rateLabelFull(0.15) === '15%', `rateLabelFull 15%`);
  assert(rateLabel(0.1) === 'מעשר', '10% → מעשר');
  assert(rateLabel(0.2) === 'חומש', '20% → חומש');
  assert(rateLabelFull(0.1) === 'מעשר 10%', 'full 10%');
  assert(formatRatePercent(0.125) === '12.5', 'one decimal');
  const bad = parseRatePercentInput('0');
  assert(!bad.ok, 'reject 0%');
  const bad2 = parseRatePercentInput('51');
  assert(!bad2.ok, 'reject 51%');
  const ok = parseRatePercentInput('15');
  assert(ok.ok && ok.rate === 0.15, 'parse 15');
  console.log('OK: T-28 rateLabel + computeTotals 15%');
}

// T-29 migrate + section 46 sum
{
  const migrated = migrateLedgerEntries([
    {
      id: 'a',
      period: '2026-03',
      kind: 'tzedaka',
      category: 'תרומה למוסד',
      amount: 400,
      note: '',
      createdAt: '2026-03-10T10:00:00.000Z',
      date: '2026-03-10',
      org: 'עמותת חסד',
      has46: 'yes',
      receiptNo: 'R-1',
    },
    {
      id: 'b',
      period: '2026-04',
      kind: 'tzedaka',
      category: 'צדקה / מעשר',
      amount: 200,
      note: '',
      createdAt: '2026-04-10T10:00:00.000Z',
      date: '2026-04-10',
      has46: 'no',
    },
  ]);
  assert(migrated[0]?.org === 'עמותת חסד', 'org preserved');
  assert(migrated[0]?.has46 === 'yes', 'has46 yes');
  assert(migrated[0]?.receiptNo === 'R-1', 'receiptNo');
  assert(section46Sum(migrated) === 400, `46 sum expected 400 got ${section46Sum(migrated)}`);
  console.log('OK: T-29 org/has46/receiptNo migrate + sum');
}

console.log('All T-28 / T-29 checks passed');
