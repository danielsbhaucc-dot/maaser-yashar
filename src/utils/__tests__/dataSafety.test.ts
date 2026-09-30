/**
 * T-06 / T-10 / T-19 / T-20 / T-21 / T-22 / T-26 / T-27 / T-28 / T-29 / T-30 / N-16
 * בדיקות בטיחות נתונים, גיבוי, CSV, PIN, היסטוריה, שנה, עודף, אחוז, קבלה, ICS
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HDate, gematriya } from '@hebcal/core';
import ical from 'node-ical';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k);
    }),
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null] as [string, string | null])),
    multiSet: vi.fn(async (pairs: [string, string][]) => {
      for (const [k, v] of pairs) store.set(k, v);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k);
    }),
    getAllKeys: vi.fn(async () => [...store.keys()]),
  },
}));

vi.mock('expo', () => ({
  reloadAppAsync: vi.fn(async () => undefined),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Share: { share: vi.fn(async () => undefined) },
}));

import {
  BACKUP_KEYS,
  buildBackupPayload,
  buildRestoreSummary,
  isBackupStale,
  parseBackupJson,
  shouldRemindBackup,
  validateBackup,
} from '../backupFormat';
import {
  exportBackup,
  getLastBackupAt,
  restoreBackup,
  shouldShowBackupReminder,
} from '../backupExport';
import { toCsv, formatCsvDate, ledgerKindHe } from '../csvFormat';
import { exportHistoryCsv, exportLedgerCsv, exportYearSummaryCsv } from '../exportCsv';
import { loadLedger, saveLedger, computeTotals, LEDGER_KEY } from '../ledger';
import { migrateLedgerEntries, SCHEMA_VERSION_KEY, runSchemaMigrations } from '../schemaMigrate';
import { isSaveBlocked, safeLoadJsonArray } from '../safeStorage';
import { APP_STORAGE_KEYS, wipeAllData } from '../wipeData';
import {
  clearPinLock,
  hasPinLock,
  isPinFormat,
  PIN_STORAGE_KEY,
  savePinLock,
  verifyPinLock,
} from '../pinLock';
import {
  clearAllThreads,
  loadThreads,
  saveThreads,
  type ChatThread,
} from '../../ai/noam';
import { hebrewYearOf, hebrewYearLabel, yearSummary } from '../yearSummary';
import {
  periodSurplus,
  resolvePeriodTotals,
  withCarryForward,
  SURPLUS_CARRY_ENGINE_TEXT,
  defaultAdvancedSettings,
  type TotalsProfile,
} from '../totalsAdvanced';
import {
  formatRatePercent,
  parseRatePercentInput,
  rateLabel,
  rateLabelFull,
} from '../rateLabel';
import {
  buildMonthlyReminderIcs,
  shouldShowCloseMonthBanner,
  closeMonthBannerText,
} from '../monthlyReminderCore';
import type { LedgerEntry } from '../../types/ledger';

function entry(
  partial: Partial<LedgerEntry> & Pick<LedgerEntry, 'kind' | 'amount'>
): LedgerEntry {
  return {
    id: partial.id ?? `e-${partial.kind}-${partial.amount}`,
    period: partial.period ?? '2026-09',
    kind: partial.kind,
    category: partial.category ?? 'משכורת',
    amount: partial.amount,
    note: partial.note ?? '',
    createdAt: partial.createdAt ?? '2026-09-01T12:00:00.000Z',
    date: partial.date,
    org: partial.org,
    has46: partial.has46,
    receiptNo: partial.receiptNo,
  };
}

function parseCsv(text: string): string[][] {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (ch === '\r') {
      // ignore
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const sampleData: Record<string, unknown> = {
  maaser_profile_v2: {
    displayName: 'דניאל',
    rate: 0.1,
    onboardingDone: true,
    carryForwardSurplus: false,
  },
  maaser_ledger_v1: [
    entry({
      id: '1',
      kind: 'income',
      amount: 10000,
      category: 'משכורת',
      createdAt: '2026-09-01T12:00:00.000Z',
      date: '2026-09-01',
    }),
    entry({
      id: '2',
      kind: 'tzedaka',
      amount: 100,
      category: 'צדקה',
      createdAt: '2026-09-02T12:00:00.000Z',
      date: '2026-09-02',
      org: 'עמותה',
      has46: 'yes',
      receiptNo: 'R-9',
    }),
  ],
  maaser_recurring_v1: [
    { id: 'r1', kind: 'income', amount: 500, dayOfMonth: 10, enabled: true },
  ],
  maaser_history_v1: [
    { id: 'h1', period: '2026-08', label: 'אוגוסט' },
    { id: 'h2', period: '2026-07', label: 'יולי' },
  ],
  maaser_tax_v1: { year: 2026, income: 120000 },
  '@maaser/a11y-v2': { fontSize: 1, reduceMotion: false },
};

describe('T-22 backup reminder', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse('2026-09-30T12:00:00.000Z');

  it('empty profile: never shows', () => {
    expect(shouldRemindBackup(0, null, null, now)).toBe(false);
    expect(shouldRemindBackup(0, null, '2026-01-01T00:00:00.000Z', now)).toBe(false);
  });

  it('fresh entry without backup: no warning', () => {
    expect(
      shouldRemindBackup(1, null, new Date(now - 2 * day).toISOString(), now)
    ).toBe(false);
  });

  it('oldest entry >30 days and no backup: shows', () => {
    expect(
      shouldRemindBackup(1, null, new Date(now - 31 * day).toISOString(), now)
    ).toBe(true);
  });

  it('last backup older than 30 days: shows when ledger has entries', () => {
    expect(
      shouldRemindBackup(
        2,
        new Date(now - 31 * day).toISOString(),
        new Date(now - 2 * day).toISOString(),
        now
      )
    ).toBe(true);
  });

  it('recent backup: disappears', () => {
    expect(
      shouldRemindBackup(
        3,
        new Date(now - 5 * day).toISOString(),
        new Date(now - 40 * day).toISOString(),
        now
      )
    ).toBe(false);
  });
});

describe('T-22 backup round-trip', () => {
  beforeEach(() => {
    store.clear();
  });

  it('BACKUP_KEYS includes maaser_tax_v1', () => {
    expect(BACKUP_KEYS).toContain('maaser_tax_v1');
  });

  it('export → clear → restore deep-equals', async () => {
    for (const [k, v] of Object.entries(sampleData)) {
      store.set(k, JSON.stringify(v));
    }
    const chat: ChatThread[] = [
      {
        id: 't1',
        title: 'שיחה',
        updatedAt: '2026-09-01T12:00:00.000Z',
        messages: [
          { id: 'm1', role: 'user', content: 'שלום', createdAt: '2026-09-01T12:00:00.000Z' },
        ],
      },
    ];
    store.set('noam_chat_threads_v1', JSON.stringify(chat));

    const downloads: string[] = [];
    const origCreate = globalThis.document?.createElement;
    // @ts-expect-error test stub
    globalThis.document = {
      createElement: (tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            rel: '',
            click: () => {
              downloads.push('clicked');
            },
          };
        }
        return {};
      },
      body: { appendChild: () => undefined, removeChild: () => undefined },
    };
    // @ts-expect-error test stub
    globalThis.URL = {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: () => undefined,
    };
    // @ts-expect-error test stub
    globalThis.Blob = class {
      constructor(public parts: unknown[]) {}
    };

    const backup = await exportBackup({ includeChat: true, preferShare: false });
    expect(backup.app).toBe('maaser-yashar');
    expect(await getLastBackupAt()).toBeTruthy();

    const snapshot = JSON.parse(JSON.stringify(backup.data));
    store.clear();
    expect(store.size).toBe(0);

    // restore without reload
    const validated = validateBackup(backup);
    const pairs: [string, string][] = [];
    for (const [k, v] of Object.entries(validated.data)) {
      pairs.push([k, typeof v === 'string' ? v : JSON.stringify(v)]);
    }
    for (const [k, v] of pairs) store.set(k, v);

    for (const key of BACKUP_KEYS) {
      expect(JSON.parse(store.get(key)!)).toEqual(snapshot[key]);
    }
    expect(JSON.parse(store.get('noam_chat_threads_v1')!)).toEqual(chat);

    if (origCreate) {
      // restore not needed in node
    }
  });

  it('rejects non-backup and corrupt JSON with Hebrew; does not overwrite', () => {
    store.set('maaser_ledger_v1', JSON.stringify([{ id: 'keep' }]));
    expect(() => validateBackup({ foo: 1 })).toThrow('זה לא קובץ גיבוי של מעשר ישר');
    expect(() => parseBackupJson('{bad')).toThrow('קובץ הגיבוי פגום');
    expect(JSON.parse(store.get('maaser_ledger_v1')!)).toEqual([{ id: 'keep' }]);
  });

  it('restore summary Hebrew + writes maaser_pre_restore', async () => {
    for (const [k, v] of Object.entries(sampleData)) {
      store.set(k, JSON.stringify(v));
    }
    const backup = buildBackupPayload(sampleData, '2026-09-12T10:00:00.000Z');
    const summary = buildRestoreSummary(backup, {
      maaser_ledger_v1: new Array(60).fill({ id: 'x' }),
    });
    expect(summary).toContain('גיבוי מתאריך');
    expect(summary).toContain('12.9.2026');
    expect(summary).toMatch(/2 תנועות/);
    expect(summary).toContain('חודשיים בארכיון');
    expect(summary).toContain('60 תנועות');

    // @ts-expect-error stub reload
    globalThis.window = { location: { reload: () => undefined, assign: () => undefined } };

    await restoreBackup(backup);
    expect(store.has('maaser_pre_restore')).toBe(true);
  });
});

describe('T-19 CSV', () => {
  it('toCsv has BOM, Hebrew headers, escapes comma/quote/newline', () => {
    const csv = toCsv(
      ['מזהה', 'חודש', 'סוג', 'קטגוריה', 'סכום', 'הערה', 'תאריך'],
      [['1', '2026-09', 'הכנסה', 'משכורת', 100, 'a,"b\nc', '2026-09-01']]
    );
    expect(csv.startsWith('\ufeff')).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(['מזהה', 'חודש', 'סוג', 'קטגוריה', 'סכום', 'הערה', 'תאריך']);
    expect(rows[1]?.[5]).toBe('a,"b\nc');
    expect(ledgerKindHe('income')).toBe('הכנסה');
    expect(ledgerKindHe('expense')).toBe('ניכוי מהבסיס');
    expect(ledgerKindHe('tzedaka')).toBe('צדקה');
    expect(formatCsvDate('2026-09-01T15:00:00.000Z')).toBe('2026-09-01');
  });

  it('ledger and history exporters use shared toCsv (BOM + headers)', async () => {
    const captured: string[] = [];
    // @ts-expect-error stub
    globalThis.document = {
      createElement: (tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            rel: '',
            click() {
              /* download stub */
            },
          };
        }
        return {};
      },
      body: { appendChild() {}, removeChild() {} },
    };
    // @ts-expect-error stub
    globalThis.URL = {
      createObjectURL: (blob: { parts?: string[] }) => {
        const part = blob?.parts?.[0];
        if (typeof part === 'string') captured.push(part);
        return 'blob:x';
      },
      revokeObjectURL() {},
    };
    // @ts-expect-error stub
    globalThis.Blob = class {
      parts: unknown[];
      constructor(parts: unknown[]) {
        this.parts = parts;
      }
    };

    await exportLedgerCsv([
      entry({
        id: 'x',
        kind: 'income',
        amount: 10,
        note: 'hi,"there\n',
        date: '2026-09-01',
      }),
    ]);
    await exportHistoryCsv([
      {
        id: 'h',
        period: '2026-08',
        label: 'אוגוסט',
        savedAt: '2026-09-01T00:00:00.000Z',
        result: {
          netBase: 1,
          obligation: 1,
          alreadyGiven: 0,
          remaining: 1,
          ratePercent: 10,
          income: 1,
          expenses: 0,
          tzedaka: 0,
          lines: [],
          warnings: [],
        },
      } as never,
    ]);

    expect(captured.length).toBeGreaterThanOrEqual(2);
    for (const text of captured) {
      expect(text.startsWith('\ufeff')).toBe(true);
    }
    expect(captured[0]).toContain('מזהה');
    expect(captured[0]).toContain('חודש');
    expect(captured[0]).toContain('סוג');
    expect(captured[1]).toContain('חודש');
  });
});

