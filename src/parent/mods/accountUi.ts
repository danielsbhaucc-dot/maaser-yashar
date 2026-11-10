import type { InstalledModule } from '../modules';
/**
 * מודול 'account-ui' מהלוח: המתג הגלוי של החשבון המרכזי (כפתור כניסה/הרשמה וקטע «החשבון המרכזי» בהגדרות).
 * אין כאן קוד — עצם ההתקנה (המודול ברשימה החתומה) הוא הסימן. כבוי = החיבור ('account') פועל ברקע בלי שום דבר גלוי.
 * להצגת הכפתור: להפעיל את 'account-ui' למעשר ישר בלוח. בלי פריסת קוד.
 */
export async function install(): Promise<InstalledModule | null> { return { remove() { /* visibility only */ } }; }
