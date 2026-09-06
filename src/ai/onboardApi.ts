import { Platform } from 'react-native';
import { BOT_NAME, t, type Gender } from '../utils/copy';

export type OnboardIntent = 'name' | 'skip_name' | 'gibberish' | 'question' | 'other';

export type OnboardResult = {
  intent: OnboardIntent;
  name: string | null;
  reply: string;
};

function onboardEndpoint(): string {
  const fromEnv = process.env.EXPO_PUBLIC_ONBOARD_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/.netlify/functions/onboard`;
  }
  return 'https://maaser-yashar.netlify.app/.netlify/functions/onboard';
}

/** זיהוי מקומי מהיר — גיבוי אם ה־API נפל */
export function localOnboardParse(text: string): OnboardResult {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  const skip =
    /^(בלי שם|ללא שם|אנונימי|לא רוצה( לתת שם)?|תדלג|דלג על השם|אין לי שם|prefer not|skip( name)?|no name)$/i.test(
      raw
    ) ||
    /לא (רוצה|מעוניין|מעוניינת) (למסור|לתת) שם/.test(raw) ||
    /אפשר בלי שם/.test(raw);

  if (skip) {
    return {
      intent: 'skip_name',
      name: null,
      reply: `לגמרי מקובל. בלי שם החוויה פחות אישית — אבל ממשיכים יחד בכיף. אני ${BOT_NAME} 💚`,
    };
  }

  const looksQuestion =
    raw.includes('?') ||
    /^(מה|מי|איך|למה|האם|כמה|מה זה|ספר|תסביר)/.test(raw) ||
    /מעשר|חומש|סעיף|אפליקצ|מי אתה|מי את/.test(raw);

  if (looksQuestion && raw.length > 8) {
    let reply = `אני ${BOT_NAME}. מעשר = בדרך כלל 10% מהנטו לצדקה; חומש = 20%. אפשר לשאול עוד — וגם לזרוק שם פרטי כדי שנתחיל.`;
    if (/מי אתה|מי את|מי זה נועם/.test(raw)) {
      reply = `אני ${BOT_NAME} — החבר שלך למעשר. בלי דרשות, עם מספרים. איך קוראים לך?`;
    } else if (/חומש|20%/.test(raw)) {
      reply = `חומש זה 20% — מידת חסידות. רוב האנשים על מעשר 10%. עוד רגע תבחר/י. בינתיים — שם פרטי?`;
    } else if (/מעשר|10%/.test(raw)) {
      reply = `מעשר קלאסי = עשירית מהנטו (אחרי מסים). נחשב יחד בפנקס. קודם — איך לקרוא לך?`;
    }
    return { intent: 'question', name: null, reply };
  }

  // חרטוט בסיסי
  const letters = raw.replace(/[\s\-']/g, '');
  const onlyJunk = !/[a-zA-Z\u0590-\u05FF]{2,}/.test(raw);
  const repeated = /(.)\1{3,}/.test(letters);
  const noVowelsHeb =
    /^[\u05D0-\u05EA]{3,}$/.test(letters) &&
    !/[אעיהו]/.test(letters) &&
    letters.length >= 5;
  const keyboardSmash = /^(asdf|qwer|zxcv|שדגכ|חחח+|lol+|xxx+|test+|aaa+)$/i.test(lower);
  const tooLongSentence = raw.split(/\s+/).length > 4 && !looksQuestion;

  if (onlyJunk || repeated || keyboardSmash || noVowelsHeb || tooLongSentence || letters.length < 2) {
    return {
      intent: 'gibberish',
      name: null,
      reply: `רגע, זה לא נשמע לי כמו שם 😅 זרוק שם פרטי אמיתי — או תגיד במפורש «בלי שם».`,
    };
  }

  if (letters.length > 20) {
    return {
      intent: 'gibberish',
      name: null,
      reply: `שם פרטי מספיק — קצר ופשוט. או «בלי שם» אם מעדיפים.`,
    };
  }

  const cleaned = raw.replace(/[^\u0590-\u05FFa-zA-Z\s\-']/g, '').trim();
  const first = cleaned.split(/\s+/)[0] || cleaned;
  if (first.length < 2) {
    return {
      intent: 'gibberish',
      name: null,
      reply: `צריך שם קצר (לפחות שני תווים) — או במפורש «בלי שם».`,
    };
  }

  return {
    intent: 'name',
    name: first.slice(0, 20),
    reply: '',
  };
}

export async function askOnboardAi(opts: {
  text: string;
  step: number;
  knownName?: string;
}): Promise<OnboardResult> {
  try {
    const res = await fetch(onboardEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: opts.text,
        step: opts.step,
        knownName: opts.knownName || '',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'fail');

    const intent = data.intent as OnboardIntent;
    if (!['name', 'skip_name', 'gibberish', 'question', 'other'].includes(intent)) {
      throw new Error('bad intent');
    }
    return {
      intent,
      name: typeof data.name === 'string' ? data.name : null,
      reply: String(data.reply || '').trim(),
    };
  } catch {
    return localOnboardParse(opts.text);
  }
}

export function afterValidNameAi(name: string, genderJoke: string): string {
  return `${name}! שם יפה — נרשם ✦\n${genderJoke}`;
}

export function skipNameContinue(g: Gender): string {
  return t(
    g,
    `סבבה, ממשיכים בלי שם. אני אקרא לך «חבר» בינתיים — אפשר לשנות בהגדרות.\n\nעכשיו שאלה קטנה…`,
    `סבבה, ממשיכות בלי שם. אני אקרא לך «חברה» בינתיים — אפשר לשנות בהגדרות.\n\nעכשיו שאלה קטנה…`
  );
}
