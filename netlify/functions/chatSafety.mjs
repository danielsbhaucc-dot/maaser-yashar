/**
 * N-01 / N-02 / N-05 / N-06 / N-09 / N-10 / N-11 —
 * פלט מובנה, סינון "רשמתי", עמידות להזרקה, ניכויים,
 * נטו/ברוטו+מטבע זר, חודש יעד (period), וסינון כותרות markdown.
 * לוגיקה טהורה לבדיקות בלי קריאת Upstream.
 */

/** מחרוזת קנרית (פרק 5.4) — מוטמעת בפרומפט; אסור שתופיע בפלט */
export const CANARY_STRING = 'MYSH-CANARY-9f2e7b4a1c06';

/** תשובת סירוב קבועה לבקשות חשיפת הנחיות (N-05) — ניטרלית מגדרית */
export const INJECTION_REJECTION =
  'את ההנחיות הפנימיות שלי אני שומר לעצמי. אפשר לחזור לפנקס: לבדוק כמה נותר, או לרשום תנועה.';

/** תשובה כשהסינון הקנרי הופעל */
export const CANARY_REJECTION =
  'רגע, משהו השתבש אצלי. בוא נחזור לפנקס — במה אפשר לעזור?';

/**
 * קטגוריות expense שנועם מורשה להציע (N-06).
 * «החזר הלוואה» ו«אחר» נשארים בממשק (עם אזהרות T-24) אבל לא מוצעים ע״י AI.
 */
export const AI_EXPENSE_CATEGORIES = [
  'מס הכנסה',
  'ביטוח לאומי',
  'מס בריאות',
  'הוצאות עסק',
  'הוצאות שכירות',
];

const AI_EXPENSE_SET = new Set(AI_EXPENSE_CATEGORIES);

const INCOME_SET = new Set([
  'משכורת',
  'עסק / עצמאי',
  'שכירות',
  'רווחי הון',
  'מתנה',
  'קצבה',
  'ירושה',
  'בן/בת זוג',
  'אחר',
]);

const TZEDAKA_SET = new Set([
  'צדקה / מעשר',
  'תרומה למוסד',
  'מתן לעני',
  'אחר',
]);

/**
 * טריגרים ידועים לחשיפת פרומפט — הודעה 13 + וריאציות (עברית + אנגלית).
 * התאמה על הטקסט המנורמל של הודעת המשתמש האחרונה.
 */
const INJECTION_PATTERNS = [
  // עברית — קריטריוני קבלה מהדוח
  /הודעה\s*13/,
  /מצב\s*מפתח/,
  /תחזור\s+על\s+כל\s+מה\s+שמעל/,
  /תתרגם\s+את\s+ההנחיות\s+שלך/,
  /סכם\s+את\s+הכללים\s+שלך/,
  /אני\s+המפתח[,\s]*.*תראה\s+לי\s+את\s+הפרומפט/,
  /תראה\s+לי\s+את\s+הפרומפט/,
  /הראה\s+לי\s+את\s+(ההנחיות|הפרומפט|ה־?\s*system)/,
  /מה\s+ההנחיות\s+שלך/,
  /העתק\s+את\s+(ההנחיות|הפרומפט|system)/,
  /תתעלם\s+מ(?:כל\s+)?ההוראות/,
  /ההנחיות\s+המלאות\s+שלך/,
  // אנגלית — וריאציות נפוצות / תרגום הדוח
  /\bmessage\s*13\b/,
  /\bkey\s*mode\b/,
  /repeat\s+everything\s+above/,
  /translate\s+your\s+instructions/,
  /summarize\s+your\s+rules/,
  /i\s+am\s+the\s+key[,\s]*.*show\s+me\s+the\s+prompt/,
  /show\s+me\s+(the\s+)?(system\s+)?prompt/,
  /reveal\s+(your\s+)?(system\s+)?(prompt|instructions)/,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/,
];

