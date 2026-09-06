/** שיטות הלכתיות נפוצות לחישוב בסיס המעשר */
export type TaxDeductionMode =
  | 'after_mandatory' // מס הכנסה + ביטוח לאומי + בריאות — שיטה נפוצה
  | 'gross' // מהברוטו לפני מסים
  | 'after_income_tax_only'; // רק מס הכנסה, בלי ביטוח לאומי

export type GiftMode = 'include' | 'exclude';
export type InheritanceMode = 'exclude' | 'include';
export type AllowanceMode = 'exclude' | 'include'; // קצבאות ילדים וכו'
export type MaaserRate = 0.1 | 0.2;

export type EmploymentType = 'employee' | 'self_employed' | 'both' | 'other';
export type MaritalStatus = 'single' | 'married' | 'unknown';

export interface MaaserInputs {
  // הכנסות
  salaryGross: number;
  incomeTax: number;
  nationalInsurance: number;
  healthTax: number;
  businessIncome: number;
  businessExpenses: number;
  capitalGains: number;
  rentalIncome: number;
  rentalExpenses: number;
  giftsReceived: number;
  inheritance: number;
  allowances: number; // קצבאות
  otherIncome: number;
  spouseIncome: number; // אם מחשבים יחד

  // ניכויים / כבר ניתן
  alreadyGivenTzedaka: number;
  loansTaken: number; // הלוואות שנלקחו — לא הכנסה
  loansRepaid: number; // החזרי הלוואה מתוך הכנסה — חלק מהפוסקים מנכים

  // הגדרות
  rate: MaaserRate;
  taxDeductionMode: TaxDeductionMode;
  giftMode: GiftMode;
  inheritanceMode: InheritanceMode;
  allowanceMode: AllowanceMode;
  includeSpouse: boolean;
  deductLoanRepayments: boolean;
  employmentType: EmploymentType;
  maritalStatus: MaritalStatus;
}

export interface MaaserBreakdownLine {
  id: string;
  label: string;
  amount: number;
  kind: 'income' | 'deduction' | 'exempt' | 'info';
  note?: string;
}

export interface MaaserResult {
  grossSubjectBase: number;
  deductions: number;
  netBase: number;
  obligation: number;
  alreadyGiven: number;
  remaining: number;
  ratePercent: number;
  lines: MaaserBreakdownLine[];
  warnings: string[];
}

export interface Tax46Inputs {
  donationsTotal: number;
  taxableIncome: number;
  isCompany: boolean;
  taxYear: number;
  taxAlreadyPaid: number; // מס ששולם בפועל — לאומדן אם יש ממה לקזז
}

export interface Tax46Result {
  eligible: boolean;
  creditRate: number;
  creditAmount: number;
  cappedDonation: number;
  minDonation: number;
  absoluteCap: number;
  incomeCap: number;
  reasons: string[];
  tips: string[];
}
