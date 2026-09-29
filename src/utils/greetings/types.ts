/** טיפוסי ברכה — בלי תלות ב־hebcal (מאפשר import type מהמסך הראשי) */
export type GreetingResult = {
  /** מילת ברכה בלבד (בוקר טוב / שבת שלום…) */
  greeting: string;
  /** שורה אישית מלאה */
  line: string;
  /** משפט נעים מתחת */
  note?: string;
  light?: boolean;
};
