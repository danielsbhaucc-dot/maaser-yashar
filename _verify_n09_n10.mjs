/**
 * אימות N-09 / N-10 — שער נטו/ברוטו+מטבע זר + period לחודש קודם.
 * הרצה: node _verify_n09_n10.mjs
 */
import assert from 'node:assert/strict';
import {
  FX_CLARIFY,
  NET_GROSS_CLARIFY,
  gateProposedActions,
  isEntryClarifyingQuestion,
  replyForProposalGate,
  textSuggestsEntry,
  validActions,
} from './netlify/functions/chatSafety.mjs';

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`OK  | ${name}`);
}

const income = {
  type: 'add_entry',
  kind: 'income',
  amount: 9800,
  category: 'משכורת',
  note: '',
};

// --- N-09: בלי נטו/ברוטו → בלי כרטיס ---
{
  const g = gateProposedActions([income], [
    { role: 'user', content: 'קיבלתי משכורת 9,800' },
  ]);
  assert.equal(g.actions.length, 0);
  assert.equal(g.reason, 'net_gross');
  assert.equal(replyForProposalGate(g.reason, 'מציע 9800 נטו'), NET_GROSS_CLARIFY);
  ok('N-09 salary without net/gross clears card');
}

// --- N-09: מטבע זר בלי שער ---
{
  const g = gateProposedActions(
    [{ ...income, amount: 18500 }],
    [{ role: 'user', content: 'קיבלתי משכורת 5000 דולר' }]
  );
  assert.equal(g.actions.length, 0);
  assert.equal(g.reason, 'fx');
  assert.equal(replyForProposalGate(g.reason, ''), FX_CLARIFY);
  ok('N-09 foreign currency without rate clears card');
}

// --- N-09: אחרי נטו + שער → מותר ---
{
  const g = gateProposedActions(
    [{ ...income, amount: 18500, note: 'נטו · $5000×3.7' }],
    [
      { role: 'user', content: 'קיבלתי משכורת 5000 דולר' },
      { role: 'assistant', content: FX_CLARIFY },
      { role: 'user', content: 'נטו, שער 3.7' },
    ]
  );
  assert.equal(g.actions.length, 1);
  assert.equal(g.actions[0].amount, 18500);
  assert.equal(g.reason, null);
  ok('N-09 after net+rate allows ₪ proposal');
}

// --- N-09: שאלת הבהרה לא מפעילה retry ---
{
  assert.equal(isEntryClarifyingQuestion('נטו או ברוטו?'), true);
  assert.equal(textSuggestsEntry('קיבלתי משכורת 9800 — נטו או ברוטו?'), false);
  ok('N-09 clarifying question skips entry retry');
}

// --- N-10: חודש שעבר בלי period → בלי כרטיס ---
{
  const tzedaka = {
    type: 'add_entry',
    kind: 'tzedaka',
    amount: 100,
    category: 'צדקה / מעשר',
    note: '',
  };
  const g = gateProposedActions([tzedaka], [
    { role: 'user', content: 'תרשום לי תרומה של 100 ש"ח בחודש שעבר' },
  ]);
  assert.equal(g.actions.length, 0);
  assert.equal(g.reason, 'prior_month');
  ok('N-10 prior month without period clears card');
}

// --- N-10: עם period תקין → עובר ---
{
  const withPeriod = validActions([
    {
      type: 'add_entry',
      kind: 'tzedaka',
      amount: 100,
      category: 'צדקה / מעשר',
      note: '',
      period: '2026-08',
    },
  ]);
  assert.equal(withPeriod[0].period, '2026-08');
  const g = gateProposedActions(withPeriod, [
    { role: 'user', content: 'תרשום לי תרומה של 100 ש"ח בחודש שעבר' },
  ]);
  assert.equal(g.actions.length, 1);
  assert.equal(g.actions[0].period, '2026-08');
  ok('N-10 prior month with period keeps card');
}

// --- N-10: period לא תקין נזרק ---
{
  const out = validActions([
    { ...income, period: '08-2026', note: 'נטו' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].period, undefined);
  ok('N-10 invalid period stripped');
}

console.log(`\n${passed} checks passed (N-09 / N-10)`);
