/**
 * עיבוד פלט מודל — פונקציה טהורה לבדיקות בלי רשת.
 * סדר: validActions → כפיית period → gate → canary → reconcile →
 * stripMarkdown → איכות פלט (מטבע, מילים שבורות, חשבון, מספרים לא־מבוקשים…).
 */

import {
  filterCanaryOutput,
  gateProposedActions,
  lastUserMentionsPriorMonth,
  replyForProposalGate,
  resolveTargetPeriod,
  PRIOR_MONTH_NEED_AMOUNT,
  priorMonthProposalReply,
  stripMarkdownHeadings,
  validActions,
  BROKEN_HEBREW_WORDS,
  isMostlyEnglish,
  NET_GROSS_CLARIFY_EN,
} from './chatSafety.mjs';
import { reconcileReplyWithContext } from './chatLedger.mjs';

export const SCRIPT_FALLBACK = 'רגע, נתקעתי. אפשר לנסח שוב בקצרה?';

/** תווים זרים בתוך תשובה עברית */
const BAD_SCRIPT_RE =
  /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u4E00-\u9FFF\uFFFD]/;

const STALE_PRIOR_MONTH_CLAIM =
  /לא ניתן לרשום.*(?:חודש שעבר|חודש קודם)|אי אפשר לרשום.*(?:חודש שעבר|חודש קודם)/;

const ARITHMETIC_SENTENCE =
  /[^.!?\n]*(?:\d[\d,]*(?:\.\d+)?\s*(?:[+\-−×x*\/])\s*\d[\d,]*(?:\.\d+)?\s*=|\d[\d,]*(?:\.\d+)?\s*=\s*\d[\d,]*(?:\.\d+)?\s*(?:[+\-−×x*\/]))[^.!?\n]*[.!?\n]?/gi;

const LEDGER_ASK_RE =
  /כמה|נותר|נשאר|חובה|ניתן|יתרה|סכום|remaining|how much|balance/i;

