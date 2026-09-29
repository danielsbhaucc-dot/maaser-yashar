import type { MaaserRate, MaritalStatus } from '../types';
import type { Gender } from './copy';
import {
  safeLoadJsonObject,
  safeSetJson,
  type SafeLoadResult,
} from './safeStorage';
import {
  defaultAdvancedSettings,
  type AdvancedCalcSettings,
} from './totalsAdvanced';
import { isValidMaaserRate } from './rateLabel';

export const PROFILE_KEY = 'maaser_profile_v2';

export type { AdvancedCalcSettings };

export interface UserProfile {
  onboardingDone: boolean;
  displayName: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  includeSpouse: boolean;
  rate: MaaserRate;
  /** ISO — לתצוגת ימי מסע */
  joinedAt?: string;
  /**
   * האם לשלוח סיכום סכומי החודש עם הודעות הצ'אט.
   * false = רק ההודעה, בלי context.
   */
  chatShareTotals: boolean;
  /**
   * שמירת היסטוריית שיחות עם נועם ב־localStorage.
   * false = לא נשמר; נמחק בסגירת החלון/מסך (N-16).
   */
  saveChatHistory: boolean;
  /** האם המשתמש כבר אישר את מסך הסכמת הצ'אט */
  chatConsentDone: boolean;
  /** חישוב מעשר מתקדם — מופעל כברירת מחדל */
  advanced: AdvancedCalcSettings;
  /**
   * העברת עודף לחודש הבא — כבוי כברירת מחדל.
   * דורש התניה מראש לפי חלק מהפוסקים.
   */
  carryForwardSurplus: boolean;
  /** דילג על אונבורדינג — מציג כרטיס «לכוון?» חד־פעמי בבית */
  skippedSetup?: boolean;
  /** המשתמש הסתיר את כרטיס נועם בבית */
  hideNoamNudge?: boolean;
  /** כרטיס «לכוון?» נסגר */
  tuneCardDismissed?: boolean;
  /** פעימת כפתור נועם נראתה — אחרי פתיחה ראשונה של הצ׳אט */
  noamPulseSeen?: boolean;
}

export const defaultProfile = (): UserProfile => ({
  onboardingDone: false,
  displayName: '',
  gender: 'unspecified',
  maritalStatus: 'unknown',
  includeSpouse: false,
  rate: 0.1,
  joinedAt: undefined,
  chatShareTotals: true,
  saveChatHistory: true,
  chatConsentDone: false,
  advanced: defaultAdvancedSettings(),
  carryForwardSurplus: false,
  skippedSetup: false,
  hideNoamNudge: false,
  tuneCardDismissed: false,
  noamPulseSeen: false,
});

export async function loadProfile(): Promise<SafeLoadResult<UserProfile>> {
  const result = await safeLoadJsonObject<UserProfile>(PROFILE_KEY, defaultProfile());
  if (result.corrupt) return result;
  // מסירים שדות ישנים (hasSalary/hasBusiness) אם נשמרו בעבר
  const { hasSalary: _s, hasBusiness: _b, ...rest } = result.data as UserProfile & {
    hasSalary?: boolean;
    hasBusiness?: boolean;
  };
  const base = defaultProfile();
  const merged: UserProfile = {
    ...base,
    ...rest,
    advanced: {
      ...base.advanced,
      ...(rest as Partial<UserProfile>).advanced,
    },
  };
  if (!isValidMaaserRate(merged.rate)) {
    merged.rate = base.rate;
  }
  return { data: merged, corrupt: false };
}

/** @returns false אם נחסם בגלל נתון פגום */
export async function saveProfile(
  profile: UserProfile,
  opts?: { force?: boolean }
): Promise<boolean> {
  return safeSetJson(PROFILE_KEY, profile, opts);
}
