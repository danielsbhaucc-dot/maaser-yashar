import { BOT_NAME, t, type Gender } from './copy';
import type { LedgerTotals } from '../types/ledger';
import type { MaaserRate } from '../types';
import { entriesLabel, monthsClosedTogetherLabel } from './plural';

function money(n: number) {
  return `₪${Math.round(n).toLocaleString('he-IL')}`;
}

/** שורת ליווי קצרה מנועם לפי מצב הפנקס */
export function noamLedgerNudge(opts: {
  name: string;
  gender: Gender;
  totals: LedgerTotals;
  entryCount: number;
  rate: MaaserRate;
  journeyDays?: number | null;
}): string {
  const { name, gender: g, totals, entryCount, rate, journeyDays } = opts;
  const ratePct = Math.round(rate * 100);

  if (entryCount === 0) {
    return t(
      g,
      `${BOT_NAME} פה איתך, ${name}. בוא נפתח את החודש — הכנסה אחת וזה מתחיל לזוז.`,
      `${BOT_NAME} פה איתך, ${name}. בואי נפתח את החודש — הכנסה אחת וזה מתחיל לזוז.`
    );
  }

  if (totals.obligation <= 0 && totals.income <= 0) {
    return t(
      g,
      `${name}, רשמתי הוצאות — עכשיו חסרה הכנסה כדי לחשב מעשר באמת.`,
      `${name}, רשמתי הוצאות — עכשיו חסרה הכנסה כדי לחשב מעשר באמת.`
    );
  }

  if (totals.remaining <= 0 && totals.obligation > 0) {
    return t(
      g,
      `וואו ${name} — כיסית את ה־${ratePct}% החודש. אני גאה בך בשקט ✨`,
      `וואו ${name} — כיסית את ה־${ratePct}% החודש. אני גאה בך בשקט ✨`
    );
  }

  if (totals.tzedaka > 0 && totals.remaining > 0) {
    const pct = Math.min(99, Math.round((totals.tzedaka / totals.obligation) * 100));
    return t(
      g,
      `${name}, אנחנו על ${pct}%. נשאר ${money(totals.remaining)} — צעד קטן ואנחנו שם.`,
      `${name}, אנחנו על ${pct}%. נשאר ${money(totals.remaining)} — צעד קטן ואנחנו שם.`
    );
  }

  if (totals.obligation > 0 && totals.tzedaka === 0) {
    return t(
      g,
      `${name}, החובה החודש ${money(totals.obligation)}. כשתהיה מוכן — אני איתך בצ'אט או בכפתור צדקה.`,
      `${name}, החובה החודש ${money(totals.obligation)}. כשתהיי מוכנה — אני איתך בצ'אט או בכפתור צדקה.`
    );
  }

  if (journeyDays != null && journeyDays >= 7 && journeyDays % 7 === 0) {
    return t(
      g,
      `${name}, שבוע ${Math.floor(journeyDays / 7)} במסע. ממשיכים יחד — בלי לחץ, עם דיוק.`,
      `${name}, שבוע ${Math.floor(journeyDays / 7)} במסע. ממשיכות יחד — בלי לחץ, עם דיוק.`
    );
  }

  return t(
    g,
    `${BOT_NAME} איתך. ${entriesLabel(entryCount)} החודש — רוצה שאעשה סדר בצ'אט?`,
    `${BOT_NAME} איתך. ${entriesLabel(entryCount)} החודש — רוצה שאעשה סדר בצ'אט?`
  );
}

export function noamHomeHeroLine(name: string, g: Gender): string {
  return t(
    g,
    `${BOT_NAME} מלווה אותך · בוא נעשה סדר`,
    `${BOT_NAME} מלווה אותך · בואי נעשה סדר`
  );
}

export function noamEmptyLedger(name: string, g: Gender): { title: string; body: string } {
  return {
    title: t(g, `${name}, הפנקס מחכה לנו`, `${name}, הפנקס מחכה לנו`),
    body: t(
      g,
      `אני ${BOT_NAME}. תוסיף הכנסה או תכתוב לי בצ'אט קיבלתי משכורת… — ואני אציע מה לרשום.`,
      `אני ${BOT_NAME}. תוסיפי הכנסה או תכתבי לי בצ'אט קיבלתי משכורת… — ואני אציע מה לרשום.`
    ),
  };
}