const NAME_FIXES = [
  [/\bNachman\b/gi, 'Noam'],
  [/\bMaasar\s+Yashar'?s?\b/gi, 'Maaser Yashar'],
  [/\bMaaser\s+Yashir'?s?\b/gi, 'Maaser Yashar'],
  [/\bMaasar\s+Yasher'?s?\b/gi, 'Maaser Yashar'],
  [/\bMaaser\s+Yashar'?s\b/gi, 'Maaser Yashar'],
];

function lastUserContent(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user' && typeof m.content === 'string') return m.content;
  }
  return '';
}

function moneyFmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  const rounded = Math.round(v * 100) / 100;
  const intPart = Math.trunc(rounded);
  const frac = Math.abs(rounded - intPart);
  const base = Math.abs(intPart).toLocaleString('en-US');
  if (frac < 1e-9) return base;
  const f = Math.round(frac * 100)
    .toString()
    .padStart(2, '0')
    .replace(/0+$/, '');
  return f ? `${base}.${f}` : base;
}

function ledgerSummarySentence(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';
  return `חובה ₪${moneyFmt(ctx.obligation)}, ניתן ₪${moneyFmt(ctx.tzedaka)}, נותר ₪${moneyFmt(ctx.remaining)}.`;
}

export function hasBadScriptInHebrewReply(reply) {
  const text = String(reply || '');
  if (!/[\u0590-\u05FF]/.test(text)) return false;
  return BAD_SCRIPT_RE.test(text);
}

export function fixCurrencySymbols(text) {
  let s = String(text || '');
  s = s.replace(/₦\s*([\d,]+(?:\.\d+)?)/g, '₪$1');
  s = s.replace(/([\d,]+(?:\.\d+)?)\s*₦/g, '₪$1');
  s = s.replace(/\b(?:NIS|ILS)\s*([\d,]+(?:\.\d+)?)/gi, '₪$1');
  s = s.replace(/([\d,]+(?:\.\d+)?)\s*(?:NIS|ILS)\b/gi, '₪$1');
  s = s.replace(/שקל\s+חדש\s*([\d,]+(?:\.\d+)?)/g, '₪$1');
  s = s.replace(/([\d,]+(?:\.\d+)?)\s*שקל\s+חדש/g, '₪$1');
  s = s.replace(/([\d,]+(?:\.\d+)?)\s*₪/g, '₪$1');
  s = s.replace(/₪\s*([\d,]+(?:\.\d+)?)/g, (_, num) => {
    const n = Number(String(num).replace(/,/g, ''));
    if (!Number.isFinite(n)) return `₪${num}`;
    return `₪${moneyFmt(n)}`;
  });
  return s;
}

export function fixBrokenHebrewWords(text) {
  let s = String(text || '');
  for (const [bad, good] of Object.entries(BROKEN_HEBREW_WORDS)) {
    if (bad === 'אזכרת') {
      s = s.replace(/(^|[^\u0590-\u05FF])אזכרת(?=[^\u0590-\u05FF]|$)/g, (full, pre, offset, whole) => {
        const before = whole.slice(Math.max(0, offset - 8), offset);
        if (/מת|נפטר|ליל/.test(before)) return full;
        return `${pre}${good}`;
      });
      continue;
    }
    s = s.replace(
      new RegExp(`(^|[^\\u0590-\\u05FF])${bad}(?=[^\\u0590-\\u05FF]|$)`, 'g'),
      `$1${good}`
    );
  }
  return s;
}

export function fixIdentityNames(text) {
  let s = String(text || '');
  for (const [re, rep] of NAME_FIXES) {
    s = s.replace(re, rep);
  }
  return s;
}

function splitSentences(text) {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  return raw.split(/(?<=[.!?…])\s+|\n+/).filter((x) => x && x.trim());
}

function joinSentences(parts) {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function stripInventedArithmetic(text, ctx, askedAboutLedger) {
  const notes = [];
  let s = String(text || '');
  const before = s;
  s = s.replace(ARITHMETIC_SENTENCE, '').replace(/\s{2,}/g, ' ').trim();
  if (s !== before.trim()) {
    notes.push('strip_arithmetic');
    if (askedAboutLedger && ctx) {
      const summary = ledgerSummarySentence(ctx);
      if (summary && !/נותר\s*₪|₪[\d,]+\s*נותר/.test(s)) {
        s = joinSentences([s, summary]);
        notes.push('append_ledger_summary');
      }
    }
  }
  return { text: s, notes };
}

export function stripUnsolicitedLedgerNumbers(text, lastUser) {
  const notes = [];
  if (LEDGER_ASK_RE.test(String(lastUser || ''))) {
    return { text: String(text || ''), notes };
  }
  const parts = splitSentences(text);
  const kept = [];
  for (const seg of parts) {
    const t = seg.trim();
    // משפט שכולו/בעיקר דיווח נותר/חובה/ניתן
    if (
      /^(?:חובה|ניתן|נותר|נשאר)\s*₪[\d,.]+(?:\s*[,·.]\s*(?:חובה|ניתן|נותר|נשאר)\s*₪[\d,.]+)*\.?$/.test(
        t
      ) ||
      /^₪[\d,.]+\s*(?:נותר|נשאר|חובה|ניתן)\.?$/.test(t)
    ) {
      notes.push('strip_unsolicited_ledger');
      continue;
    }
    // סיומת מודבקת «... ₪260 נותר.»
    const stripped = t.replace(/\s*₪[\d,.]+\s*(?:נותר|נשאר)\.?\s*$/u, '');
    if (stripped !== t && stripped.length > 15) {
      notes.push('strip_trailing_remaining');
      kept.push(stripped);
      continue;
    }
    kept.push(t);
  }
  return { text: joinSentences(kept), notes };
}

function isLedgerQuestion(lastUser) {
  return LEDGER_ASK_RE.test(String(lastUser || ''));
}

export function capSentences(text, lastUser) {
  const notes = [];
  if (isLedgerQuestion(lastUser)) return { text: String(text || ''), notes };
  const s = String(text || '');
  if (/^\s*\d+[.)]\s/m.test(s)) return { text: s, notes };
  const parts = splitSentences(s);
  if (parts.length <= 4) return { text: s, notes };
  notes.push('sentence_cap');
  return { text: joinSentences(parts.slice(0, 4)), notes };
}

function messageHasAmount(text) {
  return /\d[\d,]*(?:\.\d+)?/.test(String(text || ''));
}

function messageHasEntryKind(text) {
  return /(תרומ|צדק|תרמ|הכנס|משכור|קיבל|נתת|ניכוי|הוצא|income|donation|tzedaka|salary|earned)/i.test(
    String(text || '')
  );
}

function applyOutputQuality(reply, messages, context, notes) {
  const lastUser = lastUserContent(messages);
  let text = String(reply || '');

  const beforeCur = text;
  text = fixCurrencySymbols(text);
  if (text !== beforeCur) notes.push('fix_currency');

  const beforeWords = text;
  text = fixBrokenHebrewWords(text);
  if (text !== beforeWords) notes.push('fix_broken_words');

  const beforeNames = text;
  text = fixIdentityNames(text);
  if (text !== beforeNames) notes.push('fix_identity_names');

  const arith = stripInventedArithmetic(text, context, isLedgerQuestion(lastUser));
  text = arith.text;
  notes.push(...arith.notes);

  const unsol = stripUnsolicitedLedgerNumbers(text, lastUser);
  text = unsol.text;
  notes.push(...unsol.notes);

  const capped = capSentences(text, lastUser);
  text = capped.text;
  notes.push(...capped.notes);

  return text;
}

/**
 * @param {{
 *   reply: string,
 *   actions: unknown[],
 *   messages: {role:string,content:string}[],
 *   context: object|null,
 *   confirmed?: boolean,
 *   now?: Date|string|number,
 *   allowScriptRetry?: boolean,
 * }} args
 * @returns {{ reply: string, actions: object[], notes: string[], needsScriptRetry?: boolean }}
 */
export function postProcessModelOutput({
  reply,
  actions,
  messages,
  context,
  confirmed: _confirmed,
  now = new Date(),
  allowScriptRetry = false,
}) {
  const notes = [];
  let outReply = String(reply || '');
  let outActions = validActions(actions);
  notes.push('valid_actions');

  const lastUser = lastUserContent(messages);
  const targetPeriod = resolveTargetPeriod(lastUser, now);
  const priorIntent =
    !!targetPeriod || lastUserMentionsPriorMonth(messages);
  let forcedPeriodReply = false;

  if (targetPeriod && outActions.length) {
    outActions = outActions.map((a) => ({ ...a, period: targetPeriod }));
    notes.push('force_period');
    outReply = priorMonthProposalReply(targetPeriod);
    forcedPeriodReply = true;
    notes.push('prior_month_proposal_reply');
  } else if (
    priorIntent &&
    !outActions.length &&
    (!messageHasAmount(lastUser) || !messageHasEntryKind(lastUser))
  ) {
    outReply = PRIOR_MONTH_NEED_AMOUNT;
    notes.push('prior_month_need_amount');
  }

  const gated = gateProposedActions(outActions, messages);
  if (gated.reason === 'prior_month' && targetPeriod && outActions.length) {
    // כבר כפינו period — מבטלים את השער
    outActions = outActions.map((a) => ({ ...a, period: targetPeriod }));
    notes.push('clear_prior_month_gate');
  } else {
    outActions = gated.actions;
    if (gated.reason) {
      notes.push(`gate:${gated.reason}`);
      if (!(forcedPeriodReply && gated.reason === 'prior_month')) {
        if (gated.reason === 'net_gross' && isMostlyEnglish(lastUser)) {
          outReply = NET_GROSS_CLARIFY_EN;
          forcedPeriodReply = false;
        } else if (gated.reason === 'prior_month') {
          outReply = PRIOR_MONTH_NEED_AMOUNT;
        } else {
          outReply = replyForProposalGate(gated.reason, outReply, messages);
          forcedPeriodReply = false;
        }
      }
    }
  }

  if (STALE_PRIOR_MONTH_CLAIM.test(outReply)) {
    notes.push('stale_prior_month_claim');
    if (outActions.length) {
      const p = outActions[0].period || targetPeriod;
      outReply = p ? priorMonthProposalReply(p) : PRIOR_MONTH_NEED_AMOUNT;
      forcedPeriodReply = !!p;
    } else {
      outReply = PRIOR_MONTH_NEED_AMOUNT;
    }
  }

  const canary = filterCanaryOutput(outReply);
  outReply = canary.reply;
  notes.push(canary.triggered ? 'canary_triggered' : 'canary_ok');
  if (canary.triggered) {
    outActions = [];
  }

  if (context && typeof context === 'object' && !canary.triggered) {
    outReply = reconcileReplyWithContext(outReply, context);
    notes.push('reconcile');
  }

  outReply = stripMarkdownHeadings(outReply);
  notes.push('strip_markdown');

  if (hasBadScriptInHebrewReply(outReply)) {
    notes.push('bad_script');
    if (allowScriptRetry) {
      return {
        reply: outReply,
        actions: outActions,
        notes,
        needsScriptRetry: true,
      };
    }
    return {
      reply: SCRIPT_FALLBACK,
      actions: [],
      notes: [...notes, 'script_fallback'],
    };
  }

  if (!canary.triggered && !forcedPeriodReply) {
    outReply = applyOutputQuality(outReply, messages, context, notes);
  } else if (!canary.triggered && forcedPeriodReply) {
    // עדיין מתקנים מטבע/שמות במשפט הקבוע אם צריך
    outReply = fixCurrencySymbols(fixBrokenHebrewWords(outReply));
  }

  return { reply: outReply, actions: outActions, notes };
}