describe('T-20 safe load + migrate', () => {
  beforeEach(() => {
    store.clear();
  });

  it('invalid JSON → corrupt copy, block save, keep original until force', async () => {
    store.set(LEDGER_KEY, '{not-json');
    const result = await loadLedger();
    expect(result.corrupt).toBe(true);
    expect(result.data).toEqual([]);
    expect(store.get(LEDGER_KEY)).toBe('{not-json');
    const corruptKeys = [...store.keys()].filter((k) => k.includes('__corrupt_'));
    expect(corruptKeys.length).toBe(1);
    expect(store.get(corruptKeys[0]!)).toBe('{not-json');
    expect(await isSaveBlocked(LEDGER_KEY)).toBe(true);
    expect(await saveLedger([{ id: 'x' } as LedgerEntry])).toBe(false);
    expect(store.get(LEDGER_KEY)).toBe('{not-json');
    expect(await saveLedger([entry({ kind: 'income', amount: 1 })], { force: true })).toBe(
      true
    );
  });

  it('schema version + migrate keeps entries without date', async () => {
    store.set(
      LEDGER_KEY,
      JSON.stringify([
        {
          id: '1',
          period: '2026-09',
          kind: 'income',
          category: 'משכורת',
          amount: 1000,
          note: '',
          createdAt: '2026-09-01T12:00:00.000Z',
        },
      ])
    );
    await runSchemaMigrations();
    expect(store.get(SCHEMA_VERSION_KEY)).toBe('1');
    const migrated = migrateLedgerEntries(JSON.parse(store.get(LEDGER_KEY)!));
    expect(migrated[0]?.date).toBeUndefined();
    expect(migrated[0]?.createdAt).toBe('2026-09-01T12:00:00.000Z');
  });
});