export function noamHistoryEmpty(name: string, g: Gender): { title: string; body: string } {
  return {
    title: t(g, 'עדיין אין ארכיון', 'עדיין אין ארכיון'),
    body: t(
      g,
      `${name}, כשתשמור סיכום חודש בבית — אני אשמור לך כאן את הסיפור של הנתינה.`,
      `${name}, כשתשמרי סיכום חודש בבית — אני אשמור לך כאן את הסיפור של הנתינה.`
    ),
  };
}

export function noamHistoryHero(name: string, g: Gender, count: number): string {
  if (count === 0) {
    return t(
      g,
      `${BOT_NAME}: כאן נבנה יחד את הזיכרון החודשי שלך`,
      `${BOT_NAME}: כאן נבנה יחד את הזיכרון החודשי שלך`
    );
  }
  return t(
    g,
    `${name}, ${monthsClosedTogetherLabel(count, 'שמרנו')} — כל אחד סיפור קטן של נתינה`,
    `${name}, ${monthsClosedTogetherLabel(count, 'שמרנו')} — כל אחד סיפור קטן של נתינה`
  );
}

export function noamTaxHero(name: string, g: Gender): string {
  return t(
    g,
    `${name}, אני ${BOT_NAME} — בוא נבדוק כמה המדינה מחזירה על הצדקה`,
    `${name}, אני ${BOT_NAME} — בואי נבדוק כמה המדינה מחזירה על הצדקה`
  );
}

export function noamGuideHero(name: string, g: Gender): string {
  return t(
    g,
    `${BOT_NAME} איתך במפה: צעדים קצרים, בלי בלגן`,
    `${BOT_NAME} איתך במפה: צעדים קצרים, בלי בלגן`
  );
}

export function noamSettingsHero(name: string, g: Gender): string {
  return t(
    g,
    `${name}, כאן מעצבים איך אני מדבר איתך — שם, מגדר ואחוז`,
    `${name}, כאן מעצבים איך אני מדבר איתך — שם, מגדר ואחוז`
  );
}

export function noamSaveMonthToast(name: string, g: Gender, periodLabel: string): string {
  return t(
    g,
    `${name}, שמרתי את ${periodLabel} בארכיון. כל הכבוד שאתה סוגר חודשים.`,
    `${name}, שמרתי את ${periodLabel} בארכיון. כל הכבוד שאת סוגרת חודשים.`
  );
}

export function noamBannerTip(g: Gender): string {
  return t(
    g,
    `${BOT_NAME}: הכנסה מוסיפה · הוצאה מורידה מהבסיס · צדקה על החובה — ואני בצ'אט אם מתבלבלים`,
    `${BOT_NAME}: הכנסה מוסיפה · הוצאה מורידה מהבסיס · צדקה על החובה — ואני בצ'אט אם מתבלבלות`
  );
}

export function noamChatWelcome(opts: {
  name: string;
  gender: Gender;
  totals: LedgerTotals;
  entryCount: number;
}): string {
  const { name, gender: g, totals, entryCount } = opts;
  if (entryCount === 0) {
    return t(
      g,
      `היי ${name}, מה נשמע?\nהפנקס עדיין ריק. זרוק לי מספר — משכורת, מס, צדקה — ואני אעשה סדר.`,
      `היי ${name}, מה נשמע?\nהפנקס עדיין ריק. זרקי לי מספר — משכורת, מס, צדקה — ואני אעשה סדר.`
    );
  }
  if (totals.remaining > 0) {
    return t(
      g,
      `היי ${name}.\nנשאר לתת ${money(totals.remaining)} החודש. מה חדש?`,
      `היי ${name}.\nנשאר לתת ${money(totals.remaining)} החודש. מה חדש?`
    );
  }
  if (totals.obligation > 0 && totals.remaining <= 0) {
    return t(
      g,
      `היי ${name}, החודש מכוסה ✨\nרוצה לרשום עוד משהו או סתם לוודא שהמספרים מדויקים?`,
      `היי ${name}, החודש מכוסה ✨\nרוצה לרשום עוד משהו או סתם לוודא שהמספרים מדויקים?`
    );
  }
  return t(
    g,
    `היי ${name}.\nזרוק לי מספרים ואני מסדר. בלי דרשות.`,
    `היי ${name}.\nזרקי לי מספרים ואני מסדר. בלי דרשות.`
  );
}
