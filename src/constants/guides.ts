/**
 * FAQ / הנחיות מעשר — נטען מ־shared/halakha.json (מקור אמת יחיד).
 */
import halakha from '../../shared/halakha.json';

/** קישור מקור לתשובת FAQ — מוצג עם Linking כשיש url */
export type GuideSourceLink = {
  label: string;
  url?: string;
};

export type HalachaGuideItem = {
  title: string;
  body: string;
  sources?: GuideSourceLink[];
};

function sourceLine(sourceIds: string[] | undefined): GuideSourceLink[] | undefined {
  if (!sourceIds?.length) return undefined;
  const links: GuideSourceLink[] = [];
  for (const id of sourceIds) {
    const s = (halakha.sources as Record<string, { label: string; verified?: boolean; url?: string }>)[
      id
    ];
    if (!s) continue;
    const suffix = s.verified ? '' : ' (לא נסקר עדיין)';
    links.push({
      label: `${s.label}${suffix}`,
      url: s.url,
    });
  }
  return links.length ? links : undefined;
}

/**
 * שאלות ותשובות מעשר — מסודרות כמו ב־shared/halakha.json (15 שאלות).
 * חלק מהנוסחים ממתין לביקורת רב; אינו פסק הלכה.
 */
export const HALACHA_GUIDE: HalachaGuideItem[] = (halakha.faq as Array<{
  question: string;
  body: string;
  sourceIds?: string[];
}>).map((item) => {
  const sources = sourceLine(item.sourceIds);
  const body =
    sources && sources.length > 0
      ? item.body
      : `${item.body}\n\n${halakha.noAgreedSource}`;
  return {
    title: item.question,
    body,
    sources,
  };
});

export const HALAKHA_PENDING_BANNER = halakha.pendingBanner as string;

export const TAX_GUIDE_STEPS = [
  {
    title: '1. תרמו למוסד מוכר',
    body: 'רק מוסד עם אישור סעיף 46 בתוקף. בדקו באתר רשות המסים.',
  },
  {
    title: '2. קבלה תקינה',
    body: 'שם התורם, המילה תרומה, ואזכור סעיף 46. מ־2026 — דיווח דיגיטלי חשוב.',
  },
  {
    title: '3. כמה מקבלים?',
    body: 'יחיד 35% · חברה 30%. מינימום ~207 ₪. תקרה: 30% מההכנסה החייבת או תקרה מוחלטת.',
  },
  {
    title: '4. מתי לטפל?',
    body: 'במהלך השנה: תיאום מס. אחרי סוף שנה: החזר / דוח. אפשר עד 6 שנים אחורה.',
  },
  {
    title: '5. איך מגישים?',
    body: 'שכיר: בקשת החזר. עצמאי: בדוח השנתי. בלי מס ששולם — אין מה להחזיר.',
  },
  {
    title: '6. מעשר + מס',
    body: 'החזר מס עשוי להיות הכנסה למעשר לפי חלק מהפוסקים. תכננו תרומות עם אישור 46.',
  },
];