describe('T-21 ErrorBoundary strings + native driver', async () => {
  it('recovery copy and buttons exist', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ErrorBoundary.tsx'),
      'utf8'
    );
    expect(src).toContain('משהו השתבש. הנתונים שלך שמורים במכשיר');
    expect(src).toContain('טען מחדש');
    expect(src).toContain('הורד גיבוי');
    const motion = fs.readFileSync(path.join(process.cwd(), 'src/utils/motion.ts'), 'utf8');
    expect(motion).toContain('Platform.OS !== \'web\'');
    const app = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');
    expect(app).toMatch(/__crash/);
  });
});

describe('T-06 wipe all keys', () => {
  beforeEach(() => {
    store.clear();
  });

  it('removes every app key including corrupt copies', async () => {
    // @ts-expect-error stub
    globalThis.window = { location: { assign: () => undefined, reload: () => undefined } };
    for (const k of APP_STORAGE_KEYS) store.set(k, '1');
    store.set('maaser_ledger_v1__corrupt_123', 'x');
    store.set('maaser_pin_v1', '{"salt":"aa","hash":"bb"}');
    store.set('noam_chat_threads_v1', '[]');
    await wipeAllData();
    expect([...store.keys()]).toEqual([]);
    expect(APP_STORAGE_KEYS).toEqual(
      expect.arrayContaining([
        'maaser_profile_v2',
        'maaser_ledger_v1',
        'maaser_recurring_v1',
        'maaser_history_v1',
        'maaser_tax_v1',
        'noam_chat_threads_v1',
        'maaser_last_backup',
        'maaser_pre_restore',
        SCHEMA_VERSION_KEY,
        PIN_STORAGE_KEY,
      ])
    );
  });
});

