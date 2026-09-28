import type { MaaserRate, MaritalStatus } from '../types';
import type { Gender } from './copy';
import {
  safeLoadJsonObject,
  safeSetJson,
  type SafeLoadResult,
} from './safeStorage';

export const PROFILE_KEY = 'maaser_profile_v2';

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
  /** האם המשתמש כבר אישר את מסך הסכמת הצ'אט */
  chatConsentDone: boolean;
}

export const defaultProfile = (): UserProfile => ({
  onboardingDone: false,
  displayName: '',
  gender: 'male',
  maritalStatus: 'single',
  includeSpouse: false,
  rate: 0.1,
  joinedAt: undefined,
  chatShareTotals: true,
  chatConsentDone: false,
});

export async function loadProfile(): Promise<SafeLoadResult<UserProfile>> {
  const result = await safeLoadJsonObject<UserProfile>(PROFILE_KEY, defaultProfile());
  if (result.corrupt) return result;
  // מסירים שדות ישנים (hasSalary/hasBusiness) אם נשמרו בעבר
  const { hasSalary: _s, hasBusiness: _b, ...rest } = result.data as UserProfile & {
    hasSalary?: boolean;
    hasBusiness?: boolean;
  };
  return { data: { ...defaultProfile(), ...rest }, corrupt: false };
}

/** @returns false אם נחסם בגלל נתון פגום */
export async function saveProfile(
  profile: UserProfile,
  opts?: { force?: boolean }
): Promise<boolean> {
  return safeSetJson(PROFILE_KEY, profile, opts);
}