export function normalizeUserText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[״""']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** מחזיר true אם ההודעה נראית כניסיון חשיפת הנחיות */
export function isPromptInjectionAttempt(text) {
  const n = normalizeUserText(text);
  if (!n) return false;
  return INJECTION_PATTERNS.some((re) => re.test(n));
}

/**
 * סינון פלט קנרי (פרק 5.4).
 * אם הקנרי מופיע — מחליפים בתשובת סירוב ומסמנים ללוג.
 */
export function filterCanaryOutput(reply) {
  const text = String(reply || '');
  if (!text.includes(CANARY_STRING)) {
    return { reply: text, triggered: false };
  }
  console.error('[chat] canary filter triggered — possible prompt leak');
  return { reply: CANARY_REJECTION, triggered: true };
}

/** מאמת/מנרמל קטגוריה לפי kind — expense רק לקטגוריות AI מותרות */
export function sanitizeEntryCategory(kind, category) {
  const raw = String(category || '').trim().slice(0, 40);
  if (kind === 'expense') {
    if (AI_EXPENSE_SET.has(raw)) return raw;
    return null;
  }
  if (kind === 'income') {
    return INCOME_SET.has(raw) ? raw : 'אחר';
  }
  if (kind === 'tzedaka') {
    return TZEDAKA_SET.has(raw) ? raw : 'אחר';
  }
  return null;
}

/** N-10 — תקופת יעד YYYY-MM; ריק/לא־תקין = בלי שדה (חודש נוכחי בצד הלקוח) */
export function sanitizePeriod(period) {
  const raw = typeof period === 'string' ? period.trim() : '';
  if (!raw) return '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return '';
  return raw;
}

/**
 * N-01 — מאמת כל action לפני החזרה ללקוח.
 * בלי חובה/נותר, בלי סכום ≤0 / ≥1e8; expense רק בקטגוריות AI מותרות (N-06).
 * period אופציונלי (N-10 / T-13).
 */
export function validActions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const a of raw) {
    if (out.length >= 3) break;
    if (!a || a.type !== 'add_entry') continue;
    if (!['income', 'expense', 'tzedaka'].includes(a.kind)) continue;
    const amount = Math.round(Number(a.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e8) continue;
    const category = sanitizeEntryCategory(a.kind, a.category);
    if (!category) {
      if (a.kind === 'expense') {
        console.warn(
          '[chat] dropped expense action — category not AI-allowed:',
          a.category
        );
      }
      continue;
    }
    const note = typeof a.note === 'string' ? a.note.slice(0, 80) : '';
    const period = sanitizePeriod(a.period);
    const entry = { type: 'add_entry', kind: a.kind, category, amount, note };
    if (period) entry.period = period;
    out.push(entry);
  }
  return out;
}

/** מסנן רשימת פעולות — מעטפת ל־validActions (N-01 + N-06) */
export function filterActions(actions) {
  return validActions(actions);
}

/** N-02 — מסיר משפטים שטוענים שהתנועה כבר נרשמה; הכרטיס שואל "להוסיף לפנקס?" */
const SAVE_CLAIM =
  /[^.!?\n]*[.,!?;]?(רשמתי|נרשם|שמרתי|הוספתי לפנקס|יעבור לפנקס|ייעבור לפנקס|עודכן בפנקס)[^.!?\n]*[.,!?;]?/g;