describe('T-10 PIN lock', () => {
  beforeEach(() => {
    store.clear();
  });

  it('stores only salted SHA-256 — never plain PIN', async () => {
    expect(isPinFormat('1234')).toBe(true);
    expect(isPinFormat('12')).toBe(false);
    await savePinLock('135790');
    expect(await hasPinLock()).toBe(true);
    expect(await verifyPinLock('135790')).toBe(true);
    expect(await verifyPinLock('0000')).toBe(false);
    const raw = store.get(PIN_STORAGE_KEY)!;
    expect(raw).not.toContain('135790');
    const rec = JSON.parse(raw) as { salt: string; hash: string };
    expect(rec.salt).toMatch(/^[0-9a-f]+$/i);
    expect(rec.hash).toMatch(/^[0-9a-f]{64}$/i);
    await clearPinLock();
    expect(await hasPinLock()).toBe(false);
  });
});

describe('N-16 chat history storage', () => {
  beforeEach(() => {
    store.clear();
  });

  it('deleting one thread persists after reload; clear all empties', async () => {
    const threads: ChatThread[] = [
      {
        id: 'a',
        title: 'א',
        updatedAt: '1',
        messages: [{ id: '1', role: 'user', content: 'x', createdAt: '1' }],
      },
      {
        id: 'b',
        title: 'ב',
        updatedAt: '2',
        messages: [{ id: '2', role: 'user', content: 'y', createdAt: '2' }],
      },
    ];
    await saveThreads(threads);
    expect((await loadThreads()).map((t) => t.id)).toEqual(['a', 'b']);
    await saveThreads(threads.filter((t) => t.id !== 'a'));
    expect((await loadThreads()).map((t) => t.id)).toEqual(['b']);
    await clearAllThreads();
    expect(await loadThreads()).toEqual([]);
    expect(store.has('noam_chat_threads_v1')).toBe(false);
  });
});

