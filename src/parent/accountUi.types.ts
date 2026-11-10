/** מה שמסך ההגדרות צריך כדי לצייר את החשבון המרכזי (בלי תלות בערכה עצמה). */
export interface AccountUi {
  title: string;
  sub: string;
  line: string;
  error: string | null;
  action: 'signIn' | 'signOut' | null;
  actionLabel: string;
  signedIn: boolean;
  colors: { surface: string; text: string; muted: string; accent: string; onAccent: string };
  radius: number;
  run(): void;
}
