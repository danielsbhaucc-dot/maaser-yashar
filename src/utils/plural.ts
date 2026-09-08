/**
 * ריבוי עברי פשוט למחרוזות דינמיות (1 / 2 / רבים).
 * one — יחיד (1), two — זוגי (2), many — 0 ו־3+ (ברירת מחדל עברית).
 */
export function pluralHe(
  n: number,
  forms: { one: string; two?: string; many: string }
): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return forms.one;
  if (abs === 2 && forms.two) return forms.two;
  return forms.many;
}

/** חודש אחד / חודשיים / N חודשים */
export function monthsLabel(n: number): string {
  return pluralHe(n, {
    one: 'חודש אחד',
    two: 'חודשיים',
    many: `${n} חודשים`,
  });
}

/** 0/1 חודש מכוסה / 2/3 חודשים מכוסים */
export function monthsCoveredLabel(covered: number, total: number): string {
  return pluralHe(total, {
    one: `${covered}/1 חודש מכוסה`,
    two: `${covered}/2 חודשיים מכוסים`,
    many: `${covered}/${total} חודשים מכוסים`,
  });
}

/** יש חודש אחד עם יתרה / יש N חודשים עם יתרה */
export function monthsWithBalanceLabel(n: number): string {
  return pluralHe(n, {
    one: 'יש חודש אחד עם יתרה',
    two: 'יש חודשיים עם יתרה',
    many: `יש ${n} חודשים עם יתרה`,
  });
}

/** חודש אחד שסגרנו יחד / N חודשים שסגרנו יחד */
export function monthsClosedTogetherLabel(n: number, verb: 'סגרנו' | 'שמרנו' = 'סגרנו'): string {
  return pluralHe(n, {
    one: `חודש אחד ש${verb} יחד`,
    two: `חודשיים ש${verb} יחד`,
    many: `${n} חודשים ש${verb} יחד`,
  });
}

/** יום אחד / יומיים / N ימים */
export function daysLabel(n: number): string {
  return pluralHe(n, {
    one: 'יום אחד',
    two: 'יומיים',
    many: `${n} ימים`,
  });
}

/** עוד יום אחד בחודש / עוד N ימים בחודש */
export function daysLeftInMonthLabel(n: number): string {
  return pluralHe(n, {
    one: 'עוד יום אחד בחודש',
    two: 'עוד יומיים בחודש',
    many: `עוד ${n} ימים בחודש`,
  });
}

/** נגמר בעוד יום אחד / נגמר בעוד N ימים */
export function endsInDaysLabel(n: number): string {
  return pluralHe(n, {
    one: 'נגמר בעוד יום אחד',
    two: 'נגמר בעוד יומיים',
    many: `נגמר בעוד ${n} ימים`,
  });
}

/** תנועה אחת / שתי תנועות / N תנועות */
export function entriesLabel(n: number): string {
  return pluralHe(n, {
    one: 'תנועה אחת',
    two: 'שתי תנועות',
    many: `${n} תנועות`,
  });
}