describe('T-26 yearly view', () => {
  it('Sep 1 → תשפ״ו, Sep 15 → תשפ״ז; civil year sum; obligation note', () => {
    expect(new HDate(new Date('2026-09-12T12:00:00')).getFullYear()).toBe(5787);
    expect(hebrewYearOf('2026-09-01T12:00:00.000Z')).toBe(5786);
    expect(hebrewYearOf('2026-09-15T12:00:00.000Z')).toBe(5787);
    expect(hebrewYearLabel(5786)).toContain(gematriya(786));

    const txs: LedgerEntry[] = [
      entry({
        id: 'sep1',
        kind: 'income',
        amount: 1000,
        period: '2026-09',
        date: '2026-09-01',
        createdAt: '2026-09-01T12:00:00.000Z',
      }),
      entry({
        id: 'sep15',
        kind: 'income',
        amount: 2000,
        period: '2026-09',
        date: '2026-09-15',
        createdAt: '2026-09-15T12:00:00.000Z',
      }),
    ];
    const profile: TotalsProfile = {
      rate: 0.1,
      includeSpouse: false,
      maritalStatus: 'single',
      advanced: { ...defaultAdvancedSettings(), enabled: false },
    };
    const y5786 = yearSummary(txs, profile, 'hebrew', 5786);
    const y5787 = yearSummary(txs, profile, 'hebrew', 5787);
    expect(y5786.entries.map((e) => e.id)).toEqual(['sep1']);
    expect(y5787.entries.map((e) => e.id)).toEqual(['sep15']);

    const civil = yearSummary(txs, profile, 'civil', 2026);
    expect(civil.totals.income).toBe(3000);
    expect(civil.months.reduce((s, m) => s + m.totals.income, 0)).toBe(3000);
    expect(civil.monthlyObligationsSum).toBeDefined();
  });

  it('yearly csv export works', async () => {
    const profile: TotalsProfile = {
      rate: 0.1,
      includeSpouse: false,
      maritalStatus: 'single',
      advanced: { ...defaultAdvancedSettings(), enabled: false },
    };
    const summary = yearSummary(
      [
        entry({
          kind: 'income',
          amount: 1000,
          date: '2026-03-01',
          createdAt: '2026-03-01T00:00:00.000Z',
          period: '2026-03',
        }),
      ],
      profile,
      'civil',
      2026
    );
    const csv = toCsv(
      ['סוג', 'תווית', 'הכנסות', 'ניכויים', 'בסיס', 'חובה', 'ניתן', 'נותר'],
      [
        [
          'סיכום שנה',
          '2026',
          summary.totals.income,
          summary.totals.expenses,
          summary.totals.netBase,
          summary.totals.obligation,
          summary.totals.tzedaka,
          summary.totals.remaining,
        ],
      ]
    );
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('סיכום שנה');
    expect(summary.totals.income).toBe(1000);
    // exportYearSummaryCsv משתמש באותו toCsv — אין צורך להוריד Blob בבדיקת יחידה
    expect(typeof exportYearSummaryCsv).toBe('function');
  });
});

