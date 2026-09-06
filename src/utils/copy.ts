import type { UserProfile } from './profile';

export type Gender = 'male' | 'female';

export const BOT_NAME = 'נועם';

export function t(gender: Gender | undefined, male: string, female: string) {
  return gender === 'female' ? female : male;
}

export function hello(profile: Pick<UserProfile, 'displayName' | 'gender'>) {
  const name = profile.displayName || t(profile.gender, 'חבר', 'חברה');
  return `היי ${name} 👋`;
}

export function friendWord(gender?: Gender) {
  return t(gender, 'חבר', 'חברה');
}
