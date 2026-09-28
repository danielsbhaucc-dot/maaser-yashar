/**
 * בדיקת round-trip לגיבוי / שחזור JSON — להרצה:
 *   npx --yes tsx src/utils/backupExport.test.ts
 */
import {
  BACKUP_KEYS,
  buildBackupPayload,
  buildRestoreSummary,
  formatBackupDateHe,
  isBackupStale,
  parseBackupJson,
  roundTripStorageValue,
  validateBackup,
} from './backupFormat';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const sampleData: Record<string, unknown> = {
    maaser_profile_v2: { displayName: 'מיכאל', rate: 0.1, onboardingDone: true },
    maaser_ledger_v1: [
      {
        id: '1',
        period: '2026-09',
        kind: 'income',
        category: 'משכורת',
        amount: 10000,
        note: '',
        createdAt: '2026-09-01T12:00:00.000Z',
      },
      {
        id: '2',
        period: '2026-09',
        kind: 'tzedaka',
        category: 'צדקה',
        amount: 100,
        note: '',
        createdAt: '2026-09-02T12:00:00.000Z',
      },
    ],
    maaser_recurring_v1: [
      { id: 'r1', kind: 'income', amount: 500, dayOfMonth: 10, enabled: true },
    ],
    maaser_history_v1: [
      { id: 'h1', period: '2026-08', label: 'אוגוסט' },
      { id: 'h2', period: '2026-07', label: 'יולי' },
      { id: 'h3', period: '2026-06', label: 'יוני' },
      { id: 'h4', period: '2026-05', label: 'מאי' },
      { id: 'h5', period: '2026-04', label: 'אפריל' },
      { id: 'h6', period: '2026-03', label: 'מרץ' },
    ],
    maaser_tax_v1: { year: 2026, income: 120000 },
    '@maaser/a11y-v2': { fontSize: 1, reduceMotion: false },
  };

  const backup = buildBackupPayload(sampleData, '2026-09-12T10:00:00.000Z');
  assert(backup.app === 'maaser-yashar', 'app tag');
  assert(backup.version === 1, 'version');
  assert(backup.exportedAt === '2026-09-12T10:00:00.000Z', 'exportedAt');

  const json = JSON.stringify(backup);
  const roundTrip = parseBackupJson(json);
  assert(roundTrip.app === 'maaser-yashar', 'parse app');
  assert(Array.isArray(roundTrip.data.maaser_ledger_v1), 'ledger array');
  assert(
    (roundTrip.data.maaser_ledger_v1 as unknown[]).length === 2,
    'ledger length'
  );

  for (const key of BACKUP_KEYS) {
    assert(key in sampleData, `sample covers ${key}`);
    const restored = roundTripStorageValue(sampleData[key]);
    assert(
      JSON.stringify(restored) === JSON.stringify(sampleData[key]),
      `storage round-trip ${key}`
    );
    assert(
      JSON.stringify(roundTrip.data[key]) === JSON.stringify(sampleData[key]),
      `backup round-trip ${key}`
    );
  }

  // invalid file
  let threw = false;
  try {
    validateBackup({ app: 'other', version: 1, exportedAt: 'x', data: {} });
  } catch (e) {
    threw = true;
    assert(
      e instanceof Error && e.message === 'זה לא קובץ גיבוי של מעשר ישר',
      'hebrew invalid msg'
    );
  }
  assert(threw, 'invalid app rejected');

  threw = false;
  try {
    validateBackup({
      app: 'maaser-yashar',
      version: 1,
      exportedAt: '2026-09-12T10:00:00.000Z',
      data: { maaser_ledger_v1: { not: 'array' } },
    });
  } catch (e) {
    threw = true;
    assert(
      e instanceof Error && e.message === 'קובץ הגיבוי פגום',
      'hebrew corrupt msg'
    );
  }
  assert(threw, 'corrupt ledger rejected');

  threw = false;
  try {
    parseBackupJson('{not json');
  } catch (e) {
    threw = true;
    assert(
      e instanceof Error && e.message === 'קובץ הגיבוי פגום',
      'bad json msg'
    );
  }
  assert(threw, 'bad json rejected');

  const summary = buildRestoreSummary(backup, {
    maaser_ledger_v1: new Array(60).fill({ id: 'x' }),
  });
  assert(summary.includes('12.9.2026'), `date in summary: ${summary}`);
  assert(summary.includes('2 תנועות'), `backup tx: ${summary}`);
  assert(summary.includes('6 חודשים בארכיון'), `archive: ${summary}`);
  assert(summary.includes('60 תנועות'), `current tx: ${summary}`);

  assert(formatBackupDateHe('2026-09-12T10:00:00.000Z') === '12.9.2026', 'format date');

  assert(isBackupStale(null) === true, 'never backed up');
  assert(
    isBackupStale(new Date(Date.now() - 31 * 86400000).toISOString()) === true,
    '31 days stale'
  );
  assert(
    isBackupStale(new Date(Date.now() - 5 * 86400000).toISOString()) === false,
    '5 days fresh'
  );

  console.log('backupExport.test.ts: ok');
}

run();
