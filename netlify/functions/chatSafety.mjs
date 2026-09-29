/**
 * N-01 / N-02 / N-05 / N-06 / N-09 / N-10 / N-11 /
 * NEW-1 (confirmed), NEW-2 (negative), NEW-3 (intent gates) —
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

/**
 * NEW-2 / C-09 — זיהוי סכום שלילי בהודעת המשתמש.
 * מתאים: "מינוס 200", "200 מינוס", "-200", "−200 ₪", "מינוס הכנסה 50".
 * לא מתאים: "200-300", "3-4 ימים" (טווח / מספר ימים).
 */
export const NEGATIVE_AMOUNT_RE =
  /(?:(?:מינוס|שלילי|minus|negative)(?:\s+\S+){0,3}\s+[₪$]?\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:מינוס|שלילי|minus|negative)|(?:^|[\s,;:])[-−–]\s*[₪$]?\s*([\d,]+(?:\.\d+)?))/i;

/** מחזיר את הסכום החיובי מהודעה שלילית, או null אם אין התאמה */
export function detectNegativeAmount(text) {
  const m = String(text || '').match(NEGATIVE_AMOUNT_RE);
  if (!m) return null;
  const raw = m[1] || m[2] || m[3];
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** תשובת סירוב לסכום שלילי (D.2) — exact wording */
export function negativeAmountReply(amount) {
  const label = Number.isInteger(amount) ? String(amount) : String(amount);
  return `אי אפשר לרשום סכום שלילי. התכוונת לתרומה של ₪${label}, או לתקן או למחוק תנועה שכבר נרשמה? אם למחוק, אפשר לעשות את זה ישירות בפנקס.`;
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

/* ─── NEW-3 / C-03b: intent gates ─── */

/** מחלץ מספרים מהודעות משתמש (מתעלם מפסיקים, ₪, ש"ח) */
export function extractUserAmounts(messages, lastN = 4) {
  const users = userContents(messages).slice(-lastN);
  const amounts = new Set();
  for (const text of users) {
    const cleaned = String(text || '')
      .replace(/₪/g, ' ')
      .replace(/ש["״]?ח/g, ' ');
    for (const m of cleaned.matchAll(/(\d[\d,]*(?:\.\d+)?)/g)) {
      const n = Number(String(m[1]).replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) {
        amounts.add(Math.round(n * 100) / 100);
      }
    }
  }
  return amounts;
}

/** האם הסכום «מעוגן» בהודעות המשתמש (או תוצאת FX) */
export function isAmountGrounded(amount, messages) {
  const target = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(target) || target <= 0) return false;
  const nums = extractUserAmounts(messages, 4);
  if (nums.has(target)) return true;
  // FX: foreign × rate ≈ amount (סבילות 0.51)
  const arr = [...nums];
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      if (i === j) continue;
      const product = Math.round(arr[i] * arr[j] * 100) / 100;
      if (Math.abs(product - target) < 0.51) return true;
    }
  }
  return false;
}

const QUESTION_MARKERS =
  /(?:^|[\s,;:״"'"])(כמה|מה|האם|איך|למה|אפשר)(?:$|[\s,;:?״"'])|\?|how\s+much|\bwhat\b|\bcan\s+i\b/i;

const CLARIFY_FOLLOWUP_RE =
  /^(?:נטו|ברוטו|net|gross)(?:\s*[,.]?\s*(?:שער\s*)?[\d.,]+)?\s*$|שער\s*[\d.,]+|[\d.,]+\s*(?:נטו|ברוטו)/i;

/** שאלה על פנקס/הלכה בלי ספרה — לא לייצר כרטיס */
export function isLedgerQuestionWithoutAmount(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\d/.test(t)) return false;
  return QUESTION_MARKERS.test(t);
}

/** תשובה קצרה להבהרת נטו/ברוטו/שער מההודעה הקודמת של נועם */
export function isClarifyingFollowUp(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const lastUserIdx = [...list]
    .map((m, i) => ({ m, i }))
    .reverse()
    .find((x) => x.m?.role === 'user');
  if (!lastUserIdx) return false;
  const content = String(lastUserIdx.m.content || '').trim();
  const looksLikeFollowUp =
    CLARIFY_FOLLOWUP_RE.test(content) ||
    /^(?:נטו|ברוטו)$/i.test(content) ||
    (content.length <= 40 && /(נטו|ברוטו|שער|net|gross)/i.test(content));
  if (!looksLikeFollowUp) return false;

  let prevAssistant = null;
  for (let i = lastUserIdx.i - 1; i >= 0; i--) {
    if (list[i]?.role === 'assistant') {
      prevAssistant = list[i];
      break;
    }
  }
  if (!prevAssistant) return false;
  return isEntryClarifyingQuestion(prevAssistant.content);
}

/**
 * מסיר מהתשובה משפטים שמפנים לכרטיס שאינו קיים.
 */
export function stripOrphanCardPointers(reply) {
  let text = String(reply || '');
  text = text.replace(
    /[^.!?\n]*(?:אפשר\s+)?להוסיף\s+לפנקס\s*[—\-–]?\s*אשר\s+למטה[^.!?\n]*[.!?]?/gi,
    ''
  );
  text = text.replace(/[^.!?\n]*להוסיף\s+לפנקס\??[^.!?\n]*[.!?]?/gi, '');
  text = text.replace(
    /[^.!?\n]*אשר\s+(?:בכפתור|בכרטיס)\s+למטה[^.!?\n]*[.!?]?/gi,
    ''
  );
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

/**
 * NEW-3 — gates אחרי gateProposedActions:
 * 1) amount grounding
 * 2) question without digit
 * 3) לא להציע remaining/obligation אלא אם המשתמש כתב את המספר
 */
export function applyIntentGates(actions, messages, context) {
  const list = Array.isArray(actions) ? actions : [];
  if (!list.length) {
    return { actions: [], dropped: false, reason: null };
  }

  const users = userContents(messages);
  const last = users[users.length - 1] || '';

  // 2) Question gate
  if (isLedgerQuestionWithoutAmount(last) && !isClarifyingFollowUp(messages)) {
    return { actions: [], dropped: true, reason: 'question' };
  }

  const ctx = context && typeof context === 'object' ? context : null;
  const remaining = ctx ? Number(ctx.remaining) : NaN;
  const obligation = ctx ? Number(ctx.obligation) : NaN;
  const lastAmounts = extractUserAmounts(
    [{ role: 'user', content: last }],
    1
  );

  const kept = [];
  let dropped = false;
  for (const a of list) {
    // 1) grounding
    if (!isAmountGrounded(a.amount, messages)) {
      dropped = true;
      continue;
    }
    // 3) remaining / obligation unless stated in last message
    if (
      Number.isFinite(remaining) &&
      Math.abs(a.amount - remaining) < 0.51 &&
      !lastAmounts.has(Math.round(remaining * 100) / 100)
    ) {
      dropped = true;
      continue;
    }
    if (
      Number.isFinite(obligation) &&
      Math.abs(a.amount - obligation) < 0.51 &&
      !lastAmounts.has(Math.round(obligation * 100) / 100)
    ) {
      dropped = true;
      continue;
    }
    kept.push(a);
  }

  return {
    actions: kept,
    dropped: dropped || kept.length < list.length,
    reason: dropped ? 'ungrounded' : null,
  };
}

/**
 * NEW-1 — מנקה רשימת confirmed מהלקוח (max 3).
 */
export function sanitizeConfirmed(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (out.length >= 3) break;
    if (!item || typeof item !== 'object') continue;
    if (!['income', 'expense', 'tzedaka'].includes(item.kind)) continue;
    const amount = Math.round(Number(item.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e8) continue;
    const category = sanitizeEntryCategory(item.kind, item.category);
    if (!category) continue;
    const period = sanitizePeriod(item.period);
    if (!period) continue;
    out.push({ kind: item.kind, category, amount, period });
  }
  return out;
}

function actionMatchesConfirmed(action, confirmed) {
  const period = action.period || '';
  return confirmed.some(
    (c) =>
      c.kind === action.kind &&
      c.category === action.category &&
      Math.abs(c.amount - action.amount) < 0.01 &&
      (period ? c.period === period : true)
  );
}

/**
 * NEW-1 — מסיר הצעות זהות לתנועות שכבר אושרו, אלא אם המשתמש חזר על הסכום.
 */
export function dropConfirmedDuplicates(actions, confirmed, messages) {
  const list = Array.isArray(actions) ? actions : [];
  const conf = Array.isArray(confirmed) ? confirmed : [];
  if (!list.length || !conf.length) {
    return { actions: list, droppedDuplicate: false };
  }
  const users = userContents(messages);
  const last = users[users.length - 1] || '';
  const lastAmounts = extractUserAmounts(
    [{ role: 'user', content: last }],
    1
  );

  const kept = [];
  let droppedDuplicate = false;
  for (const a of list) {
    if (actionMatchesConfirmed(a, conf) && !lastAmounts.has(a.amount)) {
      droppedDuplicate = true;
      continue;
    }
    kept.push(a);
  }
  return { actions: kept, droppedDuplicate };
}

export const ALREADY_CONFIRMED_REPLY =
  'התנועה הזאת כבר נוספה לפנקס. רוצה להוסיף עוד אחת?';
