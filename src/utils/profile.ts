import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MaaserRate, MaritalStatus } from '../types';
import type { Gender } from './copy';

const PROFILE_KEY = 'maaser_profile_v2';

export interface UserProfile {
  onboardingDone: boolean;
  displayName: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  includeSpouse: boolean;
  rate: MaaserRate;
  hasSalary: boolean;
  hasBusiness: boolean;
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
  hasSalary: true,
  hasBusiness: false,
  joinedAt: undefined,
  chatShareTotals: true,
  chatConsentDone: false,
});

export async function loadProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile();
    return { ...defaultProfile(), ...JSON.parse(raw) };
  } catch {
    return defaultProfile();
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
