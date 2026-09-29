import halakha from '../../shared/halakha.json';
import type { Gender } from './copy';
import { BOT_NAME, friendWord, genderSelected, t } from './copy';
import { rateLabel, rateLabelFull } from './rateLabel';

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** פתיחות ניטרליות — בלי פנייה במגדר למשתמש (N-14) */
export const INTROS = [
  `היייי 👋\nאני ${BOT_NAME} — העוזר ה-AI של מעשר ישר.\nאני יכול לטעות, ואני לא רב. בלי דרשות, בלי לחץ. רק נכיר קצת ונצלול.`,
  `אהלן!\nקוראים לי ${BOT_NAME} 💚 — עוזר AI של מעשר ישר, עם מספרים בראש.\nנעשה את המעשר פשוט, מדויק, ובכיף.`,
  `היי!\nאני ${BOT_NAME}, העוזר ה-AI של מעשר ישר. אני פה כדי שיהיה ברור בדיוק כמה לתת — בלי אקסלים ובלי כאב ראש.`,
  `יואו הגעת!\nאני ${BOT_NAME}, עוזר AI. כמה שאלות קצרות — ואז ניגשים לעניין.`,
];

export const ASK_NAME = [
  'קודם כל… איך קוראים לך? 😊',
  'נתחיל מהבסיס: מה השם שלך?',
  'לפני שמחשבים מעשר — איך לפנות אליך?',
  'שם פרטי מספיק. אפשר לזרוק שם!',
];

/** בועה אחת לשלב הפתיחה (N-14) */
export function introBubble(): string {
  return `${pick(INTROS)}\n\n${pick(ASK_NAME)}\n\n(אפשר גם לשאול משהו קטן על מעשר — ואם מעדיפים בלי שם, אפשר להגיד במפורש.)`;
}

export function afterName(name: string): string {
  return pick([
    `${name}! נעים להכיר.`,
    `כיף להכיר, ${name}.`,
    `${name} — נרשם.`,
    `אהלן ${name}.`,
  ]);
}

/** שאלה ישירה למגדר — בלי בדיחות (N-14 / T-32) */
export const GENDER_ASK = [
  'מה המגדר שלך? זכר, נקבה, או מעדיפים לא לומר — כדי לדייק את השפה.',
  'רק כדי לדייק את השפה: זכר, נקבה, או מדלגים?',
  'איך לפנות אליך — בלשון זכר, נקבה, או ניטרלי?',
];

/** @deprecated השתמשו ב־GENDER_ASK */
export const GENDER_JOKES = GENDER_ASK;

export function afterGender(name: string, g: Gender): string {
  if (g === 'unspecified') {
    return pick([
      `סבבה — נדבר בלשון רבים (אתם). אפשר לעדכן מגדר בהגדרות.\n${name}, מה המצב המשפחתי? אפשר גם לדלג.`,
      `קיבלתי. בלי מגדר — לשון רבים.\n${name}: מצב משפחתי? (או דילוג)`,
    ]);
  }
  if (g === 'male') {
    return pick([
      `מעולה — מעכשיו בלשון זכר.\n${name}, אתה נשוי, רווק, גרוש או אלמן?`,
      `קיבלתי. זכר.\nשאלה הבאה, ${name}: מצב משפחתי?`,
      `יופי.\n${name} — מצב משפחתי? אפשר גם לדלג.`,
    ]);
  }
  return pick([
    `מעולה — מעכשיו בלשון נקבה.\n${name}, את נשואה, רווקה, גרושה או אלמנה?`,
    `קיבלתי. נקבה.\n${name}: מצב משפחתי?`,
    `סגור.\n${name} — מצב משפחתי? אפשר גם לדלג.`,
  ]);
}

export function afterMarital(g: Gender): string {
  const gOk = genderSelected(g) ? g : undefined;
  return pick([
    t(
      gOk,
      'אחרון וזהו — כמה נותנים?\nמעשר 10% או חומש 20%?\nאם בא הסבר — יש כפתור «מה ההבדל?» 👇',
      'אחרון וזהו — כמה נותנים?\nמעשר 10% או חומש 20%?\nאם בא הסבר — יש כפתור «מה ההבדל?» 👇',
      'אחרון וזהו — כמה נותנים?\nמעשר 10% או חומש 20%?\nאם בא הסבר — יש כפתור «מה ההבדל?» 👇'
    ),
    t(
      gOk,
      'עכשיו הבחירה החשובה:\n10% (מעשר) או 20% (חומש)?\nיש «מה ההבדל?» אם מתלבטים 😊',
      'עכשיו הבחירה החשובה:\n10% (מעשר) או 20% (חומש)?\nיש «מה ההבדל?» אם מתלבטים 😊',
      'עכשיו הבחירה החשובה:\n10% (מעשר) או 20% (חומש)?\nיש «מה ההבדל?» אם מתלבטים 😊'
    ),
    `${halakha.fixedStrings.rateChoice}\nמה בוחרים? אפשר גם לבקש הסבר.`,
  ]);
}

export function afterRate(name: string, g: Gender, rate: number): string {
  const label = rateLabel(rate);
  const gOk = genderSelected(g) ? g : undefined;
  const rateNote = halakha.fixedStrings.rateChoice as string;
  return pick([
    t(
      gOk,
      `יופי ${name}! ${label} זה הכיוון ✦\n${rateNote}\nהפנקס כמעט מוכן — רגע של חגיגה קטנה.`,
      `יופי ${name}! ${label} זה הכיוון ✦\n${rateNote}\nהפנקס כמעט מוכן — רגע של חגיגה קטנה.`,
      `יופי ${name}! ${label} זה הכיוון ✦\n${rateNote}\nהפנקס כמעט מוכן — רגע של חגיגה קטנה.`
    ),
    t(
      gOk,
      `ננעל: ${label} ✨\n${rateNote}\n${name}, עוד לחיצה אחת ומתחילים לספור ברכה.`,
      `ננעל: ${label} ✨\n${rateNote}\n${name}, עוד לחיצה אחת ומתחילות לספור ברכה.`,
      `ננעל: ${label} ✨\n${rateNote}\n${name}, עוד לחיצה אחת ומתחילים לספור ברכה.`
    ),
  ]);
}

export function welcomeDone(name: string, g: Gender, rate: number): string {
  const label = rateLabelFull(rate);
  return t(
    genderSelected(g) ? g : undefined,
    `ברוך הבא לפנקס, ${name}!\nשיעור: ${label}.\nמעכשיו זה פשוט — הכנסה, ניכוי מהבסיס, צדקה. יאללה ✦`,
    `ברוכה הבאה לפנקס, ${name}!\nשיעור: ${label}.\nמעכשיו זה פשוט — הכנסה, ניכוי מהבסיס, צדקה. יאללה ✦`,
    `ברוכים הבאים לפנקס, ${name}!\nשיעור: ${label}.\nמעכשיו זה פשוט — הכנסה, ניכוי מהבסיס, צדקה. יאללה ✦`
  );
}

export function displayFallbackName(name: string, g: Gender): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  return friendWord(g);
}

export const EXPLAIN = {
  rate: halakha.explainers.rate as string,
  marital: halakha.explainers.marital as string,
  gender: halakha.explainers.gender as string,
  net: halakha.explainers.net as string,
};
