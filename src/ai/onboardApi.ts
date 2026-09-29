import { BOT_NAME, t, type Gender } from '../utils/copy';
import { NOAM_AI_DISCLOSURE_FIRST_PERSON } from '../constants/noamDisclosure';

export type OnboardIntent = 'name' | 'skip_name' | 'gibberish' | 'question' | 'other';

export type OnboardResult = {
  intent: OnboardIntent;
  name: string | null;
  reply: string;
};

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
  // חרטוט עברי בלי אותיות יסוד — רק אם ארוך יחסית
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

  // שם בודד או שם פרטי + משפחה (לוקחים את הראשון)
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

function isRealQuestion(raw: string): boolean {
  const t = raw.trim();
  if (t.includes('?')) return true;

  // שאלות אמיתיות — לא שמות שמתחילים ב־מי (מיכאל, מיכל…)
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
    return `בן. גבר — קוראים לי ${BOT_NAME}, העוזר ה-AI של מעשר ישר. עכשיו חזרה אלייך: איך קוראים לך?`;
  }
  // N-04 / T-05: תשובה קבועה לשאלות זהות / בוט / מודל
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
    return `חומש זה 20% — מידת חסידות. רוב האנשים על מעשר 10%. עוד רגע תבחר. בינתיים — שם פרטי?`;
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

  // קודם שם — כדי שמיכאל / שמי דני לא ייפלו לשאלות
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
      reply: `רגע, זה לא נשמע לי כמו שם 😅 זרוק שם פרטי אמיתי — או תגיד במפורש בלי שם.`,
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

export function skipNameContinue(g: Gender): string {
  return t(
    g,
    `סבבה, ממשיכים בלי שם. אני אקרא לך חבר בינתיים — אפשר לשנות בהגדרות.\n\nעכשיו שאלה קטנה…`,
    `סבבה, ממשיכות בלי שם. אני אקרא לך חברה בינתיים — אפשר לשנות בהגדרות.\n\nעכשיו שאלה קטנה…`
  );
}