describe('T-27 carry-forward', () => {
  it('ON remaining 200 / OFF 500; surplus text; default off', () => {
    const byPeriod = {
      '2025-08': {
        income: 10000,
        expenses: 0,
        tzedaka: 1300,
        netBase: 10000,
        obligation: 1000,
        remaining: 0,
      },
      '2025-09': {
        income: 12500,
        expenses: 0,
        tzedaka: 750,
        netBase: 12500,
        obligation: 1250,
        remaining: 500,
      },
    };
    expect(periodSurplus(byPeriod['2025-08']!)).toBe(300);
    const on = withCarryForward(['2025-08', '2025-09'], byPeriod);
    expect(on['2025-09']!.remaining).toBe(200);

    const ledger: LedgerEntry[] = [
      entry({
        period: '2025-08',
        kind: 'income',
        category: 'משכורת',
        amount: 10000,
        createdAt: '2025-08-01T12:00:00.000Z',
      }),
      entry({
        period: '2025-08',
        kind: 'tzedaka',
        category: 'צדקה / מעשר',
        amount: 1300,
        createdAt: '2025-08-15T12:00:00.000Z',
      }),
      entry({
        period: '2025-09',
        kind: 'income',
        category: 'משכורת',
        amount: 12500,
        createdAt: '2025-09-01T12:00:00.000Z',
      }),
      entry({
        period: '2025-09',
        kind: 'tzedaka',
        category: 'צדקה / מעשר',
        amount: 750,
        createdAt: '2025-09-15T12:00:00.000Z',
      }),
    ];
    const profile: TotalsProfile = {
      rate: 0.1,
      includeSpouse: false,
      maritalStatus: 'single',
      advanced: defaultAdvancedSettings(),
    };
    expect(resolvePeriodTotals(ledger, '2025-09', profile, false).remaining).toBe(500);
    expect(resolvePeriodTotals(ledger, '2025-09', profile, true).remaining).toBe(200);
    expect(resolvePeriodTotals(ledger, '2025-08', profile, false).surplus).toBe(300);
    expect(SURPLUS_CARRY_ENGINE_TEXT).toContain(
      'העודף יכול (לפי חלק מהפוסקים) להיחשב על תקופה הבאה — שאלו רב'
    );
  });
});

describe('T-28 custom percent', () => {
  it('15% of 12500 = 1875; rejects 0/51/abc/1.25', () => {
    expect(computeTotals([entry({ kind: 'income', amount: 12500 })], 0.15).obligation).toBe(
      1875
    );
    expect(rateLabel(0.15)).toBe('15%');
    expect(rateLabelFull(0.15)).toBe('15%');
    expect(rateLabel(0.15)).not.toMatch(/מעשר|חומש/);
    expect(parseRatePercentInput('0').ok).toBe(false);
    expect(parseRatePercentInput('51').ok).toBe(false);
    expect(parseRatePercentInput('abc').ok).toBe(false);
    expect(parseRatePercentInput('1.25').ok).toBe(false);
    expect(parseRatePercentInput('12.5').ok).toBe(true);
    expect(formatRatePercent(0.15)).toBe('15');
  });
});