export function stripSaveClaims(text) {
  const cleaned = String(text || '')
    .replace(SAVE_CLAIM, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || 'להוסיף לפנקס? אשר בכפתור למטה';
}

/**
 * N-11 — מסיר כותרות markdown (### וכו') מתחילת שורות.
 * גיבוי לפרומפט שאוסר כותרות.
 */
export function stripMarkdownHeadings(text) {
  return String(text || '')
    .replace(/^#{1,6}[ \t]*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** האם התשובה שואלת הבהרה במקום להציע כרטיס (N-09 / N-10) */
export function isEntryClarifyingQuestion(text) {
  const t = String(text || '');
  return (
    /נטו\s*או\s*ברוטו|נטו\s*\/\s*ברוטו|ברוטו\s*או\s*נטו/.test(t) ||
    /מה\s+השער|איזה\s+שער|שער\s+ההמרה|שער\s+ל־?₪|שער\s+לשקל/.test(t) ||
    /רק\s+לחודש\s+הנוכחי|לחודש\s+הזה\s+או\s+שנחכה|לאיזה\s+חודש\s+לרשום/.test(t)
  );
}

/** האם הטקסט מציע תנועה בלי actions מובנים (N-01 retry) */
export function textSuggestsEntry(text) {
  const t = String(text || '');
  // N-09/N-10: שאלת הבהרה לא אמורה להפעיל retry שמוסיף כרטיס
  if (isEntryClarifyingQuestion(t)) return false;
  if (/אני מציע|מציע לרשום|להוסיף לפנקס|תרשום|בואו נרשום|בוא נרשום/.test(t)) {
    return true;
  }
  const hasAmount =
    /\d[\d,]{1,}(?:\.\d+)?\s*₪|₪\s*\d[\d,]{1,}|\b\d{3,}\b/.test(t);
  const hasKindWord =
    /(משכורת|הכנסה|תרמ|צדקה|תרומ|הוצא|ניכוי|קיבלתי|נתתי)/.test(t);
  return hasAmount && hasKindWord;
}

const NET_GROSS_RE = /נטו|ברוטו|\bnet\b|\bgross\b/i;
const FOREIGN_CURRENCY_RE =
  /דולר|\$|USD|€|EUR|יורו|אירו|ליש.?ט|GBP|£|פרנק|ין\b|JPY|CAD|AUD/i;
const EXCHANGE_RATE_RE =
  /שער\s*[:=\-]?\s*\d|(?:שער|המרה)\s+\d|\d([.,]\d+)?\s*(?:₪|ש["״]?ח)?\s*(?:לדולר|ליורו|ל־?\$|ל־?USD)|(?:×|x)\s*\d/i;
const PRIOR_MONTH_RE =
  /חודש\s+שעבר|בחודש\s+(?:ה)?קודם|לחודש\s+שעבר|בחודש\s+שעבר|החודש\s+שעבר|לפני\s+חודש|חודש\s+קודם/;

export const NET_GROSS_CLARIFY =
  'נטו או ברוטו? אחרי שתענה אוכל להציע רישום לפנקס.';
export const NET_GROSS_CLARIFY_EN =
  'Is that net or gross? Once you tell me, I can suggest adding it to the ledger.';
export const FX_CLARIFY =
  'מה שער ההמרה ל־₪, וזה נטו או ברוטו? אחרי שתענה אציע רישום בשקלים.';
export const PRIOR_MONTH_NEED_PERIOD =
  'לאיזה חודש לרשום בדיוק? אחרי שתאשר אוכל להציע כרטיס עם «נרשם ל» לחודש הזה.';
/** כשיש כוונת חודש קודם בלי סכום/סוג */
export const PRIOR_MONTH_NEED_AMOUNT =
  'לאיזה סכום, ולאיזה חודש לרשום?';

/** תווית כפתור ההגדרות להורדת .ics (SettingsScreen) */
export const SETTINGS_ICS_BUTTON_LABEL = 'הוסף תזכורת חודשית ✦';

export const REMINDER_REPLY_HE =
  `אין לי אפשרות לשלוח תזכורות. אפשר להוסיף תזכורת חודשית ליומן דרך הגדרות ← «${SETTINGS_ICS_BUTTON_LABEL}» (קובץ יומן). אפשר גם לפתוח את האפליקציה בתחילת חודש: יופיע שם תזכורת לסגור את החודש.`;

export const REMINDER_REPLY_EN =
  `I can't send reminders. You can add a monthly calendar reminder via Settings ← «${SETTINGS_ICS_BUTTON_LABEL}» (calendar file). You can also open the app at the start of a month — a reminder to close the month will appear there.`;

export const MODEL_IDENTITY_REPLY =
  'אני נועם, העוזר ה-AI של מעשר ישר. אני פועל באמצעות שירות בינה מלאכותית חיצוני (OpenRouter), ואני לא יודע לומר איזה מודל בדיוק. אני יכול לטעות, ואני לא רב.';

export const OFF_TOPIC_CREATIVE_REPLY =
  'אני כאן בשביל הפנקס של מעשר ישר. אפשר לבדוק כמה נותר לתת החודש, או לרשום הכנסה או תרומה.';

/** מילים שבורות ידועות — ניתן להרחיב */
export const BROKEN_HEBREW_WORDS = {
  הכנסיה: 'הכנסה',
  אזכורת: 'תזכורת',
  אזכרת: 'תזכורת',
  תרימה: 'תרומה',
};

export const HEBREW_MONTH_NAMES = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export function formatPeriodHe(period) {
  const raw = String(period || '');
  const m = raw.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) return raw;
  const year = m[1];
  const idx = Number(m[2]) - 1;
  return `${HEBREW_MONTH_NAMES[idx]} ${year}`;
}

export function priorMonthProposalReply(period) {
  return `מציע לרשום ל: ${formatPeriodHe(period)}. אפשר לאשר בכרטיס.`;
}

export function isMostlyEnglish(text) {
  const s = String(text || '');
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  const hebrew = (s.match(/[\u0590-\u05FF]/g) || []).length;
  return latin > 0 && latin >= hebrew;
}

function jerusalemParts(now) {
  const d = now instanceof Date ? now : new Date(now);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  };
}

function periodFromYm(y, m) {
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function isFuturePeriod(period, nowParts) {
  const m = String(period).match(/^(\d{4})-(\d{2})$/);
  if (!m) return true;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (y > nowParts.year) return true;
  if (y === nowParts.year && mo > nowParts.month) return true;
  return false;
}

const MONTH_NAME_RE =
  /(?:^|[\s,])(?:ב)?(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?:\s+(\d{4}))?/i;

/**
 * מחלץ חודש יעד מהודעת משתמש → 'YYYY-MM' | null.
 * חודשים עתידיים נדחים.
 */
export function resolveTargetPeriod(lastUserMessage, now = new Date(), _tz = 'Asia/Jerusalem') {
  const text = String(lastUserMessage || '');
  const nowParts = jerusalemParts(now);

  if (
    /חודש\s+שעבר|בחודש\s+שעבר|לחודש\s+שעבר|החודש\s+הקודם|בחודש\s+(?:ה)?קודם|לחודש\s+(?:ה)?קודם|החודש\s+שעבר|לפני\s+חודש|חודש\s+קודם/.test(
      text
    )
  ) {
    let y = nowParts.year;
    let m = nowParts.month - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    return periodFromYm(y, m);
  }

  const named = text.match(MONTH_NAME_RE);
  if (named) {
    const name = named[1];
    const idx = HEBREW_MONTH_NAMES.indexOf(name);
    if (idx >= 0) {
      const month = idx + 1;
      const year = named[2] ? Number(named[2]) : nowParts.year;
      const period = periodFromYm(year, month);
      if (!period || isFuturePeriod(period, nowParts)) return null;
      return period;
    }
  }

  return null;
}

/**
 * כוונות מיוחדות לפני קריאת מודל — חוסך כסף ומבטיח נוסח קבוע.
 * @returns {null|{id:string,reply:string}}
 */
export function detectSpecialIntent(lastUserMessage, ctx) {
  const raw = String(lastUserMessage || '').trim();
  if (!raw) return null;
  const n = normalizeUserText(raw);

  // שלילת false-positive: «אני רוצה להזכיר שקיבלתי…»
  const reminderFalse =
    /רוצה\s+להזכיר\s+ש/.test(n) || /להזכיר\s+ש(?:קיבל|נתת|יש|ש)/.test(n);

  const reminderAsk =
    /תזכיר(?:י)?\s+לי/.test(n) ||
    /הזכר\s+לי/.test(n) ||
    /תזכירי\s+לי/.test(n) ||
    /(?:^|[\s,.'"?!])תזכורת(?:$|[\s,.'"?!])/.test(n) ||
    /(?:^|[\s,.'"?!])להזכיר(?:$|[\s,.'"?!])/.test(n) ||
    /\bremind\s+me\b/.test(n) ||
    /\bnotify\s+me\b/.test(n) ||
    /\breminder\b/.test(n);

  if (reminderAsk && !reminderFalse) {
    return {
      id: 'reminder',
      reply: isMostlyEnglish(raw) ? REMINDER_REPLY_EN : REMINDER_REPLY_HE,
    };
  }

  // מודל / חברה
  if (
    /איזה\s+מודל/.test(n) ||
    /על\s+מה\s+אתה\s+רץ/.test(n) ||
    /which\s+model/.test(n) ||
    /what\s+model/.test(n) ||
    /are\s+you\s+gpt/.test(n) ||
    /(?:^|[\s?])(?:gpt|llama|claude)\s*\??\s*$/i.test(n) ||
    /אתה\s+(?:gpt|llama|claude)/i.test(n) ||
    /\bgpt\??\s*$/i.test(n) ||
    /\bllama\b/i.test(n)
  ) {
    return { id: 'model', reply: MODEL_IDENTITY_REPLY };
  }

  // יצירתי מחוץ לנושא (גבולות «מילה» בעברית בלי \b)
  const creativeHe =
    /(?:^|[^\u0590-\u05FF])(שיר|שירון|בדיחה|מתכון|סיפור)(?=[^\u0590-\u05FF]|$)/.test(
      n
    ) || /תכתוב(?:י)?\s+לי\s+שיר/.test(n);
  const creativeEn =
    /\b(?:poem|joke)\b/.test(n) || /write\s+me\s+a\s+song/.test(n);
  if (creativeHe || creativeEn) {
    return { id: 'off_topic', reply: OFF_TOPIC_CREATIVE_REPLY };
  }

  const calc = detectMaaserCalcIntent(raw, ctx);
  if (calc) return calc;

  return null;
}

/**
 * «כמה מעשר על X?» / how much maaser on X — תשובה דטרמיניסטית + שאלת נטו/ברוטו.
 */
export function detectMaaserCalcIntent(lastUserMessage, ctx) {
  const raw = String(lastUserMessage || '');
  const n = normalizeUserText(raw);
  const asksCalc =
    /(?:כמה|what(?:'s| is)?|how\s+much).{0,40}(?:מעשר|חומש|maaser|tithe)/.test(n) ||
    /(?:מעשר|חומש|maaser).{0,40}(?:כמה|how\s+much|on\s+\d)/.test(n) ||
    /how\s+much\s+maaser/.test(n);
  if (!asksCalc) return null;
  if (/\bnet\b|\bgross\b|נטו|ברוטו/.test(n)) return null;

  const amountMatch = raw.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!amountMatch) return null;
  const amount = Number(String(amountMatch[1]).replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const rate =
    ctx && typeof ctx.rate === 'number' && ctx.rate >= 0.01 && ctx.rate <= 0.5
      ? ctx.rate
      : 0.1;
  const result = Math.round(amount * rate * 100) / 100;
  const ratePct = Math.round(rate * 1000) / 10;
  const rateLabel =
    Math.abs(rate - 0.1) < 1e-9
      ? 'מעשר'
      : Math.abs(rate - 0.2) < 1e-9
        ? 'חומש'
        : `${ratePct}%`;

  const fmt = (v) => {
    const rounded = Math.round(v * 100) / 100;
    return Number.isInteger(rounded)
      ? rounded.toLocaleString('en-US')
      : rounded.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
  };

  const eng = isMostlyEnglish(raw);
  if (eng) {
    const label =
      Math.abs(rate - 0.1) < 1e-9
        ? 'Maaser'
        : Math.abs(rate - 0.2) < 1e-9
          ? 'Chomesh'
          : `${ratePct}%`;
    return {
      id: 'maaser_calc',
      reply: `${label} at ${ratePct}% of a net amount of ₪${fmt(amount)} is ₪${fmt(result)}. Is ${fmt(amount)} net or gross?`,
    };
  }
  return {
    id: 'maaser_calc',
    reply: `${rateLabel} על סכום נטו של ₪${fmt(amount)} הוא ₪${fmt(result)}. האם ${fmt(amount)} נטו או ברוטו?`,
  };
}
function userContents(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && m.role === 'user' && typeof m.content === 'string')
    .map((m) => m.content);
}

export function conversationStatesNetOrGross(messages) {
  return NET_GROSS_RE.test(userContents(messages).join('\n'));
}

export function conversationHasForeignCurrency(messages) {
  return FOREIGN_CURRENCY_RE.test(userContents(messages).join('\n'));
}

export function conversationHasExchangeRate(messages) {
  return EXCHANGE_RATE_RE.test(userContents(messages).join('\n'));
}

export function lastUserMentionsPriorMonth(messages) {
  const users = userContents(messages);
  const last = users[users.length - 1] || '';
  return PRIOR_MONTH_RE.test(last);
}

/**
 * N-09 / N-10 — מסיר כרטיס כשחסרה הבהרה (נטו/ברוטו, שער, או period לחודש קודם).
 * מחזיר { actions, reason } — reason לתיקון reply בשרת.
 */
export function gateProposedActions(actions, messages) {
  const list = Array.isArray(actions) ? actions : [];
  if (!list.length) return { actions: [], reason: null };

  if (list.some((a) => a.kind === 'income')) {
    if (
      conversationHasForeignCurrency(messages) &&
      !conversationHasExchangeRate(messages)
    ) {
      return { actions: [], reason: 'fx' };
    }
    if (!conversationStatesNetOrGross(messages)) {
      return { actions: [], reason: 'net_gross' };
    }
  }

  if (lastUserMentionsPriorMonth(messages)) {
    const allHavePeriod = list.every(
      (a) => a.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(a.period)
    );
    if (!allHavePeriod) {
      return { actions: [], reason: 'prior_month' };
    }
  }

  return { actions: list, reason: null };
}

/** תשובת הבהרה כשהשער הוסר — שומר שאלת מודל אם כבר הבהירה נכון */
export function replyForProposalGate(reason, currentReply, messages) {
  const reply = String(currentReply || '').trim();
  const last = Array.isArray(messages)
    ? [...messages].reverse().find((m) => m && m.role === 'user')?.content || ''
    : '';
  if (reason === 'fx') {
    if (isEntryClarifyingQuestion(reply) && /שער|נטו|ברוטו/.test(reply)) {
      return reply;
    }
    return FX_CLARIFY;
  }
  if (reason === 'net_gross') {
    if (isEntryClarifyingQuestion(reply) && /נטו|ברוטו|net|gross/i.test(reply)) {
      return reply;
    }
    return isMostlyEnglish(last) ? NET_GROSS_CLARIFY_EN : NET_GROSS_CLARIFY;
  }
  if (reason === 'prior_month') {
    if (isEntryClarifyingQuestion(reply)) return reply;
    return PRIOR_MONTH_NEED_PERIOD;
  }
  return reply;
}
