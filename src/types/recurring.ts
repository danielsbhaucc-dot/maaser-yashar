import type { LedgerKind } from './ledger';

/** הוראת קבע / פעולה חוזרת לפי יום בחודש */
export interface RecurringRule {
  id: string;
  kind: LedgerKind;
  category: string;
  amount: number;
  note: string;
  /** 1–28 (נמנעים מ־29–31 כדי שיעבוד בכל חודש) */
  dayOfMonth: number;
  enabled: boolean;
  createdAt: string;
  /** YYYY-MM אחרון שבו כבר נוצרה תנועה */
  lastAppliedPeriod?: string;
}
