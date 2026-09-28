/**
 * בדיקה קלה ל־migrateLedgerEntries — להרצה:
 *   npx --yes tsx src/utils/schemaMigrate.test.ts
 */
import { migrateLedgerEntries } from './schemaMigrate';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const withoutDate = migrateLedgerEntries([
    {
      id: '1',
      period: '2026-09',
      kind: 'income',
      category: 'משכורת',
      amount: 1000,
      note: '',
      createdAt: '2026-09-01T12:00:00.000Z',
    },
  ]);
  assert(withoutDate.length === 1, 'expected 1 entry');
  assert(withoutDate[0].date === undefined, 'date should stay undefined');
  assert(withoutDate[0].createdAt === '2026-09-01T12:00:00.000Z', 'createdAt preserved');
  assert(withoutDate[0].amount === 1000, 'amount preserved');

  const withDateAndRule = migrateLedgerEntries([
    {
      id: '2',
      period: '2026-09',
      kind: 'tzedaka',
      category: 'צדקה / מעשר',
      amount: 50,
      note: 'חודשי',
      createdAt: '2026-09-10T12:00:00.000Z',
      date: '2026-09-10',
      ruleId: 'r-1',
    },
  ]);
  assert(withDateAndRule[0].date === '2026-09-10', 'date kept');
  assert(withDateAndRule[0].ruleId === 'r-1', 'ruleId kept');

  const junk = migrateLedgerEntries([
    null,
    42,
    { id: 'x' },
    { id: '3', period: '2026-01', kind: 'nope', amount: 1, createdAt: 'x' },
  ]);
  assert(junk.length === 0, 'junk filtered');

  console.log('schemaMigrate.test.ts: ok');
}

run();
