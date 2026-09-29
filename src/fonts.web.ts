/**
 * Web: גופנים נטענים ב-public/index.html עם preload + font-display:swap.
 * לא חוסמים רינדור — המערכת מציירת מיד ואז מתבצע swap.
 */
export function useAppFonts(): [boolean, Error | null] {
  return [true, null];
}
