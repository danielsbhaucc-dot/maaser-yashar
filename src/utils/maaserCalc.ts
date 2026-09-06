import type {
  MaaserBreakdownLine,
  MaaserInputs,
  MaaserResult,
} from '../types';

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * חישוב בסיס מעשר / חומש לפי שיטות הלכתיות נפוצות.
 * אינו פסק הלכה — מיועד לעזרה בחישוב; לשאלות ספק יש לפנות לרב.
 */
export function calculateMaaser(inputs: MaaserInputs): MaaserResult {
  const lines: MaaserBreakdownLine[] = [];
  const warnings: string[] = [];
  let subject = 0;
  let deductions = 0;

  const salary = n(inputs.salaryGross);
  if (salary > 0) {
    lines.push({
      id: 'salary',
      label: 'משכורת ברוטו',
      amount: salary,
      kind: 'income',
    });
    subject += salary;
  }

  const tax = n(inputs.incomeTax);
  const ni = n(inputs.nationalInsurance);
  const health = n(inputs.healthTax);

  if (inputs.taxDeductionMode === 'after_mandatory') {
    const mand = tax + ni + health;
    if (mand > 0) {
      lines.push({
        id: 'mandatory',
        label: 'מס הכנסה + ביטוח לאומי + בריאות',
        amount: -mand,
        kind: 'deduction',
        note: 'שיטה נפוצה: מעשר מהנטו אחרי ניכויי חובה',
      });
      deductions += mand;
    }
  } else if (inputs.taxDeductionMode === 'after_income_tax_only') {
    if (tax > 0) {
      lines.push({
        id: 'income_tax',
        label: 'מס הכנסה בלבד',
        amount: -tax,
        kind: 'deduction',
        note: 'יש פוסקים שמנכים רק מס הכנסה',
      });
      deductions += tax;
    }
    if (ni + health > 0) {
      warnings.push(
        'בשיטה זו ביטוח לאומי ובריאות לא נוכו מהבסיס — יש מחלוקת בין הפוסקים.'
      );
    }
  } else {
    warnings.push(
      'מחשבים מהברוטו לפני מסים — שיטה מחמירה יותר. ודאו שזו כוונתכם.'
    );
  }

  const business = n(inputs.businessIncome);
  const bizExp = n(inputs.businessExpenses);
  if (business > 0 || bizExp > 0) {
    lines.push({
      id: 'business',
      label: 'הכנסה מעסק / עצמאי',
      amount: business,
      kind: 'income',
    });
    subject += business;
    if (bizExp > 0) {
      lines.push({
        id: 'biz_exp',
        label: 'הוצאות עסק מוכרות',
        amount: -bizExp,
        kind: 'deduction',
        note: 'הוצאות ליצירת ההכנסה — מקובל לנכות לפני מעשר',
      });
      deductions += bizExp;
    }
  }

  const gains = n(inputs.capitalGains);
  if (gains > 0) {
    lines.push({
      id: 'gains',
      label: 'רווחי הון / השקעות (נטו אחרי מס אם כבר נוכה)',
      amount: gains,
      kind: 'income',
      note: 'יש להכניס את הרווח שנותר בידכם',
    });
    subject += gains;
  }

  const rent = n(inputs.rentalIncome);
  const rentExp = n(inputs.rentalExpenses);
  if (rent > 0) {
    lines.push({
      id: 'rent',
      label: 'הכנסה משכירות',
      amount: rent,
      kind: 'income',
    });
    subject += rent;
    if (rentExp > 0) {
      lines.push({
        id: 'rent_exp',
        label: 'הוצאות שכירות (תחזוקה וכו\')',
        amount: -rentExp,
        kind: 'deduction',
      });
      deductions += rentExp;
    }
  }

  const gifts = n(inputs.giftsReceived);
  if (gifts > 0) {
    if (inputs.giftMode === 'include') {
      lines.push({
        id: 'gifts',
        label: 'מתנות / מתנות כסף שקיבלתם',
        amount: gifts,
        kind: 'income',
        note: 'רבים מחייבים מעשר גם ממתנות כסף',
      });
      subject += gifts;
    } else {
      lines.push({
        id: 'gifts_ex',
        label: 'מתנות (הוחרגו לפי בחירתכם)',
        amount: gifts,
        kind: 'exempt',
      });
    }
  }

  const inheritance = n(inputs.inheritance);
  if (inheritance > 0) {
    if (inputs.inheritanceMode === 'include') {
      lines.push({
        id: 'inherit',
        label: 'ירושה (נכללת — שיטה מחמירה)',
        amount: inheritance,
        kind: 'income',
      });
      subject += inheritance;
    } else {
      lines.push({
        id: 'inherit_ex',
        label: 'ירושה (פטורה — שיטה נפוצה)',
        amount: inheritance,
        kind: 'exempt',
        note: 'רוב הפוסקים: אין מעשר על ירושה, ויש מחמירים',
      });
    }
  }

  const allowances = n(inputs.allowances);
  if (allowances > 0) {
    if (inputs.allowanceMode === 'include') {
      lines.push({
        id: 'allow',
        label: 'קצבאות (ילדים וכו\')',
        amount: allowances,
        kind: 'income',
      });
      subject += allowances;
    } else {
      lines.push({
        id: 'allow_ex',
        label: 'קצבאות (הוחרגו)',
        amount: allowances,
        kind: 'exempt',
        note: 'יש פוסקים הפוטרים קצבאות ילדים ממעשר',
      });
    }
  }

  const other = n(inputs.otherIncome);
  if (other > 0) {
    lines.push({
      id: 'other',
      label: 'הכנסות אחרות',
      amount: other,
      kind: 'income',
    });
    subject += other;
  }

  if (inputs.includeSpouse) {
    const spouse = n(inputs.spouseIncome);
    if (spouse > 0) {
      lines.push({
        id: 'spouse',
        label: 'הכנסת בן/בת הזוג (חישוב משותף)',
        amount: spouse,
        kind: 'income',
        note: 'אם מפרידים מעשרות — אל תסמנו "חישוב משותף"',
      });
      subject += spouse;
    }
  } else if (inputs.maritalStatus === 'married') {
    warnings.push(
      'נשואים: ודאו אם מחשבים מעשר בנפרד או במשותף — יש לנהוג כפי שנהגתם עד כה או לשאול רב.'
    );
  }

  if (n(inputs.loansTaken) > 0) {
    lines.push({
      id: 'loan_in',
      label: 'הלוואה שנלקחה (לא הכנסה)',
      amount: n(inputs.loansTaken),
      kind: 'exempt',
      note: 'קרן הלוואה אינה הכנסה למעשר',
    });
  }

  if (inputs.deductLoanRepayments && n(inputs.loansRepaid) > 0) {
    const repaid = n(inputs.loansRepaid);
    lines.push({
      id: 'loan_out',
      label: 'החזרי הלוואה (ניכוי לפי שיטה זו)',
      amount: -repaid,
      kind: 'deduction',
      note: 'יש פוסקים שמנכים החזר קרן; אחרים לא',
    });
    deductions += repaid;
  }

  const netBase = Math.max(0, subject - deductions);
  const rate = inputs.rate;
  const obligation = Math.round(netBase * rate * 100) / 100;
  const alreadyGiven = n(inputs.alreadyGivenTzedaka);
  const remaining = Math.max(0, Math.round((obligation - alreadyGiven) * 100) / 100);

  if (alreadyGiven > obligation) {
    warnings.push(
      'כבר נתתם יותר מחובת המעשר/חומש לתקופה זו. העודף יכול (לפי חלק מהפוסקים) להיחשב על תקופה הבאה — שאלו רב.'
    );
  }

  if (rate === 0.2) {
    warnings.push(
      'חומש (20%) הוא מנהג חסידות / מידת חסידות אצל רבים — לא חובה כמעשר. כל הכבוד.'
    );
  }

  if (netBase === 0 && subject === 0) {
    warnings.push('לא הוזנו הכנסות — מלאו לפחות שדה אחד כדי לחשב.');
  }

  return {
    grossSubjectBase: subject,
    deductions,
    netBase,
    obligation,
    alreadyGiven,
    remaining,
    ratePercent: rate * 100,
    lines,
    warnings,
  };
}

export const defaultMaaserInputs = (): MaaserInputs => ({
  salaryGross: 0,
  incomeTax: 0,
  nationalInsurance: 0,
  healthTax: 0,
  businessIncome: 0,
  businessExpenses: 0,
  capitalGains: 0,
  rentalIncome: 0,
  rentalExpenses: 0,
  giftsReceived: 0,
  inheritance: 0,
  allowances: 0,
  otherIncome: 0,
  spouseIncome: 0,
  alreadyGivenTzedaka: 0,
  loansTaken: 0,
  loansRepaid: 0,
  rate: 0.1,
  taxDeductionMode: 'after_mandatory',
  giftMode: 'include',
  inheritanceMode: 'exclude',
  allowanceMode: 'exclude',
  includeSpouse: false,
  deductLoanRepayments: false,
  employmentType: 'both',
  maritalStatus: 'single',
});
