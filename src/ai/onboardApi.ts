import { BOT_NAME, type Gender } from '../utils/copy';
import { NOAM_AI_DISCLOSURE_FIRST_PERSON } from '../constants/noamDisclosure';
import type { MaritalStatus } from '../types';
import type { MaaserRate } from '../types';

export type OnboardIntent =
  | 'name'
  | 'skip_name'
  | 'skip_step'
  | 'gender'
  | 'marital'
  | 'rate'
  | 'rate_explain'
  | 'gibberish'
  | 'question'
  | 'other';

export type OnboardResult = {
  intent: OnboardIntent;
  name: string | null;
  reply: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  includeSpouse?: boolean;
  rate?: MaaserRate;
};

/** שדות שאפשר לסרב עליהם בהיכרות (M19) */
export type RefuseField = 'name' | 'gender' | 'marital' | 'rate';

/** ברירות מחדל אחרי סירוב מאושר (N-15: מגדר/משפחה להשלמה בהגדרות) */
export const ONBOARD_DEFAULTS = {
  displayName: '',
  gender: 'unspecified' as Gender,
  maritalStatus: 'unknown' as MaritalStatus,
  rate: 0.1 as MaaserRate,
} as const;

export const MAX_ONBOARD_CLARIFY = 2;

export function refuseFieldForStep(step: number): RefuseField | null {
  if (step === 0) return 'name';
  if (step === 1) return 'gender';
  if (step === 2) return 'marital';
  if (step === 3) return 'rate';
  return null;
}

export function refuseAskSureMessage(field: RefuseField): string {
  switch (field) {
    case 'name':
      return 'בטוחים שרוצים בלי שם? אם כן — כתבו «כן», ואז נאשר בכפתור.';
    case 'gender':
      return 'בטוחים שמדלגים על מגדר? נדבר בלשון ניטרלית. אם כן — כתבו «כן», ואז נאשר בכפתור.';
    case 'marital':
      return 'בטוחים שמדלגים על מצב משפחתי? אפשר להשלים בהגדרות. אם כן — כתבו «כן», ואז נאשר בכפתור.';
    case 'rate':
      return 'בטוחים שמדלגים על שיעור? נניח מעשר 10%. אם כן — כתבו «כן», ואז נאשר בכפתור.';
  }
}

export function refuseConfirmPrompt(field: RefuseField): string {
  switch (field) {
    case 'name':
      return 'כדי לאשר — לחצו על הכפתור למטה. בלי שם אישי בינתיים (אפשר לשנות בהגדרות).';
    case 'gender':
      return 'כדי לאשר — לחצו על הכפתור למטה. מעכשיו בלשון ניטרלית, עד שתעדכנו מגדר.';
    case 'marital':
      return 'כדי לאשר — לחצו על הכפתור למטה. נמשיך בלי מצב משפחתי — אפשר לעדכן בהגדרות.';
    case 'rate':
      return 'כדי לאשר — לחצו על הכפתור למטה. ננעל מעשר 10%.';
  }
}

export function refuseButtonLabel(field: RefuseField): string {
  switch (field) {
    case 'name':
      return 'כן, ממשיכים בלי שם';
    case 'gender':
      return 'כן, פנייה ניטרלית';
    case 'marital':
      return 'כן, מדלגים על מצב משפחתי';
    case 'rate':
      return 'כן, מעשר 10%';
  }
}

export function isYesPhrase(raw: string): boolean {
  const t = raw.trim();
  return /^(כן|כן\.|כן!|y|yes|ok|okay|בטוח|בטוחה|בטוחים|מאשר|מאשרת|מאשרים|סבבה כן|יאללה)$/i.test(
    t
  );
}

export function isNoPhrase(raw: string): boolean {
  const t = raw.trim();
  return /^(לא|לא\.|לא!|no|Nope|בטל|ביטול|חזרה|רגע|עוד לא)$/i.test(t);
}

const NAME_MAX = 20;

