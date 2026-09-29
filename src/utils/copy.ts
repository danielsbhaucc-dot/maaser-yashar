import type { UserProfile } from './profile';

/** unspecified = טרם נבחר / מעדיפים לא לומר — פנייה ניטרלית */
export type Gender = 'male' | 'female' | 'unspecified';

export const BOT_NAME = 'נועם';

/**
 * פנייה לפי מגדר.
 * unspecified = לשון רבים (אתם): משתמשים ב־neutral אם ניתן,
 * אחרת בצורה הזהה לשני המינים, ואם אין — בצורת זכר־רבים הנפוצה בעברית (לא «נקבה»).
 */
export function t(
  gender: Gender | undefined,
  male: string,
  female: string,
  neutral?: string
) {
  if (gender === 'female') return female;
  if (gender === 'male') return male;
  if (neutral != null) return neutral;
  if (male === female) return male;
  /** לשון רבים בעברית לרוב חופפת לצורת זכר־רבים */
  return male;
}

export function hello(profile: Pick<UserProfile, 'displayName' | 'gender'>) {
  const name = profile.displayName || friendWord(profile.gender);
  return `היי ${name} 👋`;
}

/** שם ידידותי כשאין שם — «חבר» תואם טון המוצר (M19) */
export function friendWord(gender?: Gender) {
  if (gender === 'female') return 'חברה';
  if (gender === 'male') return 'חבר';
  return 'חבר';
}

export function genderSelected(gender?: Gender): boolean {
  return gender === 'male' || gender === 'female';
}