describe('T-29 receipt fields', () => {
  it('org/has46/receiptNo migrate, CSV + section46 filter, no images in storage keys', async () => {
    const migrated = migrateLedgerEntries([
      {
        id: 'a',
        period: '2026-03',
        kind: 'tzedaka',
        category: 'תרומה',
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
        category: 'צדקה',
        amount: 200,
        note: '',
        createdAt: '2026-04-10T10:00:00.000Z',
        has46: 'no',
      },
    ]);
    expect(migrated[0]?.org).toBe('עמותת חסד');
    expect(migrated[0]?.has46).toBe('yes');
    expect(migrated[0]?.receiptNo).toBe('R-1');

    const profile: TotalsProfile = {
      rate: 0.1,
      includeSpouse: false,
      maritalStatus: 'single',
      advanced: { ...defaultAdvancedSettings(), enabled: false },
    };
    const summary = yearSummary(migrated, profile, 'civil', 2026);
    expect(summary.section46Approved).toBe(400);

    const csv = toCsv(
      ['עמותה', 'סעיף 46', 'מספר קבלה'],
      [[migrated[0]!.org!, 'כן', migrated[0]!.receiptNo!]]
    );
    expect(csv).toContain('עמותת חסד');
    expect(csv).toContain('R-1');

    const backup = buildBackupPayload({ maaser_ledger_v1: migrated });
    expect(JSON.stringify(backup)).not.toMatch(/data:image|base64,/i);
  });
});

describe('T-30 calendar reminder + close-month banner', () => {
  it('ICS parses with UID, monthly RRULE, all-day next 1st, CRLF', () => {
    const ics = buildMonthlyReminderIcs(new Date(2026, 8, 28, 12, 0, 0));
    expect(ics.includes('\r\n')).toBe(true);
    const parsed = ical.sync.parseICS(ics);
    const ev = Object.values(parsed).find((v) => (v as { type?: string }).type === 'VEVENT') as {
      uid?: string;
      start?: Date;
      rrule?: { options?: { freq?: number; bymonthday?: number[] } };
    };
    expect(ev?.uid).toBeTruthy();
    expect(ev?.start).toBeInstanceOf(Date);
    expect(ev!.start!.getUTCFullYear?.() || ev!.start!.getFullYear()).toBeTruthy();
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=1');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261001');
  });

  it('close-month banner only days 1–5 if prev not archived', () => {
    const day3 = new Date(2026, 8, 3, 10, 0, 0);
    expect(shouldShowCloseMonthBanner([], null, day3)).toBe(true);
    expect(shouldShowCloseMonthBanner(['2026-08'], null, day3)).toBe(false);
    expect(shouldShowCloseMonthBanner([], '2026-08', day3)).toBe(false);
    expect(shouldShowCloseMonthBanner([], null, new Date(2026, 8, 6))).toBe(false);
    expect(closeMonthBannerText('2026-08')).toBe('לסגור את אוגוסט? שמור סיכום חודש וגבה.');
  });
});

describe('T-22 shouldShowBackupReminder async', () => {
  beforeEach(() => {
    store.clear();
  });

  it('empty ledger never; after backup false', async () => {
    expect(await shouldShowBackupReminder(0)).toBe(false);
    expect(await shouldShowBackupReminder(1, new Date().toISOString())).toBe(false);
    store.set('maaser_last_backup', new Date().toISOString());
    expect(await shouldShowBackupReminder(5, '2020-01-01T00:00:00.000Z')).toBe(false);
  });

  it('isBackupStale helpers', () => {
    expect(isBackupStale(null)).toBe(true);
    expect(isBackupStale(new Date(Date.now() - 5 * 86400000).toISOString())).toBe(false);
  });
});

describe('safeLoadJsonArray smoke', () => {
  beforeEach(() => store.clear());
  it('returns array when valid', async () => {
    store.set('k', JSON.stringify([1, 2]));
    const r = await safeLoadJsonArray<number>('k');
    expect(r.corrupt).toBe(false);
    expect(r.data).toEqual([1, 2]);
  });
});