/** מילים שלא יכולות להיות שם פרטי */
const NOT_A_NAME = new Set(
  [
    'שמי',
    'שלי',
    'קוראים',
    'אני',
    'לי',
    'השם',
    'שם',
    'בבקשה',
    'היי',
    'שלום',
    'אהלן',
    'נועם',
    'מעשר',
    'חומש',
    'חובה',
    'כן',
    'לא',
    'ok',
    'okay',
    'hi',
    'hello',
    'the',
    'my',
    'name',
    'is',
    'call',
    'me',
    'דלג',
    'דילוג',
    'גרוש',
    'גרושה',
    'אלמן',
    'אלמנה',
  ].map((w) => w.toLowerCase())
);

function cleanToken(token: string): string {
  return token.replace(/[^\u0590-\u05FFa-zA-Z\-']/g, '').trim();
}

function looksLikeNameToken(token: string): boolean {
  const tkn = cleanToken(token);
  if (tkn.length < 2 || tkn.length > NAME_MAX) return false;
  if (NOT_A_NAME.has(tkn.toLowerCase())) return false;
  if (!/^[\u0590-\u05FFa-zA-Z][\u0590-\u05FFa-zA-Z\-']*$/.test(tkn)) return false;
  if (/(.)\1{3,}/.test(tkn)) return false;
  if (/^[\u05D0-\u05EA]{5,}$/.test(tkn) && !/[אעיהווי]/.test(tkn)) {
    return false;
  }
  return true;
}

/** חילוץ שם ממשפטים כמו שמי דני, קוראים לי מיכאל, אני נועה */
function extractNameFromText(raw: string): string | null {
  const text = raw.trim();

  const patterns: RegExp[] = [
    /(?:^|\s)(?:שמי|השם שלי(?: הוא)?|קוראים לי|תקרא לי|תקראי לי|my name is|i'?m|i am|call me)\s+([^\s,!.?]+)/i,
    /(?:^|\s)(?:אני)\s+([^\s,!.?]{2,})(?:\s|$)/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && looksLikeNameToken(m[1])) {
      return cleanToken(m[1]).slice(0, NAME_MAX);
    }
  }

  const parts = text
    .replace(/[^\u0590-\u05FFa-zA-Z\s\-']/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 1 && parts.length <= 3 && parts.every((p) => looksLikeNameToken(p))) {
    return cleanToken(parts[0]!).slice(0, NAME_MAX);
  }

  if (parts.length === 1 && looksLikeNameToken(parts[0]!)) {
    return cleanToken(parts[0]!).slice(0, NAME_MAX);
  }

  return null;
}

function isSkipName(raw: string): boolean {
  return (
    /^(בלי שם|ללא שם|אנונימי|לא רוצה( לתת שם)?|תדלג|דלג על השם|אין לי שם|prefer not|skip( name)?|no name)$/i.test(
      raw
    ) ||
    /לא (רוצה|מעוניין|מעוניינת) (למסור|לתת) שם/.test(raw) ||
    /אפשר בלי שם/.test(raw)
  );
}

/** דילוג כללי / לא רוצה להגיד (N-15) */
export function isSkipPhrase(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (
    /^(דלג|דילוג|תדלג|תדלגי|skip|pass|later|אחר כך|מאוחר יותר|לא עכשיו)$/i.test(t)
  ) {
    return true;
  }
  if (
    /לא רוצה (להגיד|למסור|לענות|לומר)|לא מעניין|מעדי[פף][היוףם]*\s*לא|prefer not( to say)?|don'?t want to say|rather not/i.test(
      t
    )
  ) {
    return true;
  }
  if (/^(לא יודע|לא יודעת|לא בטוח|לא בטוחה|לא משנה)$/i.test(t)) {
    return true;
  }
  return false;
}

export function isRateExplainPhrase(raw: string): boolean {
  const t = raw.trim();
  return (
    /מה ההבדל|מה ההבדלים|מה זה מעשר|מה זה חומש|הסבר|תסביר|תסבירי|what'?s the difference|difference between|explain/i.test(
      t
    ) || /^(מה זה\??|למה\??)$/i.test(t)
  );
}

export function parseGenderPhrase(raw: string): Gender | null {
  const t = raw.trim();
  if (/^(זכר|גבר|בן|male|man|boy|m)$/i.test(t) || /\b(אני )?(גבר|זכר)\b/i.test(t)) {
    return 'male';
  }
  if (/^(נקבה|אישה|בת|female|woman|girl|f)$/i.test(t) || /\b(אני )?(אישה|נקבה)\b/i.test(t)) {
    return 'female';
  }
  // N-15: מעדיפים לא לומר / ניטרלי מפורש (לא «דלג» — זה skip_step ב־M19)
  if (
    /מעדיפ[היו]?ם?\s*לא|לא רוצה (להגיד|למסור|לומר)|prefer not|don'?t want to say|לא להגיד|^(ניטרל(י)?|בלי מגדר|לשון רבים|אתם|רבים|unspecified|neutral|non-?binary)$/i.test(
      t
    )
  ) {
    return 'unspecified';
  }
  return null;
}

export function parseMaritalPhrase(
  raw: string
): { maritalStatus: MaritalStatus; includeSpouse?: boolean; label?: string } | null {
  const t = raw.trim();
  // גרוש/ה עם ילדים וכו'
  if (/גרוש|גרושה|divorced|divorcé/i.test(t)) {
    return { maritalStatus: 'divorced', includeSpouse: false, label: 'גרוש/ה' };
  }
  if (/אלמן|אלמנה|widow|widower/i.test(t)) {
    return { maritalStatus: 'widowed', includeSpouse: false, label: 'אלמן/ה' };
  }
  if (/רווק|רווקה|single|לא נשוי|לא נשואה/i.test(t)) {
    return { maritalStatus: 'single', includeSpouse: false, label: 'רווק/ה' };
  }
  if (/נשוי|נשואה|married|ביחד|משותף|שותפ/i.test(t)) {
    const joint = /ביחד|משותף|שותפ|יחד|joint/i.test(t);
    const alone = /רק שלי|בנפרד|לבד|separate|alone/i.test(t);
    return {
      maritalStatus: 'married',
      includeSpouse: alone ? false : joint ? true : true,
      label: joint || !alone ? 'נשוי/אה — ביחד' : 'נשוי/אה — בנפרד',
    };
  }
  return null;
}

export function parseRatePhrase(raw: string): MaaserRate | null {
  const t = raw.trim();
  if (/חומש|20\s*%|עשרים|חוֹ?מש/i.test(t)) return 0.2;
  if (/מעשר|10\s*%|עשר אחוז|עשירית/i.test(t) && !/חומש|20/.test(t)) return 0.1;
  const m = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
  if (m) {
    const n = Number(String(m[1]).replace(',', '.'));
    if (Number.isFinite(n) && n >= 1 && n <= 50) return n / 100;
  }
  return null;
}

function isRealQuestion(raw: string): boolean {
  const t = raw.trim();
  if (t.includes('?') && !isRateExplainPhrase(t)) return true;

  if (
    /^(מה זה|מה המין|מה המגדר|מי אתה|מי את\b|מי זה|איך עובד|למה |האם |כמה |ספר לי|תסביר)/.test(t)
  ) {
    return true;
  }

  if (/מעשר|חומש|סעיף ?46|אפליקצ|חובה/.test(t) && t.split(/\s+/).length >= 2) {
    return true;
  }

  if (/מין|בן או בת|גבר או אישה|אתה בן|אתה גבר/.test(t)) return true;

  if (/מלאכותי|בוט|מודל|GPT|Llama|בינה/.test(t)) return true;

  return false;
}

function questionReply(raw: string): string {
  if (/מין|בן או בת|גבר או אישה|אתה בן|אתה גבר|את בת/.test(raw)) {
    return `בן. גבר — קוראים לי ${BOT_NAME}, העוזר ה-AI של מעשר ישר. עכשיו חזרה אליך: איך קוראים לך?`;
  }
  if (
    /מי אתה|מי את\b|מי זה נועם|בן אדם|מלאכותי|בוט|AI|בינה|מודל|GPT|Llama|llama/i.test(
      raw
    )
  ) {
    return `${NOAM_AI_DISCLOSURE_FIRST_PERSON} איך קוראים לך?`;
  }
  if (/חובה/.test(raw)) {
    return `חובה = כמה צריך לתת החודש לפי המעשר/חומש מהנטו. נחשב יחד בפנקס. קודם — שם פרטי?`;
  }
  if (/חומש|20%/.test(raw)) {
    return `חומש זה 20% — מידת חסידות. רוב האנשים על מעשר 10%. עוד רגע אפשר לבחור. בינתיים — שם פרטי?`;
  }
  if (/מעשר|10%/.test(raw)) {
    return `מעשר קלאסי = עשירית מהנטו (אחרי מסים). זו החובה שנסכם בפנקס. קודם — איך לקרוא לך?`;
  }
  return `אני ${BOT_NAME}, העוזר ה-AI של מעשר ישר. מעשר = בדרך כלל 10% מהנטו לצדקה; חומש = 20%. אפשר לשאול עוד — וגם לזרוק שם פרטי כדי שנתחיל.`;
}

/** זיהוי מקומי בלבד — בלי קריאת רשת. מקור האמת להיכרות. */
export function localOnboardParse(text: string): OnboardResult {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  if (isSkipName(raw)) {
    return {
      intent: 'skip_name',
      name: null,
      reply: '',
    };
  }

  const extracted = extractNameFromText(raw);
  if (extracted && !isRealQuestion(raw)) {
    return { intent: 'name', name: extracted, reply: '' };
  }

  if (isRealQuestion(raw)) {
    return { intent: 'question', name: null, reply: questionReply(raw) };
  }

  const letters = raw.replace(/[\s\-']/g, '');
  const onlyJunk = !/[a-zA-Z\u0590-\u05FF]{2,}/.test(raw);
  const keyboardSmash = /^(asdf|qwer|zxcv|שדגכ|חחח+|lol+|xxx+|test+|aaa+)$/i.test(lower);

  if (onlyJunk || keyboardSmash || letters.length < 2) {
    return {
      intent: 'gibberish',
      name: null,
      reply: `רגע, זה לא נשמע כמו שם 😅 אפשר שם פרטי אמיתי — או במפורש בלי שם.`,
    };
  }

  if (extracted) {
    return { intent: 'name', name: extracted, reply: '' };
  }

  return {
    intent: 'gibberish',
    name: null,
    reply: `שם פרטי מספיק — קצר ופשוט. או בלי שם אם מעדיפים.`,
  };
}

/**
 * פרסור לפי שלב ההיכרות (N-15 + M19).
 * דילוג כללי → skip_step; «מעדיפים לא לומר» במגדר → gender=unspecified.
 */
export function parseOnboardStep(step: number, text: string): OnboardResult {
  const raw = text.trim();

  if (step === 0) {
    return localOnboardParse(raw);
  }

  if (isRateExplainPhrase(raw) && step >= 3) {
    return { intent: 'rate_explain', name: null, reply: '' };
  }

  if (step === 1) {
    const g = parseGenderPhrase(raw);
    if (g) {
      return { intent: 'gender', name: null, reply: '', gender: g };
    }
  }

  if (step === 2) {
    const m = parseMaritalPhrase(raw);
    if (m) {
      return {
        intent: 'marital',
        name: null,
        reply: '',
        maritalStatus: m.maritalStatus,
        includeSpouse: m.includeSpouse,
      };
    }
  }

  if (step === 3) {
    const rate = parseRatePhrase(raw);
    if (rate != null) {
      return { intent: 'rate', name: null, reply: '', rate };
    }
  }

  /** סירוב/דילוג כללי — אחרי ניסיון לפרסר בחירה מפורשת */
  if (isSkipPhrase(raw)) {
    return { intent: 'skip_step', name: null, reply: '' };
  }

  if (isRealQuestion(raw) || isRateExplainPhrase(raw)) {
    if (isRateExplainPhrase(raw)) {
      return { intent: 'rate_explain', name: null, reply: '' };
    }
    return {
      intent: 'question',
      name: null,
      reply:
        'שאלה טובה. אפשר גם לבחור מהכפתורים למטה — זה הכי מדויק. או לדלג.',
    };
  }

  return {
    intent: 'other',
    name: null,
    reply: 'קיבלתי. אפשר לבחור מהכפתורים למטה — או לדלג על השלב.',
  };
}

/** המשך אחרי דילוג על שם — פנייה ניטרלית עד בחירת מגדר (N-14) */
export function skipNameContinue(_g?: Gender): string {
  return `סבבה, ממשיכים בלי שם. אפשר לעדכן בהגדרות מתי שרוצים.\n\nעכשיו שאלה קטנה…`;
}
