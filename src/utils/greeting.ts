import { getHolidaysOnDate, flags } from '@hebcal/core';
import type { Gender } from './copy';
import { t } from './copy';

export type GreetingResult = {
  /** מילת ברכה בלבד (בוקר טוב / שבת שלום…) */
  greeting: string;
  /** שורה אישית מלאה */
  line: string;
  /** משפט נעים מתחת */
  note?: string;
  light?: boolean;
};

type HolidayKind = 'joy' | 'solemn' | 'fast' | 'memorial' | 'modern' | 'minor';

type HolidayRule = {
  match: RegExp;
  kind: HolidayKind;
  greeting: string;
  note?: (name: string, g: Gender) => string;
};

/** אירועים שוליים שלא צריכים לדרוס ברכת בוקר/שבת */
const NOISE_FLAGS =
  flags.HEBREW_DATE |
  flags.OMER_COUNT |
  flags.PARSHA_HASHAVUA |
  flags.DAILY_LEARNING |
  flags.MOLAD |
  flags.YOM_KIPPUR_KATAN |
  flags.SHABBAT_MEVARCHIM |
  flags.DAF_YOMI |
  flags.MISHNA_YOMI |
  flags.NACH_YOMI |
  flags.YERUSHALMI_YOMI;

const HOLIDAY_RULES: HolidayRule[] = [
  {
    match: /Yom Kippur/i,
    kind: 'solemn',
    greeting: 'גמר חתימה טובה',
    note: (n, g) => t(g, `${n}, יום של לב פתוח וחשבון נפש עדין`, `${n}, יום של לב פתוח וחשבון נפש עדין`),
  },
  {
    match: /Erev Rosh Hashana/i,
    kind: 'joy',
    greeting: 'שנה טובה',
    note: (n) => `${n}, ערב של התחלות מתוקות`,
  },
  {
    match: /Rosh Hashana/i,
    kind: 'joy',
    greeting: 'שנה טובה ומתוקה',
    note: (n) => `${n}, שתהיה שנה של שפע — וגם של נתינה`,
  },
  {
    match: /Erev Pesach|Erev Passover/i,
    kind: 'joy',
    greeting: 'פסח כשר ושמח',
    note: (n) => `${n}, ערב של חירות וניקיון לב`,
  },
  {
    match: /Pesach|Passover/i,
    kind: 'joy',
    greeting: 'חג כשר ושמח',
    note: (n) => `${n}, חג של חירות — גם בכיס אחרי מעשר`,
  },
  {
    match: /Sukkot|Succot/i,
    kind: 'joy',
    greeting: 'חג סוכות שמח',
    note: (n) => `${n}, הסוכה זמנית — הנתינה נשארת`,
  },
  {
    match: /Shmini Atzeret|Simchat Torah|Simchas Torah/i,
    kind: 'joy',
    greeting: 'שמחת תורה שמחה',
    note: (n) => `${n}, היום רוקדים עם התורה — ומחר עם המעשר`,
  },
  {
    match: /Chanukah|Hanukkah/i,
    kind: 'joy',
    greeting: 'חנוכה שמח',
    note: (n) => `${n}, נס קטן של אור — נס גדול של צדקה`,
  },
  {
    match: /Purim/i,
    kind: 'joy',
    greeting: 'פורים שמח',
    note: (n) => `${n}, מתנות לאביונים זה בדיוק העמוד הזה`,
  },
  {
    match: /Shavuot|Shavuos/i,
    kind: 'joy',
    greeting: 'חג שבועות שמח',
    note: (n) => `${n}, תורה, לב פתוח — ומעשר מהנטו`,
  },
  {
    match: /Tu BiShvat|Tu B'Shvat|Tu Bishvat/i,
    kind: 'joy',
    greeting: 'ט״ו בשבט שמח',
    note: (n) => `${n}, נוטעים עצים — וזורעים נתינה`,
  },
  {
    match: /Lag BaOmer|Lag B'Omer/i,
    kind: 'joy',
    greeting: 'ל״ג בעומר שמח',
    note: (n) => `${n}, מדורה בחוץ — חסד בפנים`,
  },
  {
    match: /Tu B'Av|Tu BeAv|Tu B’Av/i,
    kind: 'joy',
    greeting: 'ט״ו באב שמח',
    note: (n) => `${n}, יום של אהבה — גם לקופת הצדקה`,
  },
  { match: /Asara B'Tevet|Asara B’Tevet|10 of Tevet/i, kind: 'fast', greeting: 'צום קל' },
  {
    match: /Ta'anit Esther|Taanit Esther/i,
    kind: 'fast',
    greeting: 'צום קל',
    note: () => 'ואחריו — פורים שמח',
  },
  { match: /Ta'anit Bechorot|Taanit Bechorot|Fast of the First/i, kind: 'fast', greeting: 'צום קל' },
  { match: /Tzom Gedaliah|Fast of Gedaliah/i, kind: 'fast', greeting: 'צום קל' },
  {
    match: /Tish'?a B'?Av|Tisha B'Av|Tishah B'Av/i,
    kind: 'solemn',
    greeting: 'יום של זיכרון',
    note: (n) => `${n}, לב שקט היום`,
  },
  {
    match: /Yom HaShoah|Yom Hashoah|Holocaust/i,
    kind: 'memorial',
    greeting: 'לזכרם',
    note: () => 'לעולם לא נשכח',
  },
  {
    match: /Yom HaZikaron|Yom Hazikaron/i,
    kind: 'memorial',
    greeting: 'זוכרים',
    note: () => 'וממשיכים בשקט ובכבוד',
  },
  {
    match: /Yom HaAtzma'?ut|Yom HaAtzmaut/i,
    kind: 'modern',
    greeting: 'יום עצמאות שמח',
    note: (n) => `${n}, עצמאות בלב — וסדר בכיס`,
  },
  {
    match: /Yom Yerushalayim/i,
    kind: 'modern',
    greeting: 'יום ירושלים שמח',
    note: (n) => `${n}, ירושלים של זהב — וגם של צדקה`,
  },
  { match: /Yom HaAliyah/i, kind: 'modern', greeting: 'יום העלייה שמח' },
  { match: /Sigd/i, kind: 'joy', greeting: 'חג הסיגד שמח' },
  {
    match: /Rosh Chodesh/i,
    kind: 'minor',
    greeting: 'ראש חודש שמח',
    note: (n) => `${n}, חודש חדש — יתרה חדשה`,
  },
  { match: /Family Day|Yom HaMishpacha/i, kind: 'modern', greeting: 'יום המשפחה שמח' },
  { match: /Herzl|Jabotinsky|Rabin|Ben-Gurion/i, kind: 'memorial', greeting: 'יום זיכרון' },
];

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function personalLine(greeting: string, name: string): string {
  const clean = name.trim();
  if (!clean) return greeting;
  return `${greeting}, ${clean}`;
}

function timeOfDay(d: Date): { greeting: string; note: (name: string, g: Gender) => string } {
  const m = minutesOfDay(d);
  if (m >= 5 * 60 && m < 11 * 60 + 30) {
    return {
      greeting: 'בוקר טוב',
      note: (n, g) =>
        t(
          g,
          `${n}, בוקר רך של התחלה טובה — צעד אחד של נתינה`,
          `${n}, בוקר רך של התחלה טובה — צעד אחד של נתינה`
        ),
    };
  }
  if (m >= 11 * 60 + 30 && m < 12 * 60) {
    return {
      greeting: 'כמעט צהריים טובים',
      note: (n) => `${n}, עוד רגע והשמש בשיא — גם הזמן לנתינה קטנה`,
    };
  }
  if (m >= 12 * 60 && m < 16 * 60) {
    return {
      greeting: 'צהריים טובים',
      note: (n, g) =>
        t(
          g,
          `${n}, צהריים נעימים — בוא נספור ברכה ברוגע`,
          `${n}, צהריים נעימים — בואי נספור ברכה ברוגע`
        ),
    };
  }
  if (m >= 16 * 60 && m < 17 * 60) {
    return {
      greeting: 'אחר הצהריים טובים',
      note: (n) => `${n}, השעה הזו מושלמת לעדכון קטן בפנקס`,
    };
  }
  if (m >= 17 * 60 && m < 20 * 60 + 40) {
    return {
      greeting: 'ערב טוב',
      note: (n, g) =>
        t(
          g,
          `${n}, ערב רגוע — סיכום קטן של היום עושה סדר בלב`,
          `${n}, ערב רגוע — סיכום קטן של היום עושה סדר בלב`
        ),
    };
  }
  if (m >= 20 * 60 + 40 && m < 21 * 60) {
    return {
      greeting: 'כמעט ערב טוב',
      note: (n) => `${n}, היום נגמר לאט — עוד נשימה אחת של חסד`,
    };
  }
  return {
    greeting: 'לילה טוב',
    note: (n, g) =>
      t(
        g,
        `${n}, לילה שקט. מחר ממשיכים בעדינות ✦`,
        `${n}, לילה שקט. מחר ממשיכות בעדינות ✦`
      ),
  };
}

function shabbatBlock(
  d: Date,
  name: string,
  g: Gender
): GreetingResult | null {
  const day = d.getDay(); // 0 א׳ … 5 ו׳ 6 ש׳
  const m = minutesOfDay(d);

  // שישי כל היום + שבת עד ~20:40
  if (day === 5 || (day === 6 && m < 20 * 60 + 40)) {
    const greeting = 'שבת שלום';
    return {
      greeting,
      line: personalLine(greeting, name),
      note:
        day === 5
          ? t(
              g,
              `${name}, שישי של מנוחה — וגם של לב פתוח`,
              `${name}, שישי של מנוחה — וגם של לב פתוח`
            )
          : t(
              g,
              `${name}, שבת של שקט. הנתינה מחכה בנחת`,
              `${name}, שבת של שקט. הנתינה מחכה בנחת`
            ),
      light: true,
    };
  }

  // מוצ״ש + יום ראשון עד 11:59
  if ((day === 6 && m >= 20 * 60 + 40) || (day === 0 && m < 12 * 60)) {
    const greeting = 'שבוע טוב';
    return {
      greeting,
      line: personalLine(greeting, name),
      note:
        day === 6
          ? t(
              g,
              `${name}, מוצאי שבת — שבוע חדש מתחיל יפה`,
              `${name}, מוצאי שבת — שבוע חדש מתחיל יפה`
            )
          : t(
              g,
              `${name}, ראשון רך. שבוע טוב ומדויק`,
              `${name}, ראשון רך. שבוע טוב ומדויק`
            ),
      light: true,
    };
  }

  return null;
}

function matchHoliday(desc: string): HolidayRule | null {
  for (const rule of HOLIDAY_RULES) {
    if (rule.match.test(desc)) return rule;
  }
  return null;
}

function holidayBlock(d: Date, name: string, g: Gender): GreetingResult | null {
  let events: ReturnType<typeof getHolidaysOnDate>;
  try {
    events = getHolidaysOnDate(d, true) ?? [];
  } catch {
    return null;
  }
  if (!events.length) return null;

  const meaningful = events.filter((ev) => {
    const f = ev.getFlags();
    if (f & NOISE_FLAGS && !(f & (flags.CHAG | flags.MAJOR_FAST | flags.MINOR_FAST | flags.MODERN_HOLIDAY | flags.ROSH_CHODESH | flags.MINOR_HOLIDAY | flags.CHOL_HAMOED))) {
      return false;
    }
    // רק רעש טהור
    if ((f & NOISE_FLAGS) === f) return false;
    if (f & flags.YOM_KIPPUR_KATAN) return false;
    if (f & flags.OMER_COUNT) return false;
    if (f & flags.PARSHA_HASHAVUA) return false;
    return true;
  });

  if (!meaningful.length) return null;

  const scored = meaningful.map((ev) => {
    const desc = ev.getDesc();
    const f = ev.getFlags();
    const rule = matchHoliday(desc);
    const he = (() => {
      try {
        return ev.render('he');
      } catch {
        return desc;
      }
    })();

    let priority = 0;
    if (rule?.kind === 'memorial' || /Shoah|HaZikaron|Holocaust/i.test(desc)) priority = 100;
    else if (f & flags.MAJOR_FAST || rule?.kind === 'solemn') priority = 95;
    else if (f & flags.MINOR_FAST || rule?.kind === 'fast') priority = 85;
    else if (f & flags.CHAG || rule?.kind === 'joy') priority = 80;
    else if (f & flags.CHOL_HAMOED) priority = 75;
    else if (f & flags.MODERN_HOLIDAY || rule?.kind === 'modern') priority = 70;
    else if (f & flags.ROSH_CHODESH || rule?.kind === 'minor') priority = 60;
    else if (f & flags.MINOR_HOLIDAY) priority = 55;
    else if (f & flags.EREV && rule) priority = 50;

    return { desc, he, rule, priority, f };
  });

  scored.sort((a, b) => b.priority - a.priority);
  const top = scored[0];
  if (!top || top.priority < 50) return null;

  // ערב בלי כלל מזוהה — לא דורסים ברכת זמן
  if (top.f & flags.EREV && !top.rule) return null;

  if (top.rule) {
    const allowJoke =
      top.rule.kind === 'joy' || top.rule.kind === 'modern' || top.rule.kind === 'minor';
    return {
      greeting: top.rule.greeting,
      line: personalLine(top.rule.greeting, name),
      note: top.rule.note?.(name, g) ?? (allowJoke ? top.he : undefined),
      light: allowJoke,
    };
  }

  if (top.f & flags.MAJOR_FAST || top.f & flags.MINOR_FAST) {
    return {
      greeting: 'צום קל',
      line: personalLine('צום קל', name),
      note: top.he,
      light: false,
    };
  }
  if (top.f & flags.CHAG || top.f & flags.CHOL_HAMOED) {
    return {
      greeting: 'חג שמח',
      line: personalLine('חג שמח', name),
      note: `${name} · ${top.he}`,
      light: true,
    };
  }
  if (top.f & flags.MODERN_HOLIDAY) {
    return {
      greeting: 'יום מיוחד שמח',
      line: personalLine('יום מיוחד שמח', name),
      note: top.he,
      light: true,
    };
  }
  if (top.f & flags.ROSH_CHODESH) {
    return {
      greeting: 'ראש חודש שמח',
      line: personalLine('ראש חודש שמח', name),
      note: `${name}, חודש חדש — יתרה חדשה`,
      light: true,
    };
  }

  return null;
}

export type GreetingInput = {
  name: string;
  gender: Gender;
  now?: Date;
};

/**
 * ברכה אישית חכמה:
 * מועד משמעותי → שבת / מוצ״ש / ראשון עד צהריים → שעת היום.
 */
export function getSmartGreeting(input: GreetingInput | Date = new Date()): GreetingResult {
  // תאימות לאחור אם מישהו העביר Date בלבד
  const opts: GreetingInput =
    input instanceof Date
      ? { name: '', gender: 'male', now: input }
      : input;

  const now = opts.now ?? new Date();
  const name = (opts.name || t(opts.gender, 'חבר', 'חברה')).trim();
  const g = opts.gender;

  try {
    const holiday = holidayBlock(now, name, g);
    if (holiday) return holiday;
  } catch {
    // לוח עברי נכשל — ממשיכים לברכת זמן
  }

  const shabbat = shabbatBlock(now, name, g);
  if (shabbat) return shabbat;

  // בראשון אחרי הצהריים — עדיין נועם של «שבוע טוב» כהערה
  const tod = timeOfDay(now);
  const sundayAfterNoon = now.getDay() === 0 && minutesOfDay(now) >= 12 * 60;
  return {
    greeting: tod.greeting,
    line: personalLine(tod.greeting, name),
    note: sundayAfterNoon
      ? t(
          g,
          `${name}, שבוע טוב ממשיך · ${tod.greeting} של רוגע ונתינה`,
          `${name}, שבוע טוב ממשיך · ${tod.greeting} של רוגע ונתינה`
        )
      : tod.note(name, g),
    light: true,
  };
}
