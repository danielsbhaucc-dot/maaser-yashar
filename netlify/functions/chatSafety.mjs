/**
 * N-01 / N-02 / N-05 / N-06 / N-09 / N-10 / N-11 —
 * פלט מובנה, סינון "רשמתי", עמידות להזרקה, ניכויים,
 * נטו/ברוטו+מטבע זר, חודש יעד (period), וסינון כותרות markdown.
 * לוגיקה טהורה לבדיקות בלי קריאת Upstream.
 */

/** מחרוזת קנרית (פרק 5.4) — מוטמעת בפרומפט; אסור שתופיע בפלט */
export const CANARY_STRING = 'MYSH-CANARY-9f2e7b4a1c06';

/** תשובת סירוב קבועה לבקשות חשיפת הנחיות (N-05) */
export const INJECTION_REJECTION =
  'אני לא משתף את ההנחיות הפנימיות שלי. בוא נחזור לפנקס — במה אפשר לעזור עם מעשר או רישום?';

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
export const FX_CLARIFY =
  'מה שער ההמרה ל־₪, וזה נטו או ברוטו? אחרי שתענה אציע רישום בשקלים.';
export const PRIOR_MONTH_NEED_PERIOD =
  'לאיזה חודש לרשום בדיוק? אחרי שתאשר אוכל להציע כרטיס עם «נרשם ל» לחודש הזה.';

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
export function replyForProposalGate(reason, currentReply) {
  const reply = String(currentReply || '').trim();
  if (reason === 'fx') {
    if (isEntryClarifyingQuestion(reply) && /שער|נטו|ברוטו/.test(reply)) {
      return reply;
    }
    return FX_CLARIFY;
  }
  if (reason === 'net_gross') {
    if (isEntryClarifyingQuestion(reply) && /נטו|ברוטו/.test(reply)) {
      return reply;
    }
    return NET_GROSS_CLARIFY;
  }
  if (reason === 'prior_month') {
    if (isEntryClarifyingQuestion(reply)) return reply;
    return PRIOR_MONTH_NEED_PERIOD;
  }
  return reply;
}
