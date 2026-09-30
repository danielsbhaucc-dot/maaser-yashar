/**
 * מייצא docs/halakha-review.md מ־shared/halakha.json + טקסטי Noam / אונבורדינג.
 * npm run export:halakha
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const data = JSON.parse(readFileSync(join(root, 'shared', 'halakha.json'), 'utf8'));

// Ensure server copy is in sync before reading Noam blocks
await import(pathToFileURL(join(root, 'scripts', 'sync-halakha.mjs')).href);
const {
  N07_DISPUTED_TOPICS_BLOCK,
  N08_DEBT_DISTRESS_BLOCK,
  NOAM_HALAKHA_REVIEW_STATUS,
} = await import(
  pathToFileURL(join(root, 'netlify', 'functions', 'chatHalakha.mjs')).href
);

function sourceLabels(ids) {
  if (!ids?.length) return '(אין מקור ברשימה)';
  return ids
    .map((id) => {
      const s = data.sources[id];
      if (!s) return id;
      const suffix = s.verified ? '' : ' (לא נסקר עדיין)';
      return `${s.label}${suffix}`;
    })
    .join('; ');
}

let n = 0;
const sections = [];

function section(title, where, text, sourceIds) {
  n += 1;
  sections.push(`### ${n}. ${title}

**איפה באפליקציה:** ${where}

**טקסט:**
${text}

**מקורות:** ${sourceLabels(sourceIds)}

**הערות הרב:**
`);
}

for (const item of data.faq) {
  const body =
    item.sourceIds?.length > 0
      ? item.body
      : `${item.body}\n\n${data.noAgreedSource}`;
  section(item.question, 'מסך הנחיות — FAQ (`HALACHA_GUIDE`)', body, item.sourceIds);
}

section(
  'הסבר שיעור (מעשר / חומש)',
  'אונבורדינג / הגדרות — `EXPLAIN.rate`',
  data.explainers.rate,
  ['shulchan-aruch-yd-249', 'ketubot-50a']
);
section(
  'הסבר נטו / בסיס',
  'אונבורדינג / בית / הגדרות — `EXPLAIN.net`',
  data.explainers.net,
  []
);
section(
  'קיצור בסיס במסך הבית',
  'HomeScreen — `BASE_EXPLAIN_SHORT`',
  data.explainers.baseShort,
  []
);
section(
  'משפט בחירת אחוז',
  'אונבורדינג — אחרי בחירת שיעור / הסבר',
  data.fixedStrings.rateChoice,
  []
);

for (const t of data.topics) {
  section(
    t.question,
    'נועם — בלוק מחלוקות (N-07)',
    `${t.neutralSummary}\n${t.approaches.map((a) => `• ${a}`).join('\n')}`,
    t.sourceIds
  );
}

const md = `# מסמך סקירה הלכתית — מעשר ישר (T-62)

**סטטוס:** טרם נשלח לרב / טרם אושר להצגה באפליקציה.  
**אל תסמנו** \`RABBI_REVIEW.approved = true\` ב־\`src/constants/rabbiReview.ts\` בלי הסכמה מפורשת של הרב להצגת שמו.

נוצר אוטומטית מ־\`shared/halakha.json\` ע״י \`npm run export:halakha\`.  
סטטוס בקוד: \`NOAM_HALAKHA_REVIEW_STATUS = '${NOAM_HALAKHA_REVIEW_STATUS}'\`.

---

## רשימת בדיקה לשליחה לרב

- [ ] לייצא/להדביק את הסעיפים הרלוונטיים (או לשלוח את הקובץ הזה) לרב מוכר בקהילה.
- [ ] לבקש הערות על כל טענה הלכתית (מעשר/חומש, נטו, ירושה, מתנות, קצבאות, הלוואות, העברת עודף, וכו').
- [ ] ליישם את ההערות ב־\`shared/halakha.json\` ואז \`npm run sync:halakha\` + \`npm run export:halakha\`.
- [ ] לקבל **הסכמה מפורשת** להצגת השורה: «התוכן ההלכתי נסקר על ידי הרב ____».
- [ ] רק אז: לעדכן \`RABBI_REVIEW = { approved: true, name: "…" }\` ב־\`src/constants/rabbiReview.ts\` **וב־** \`public/about.html\`.
- [ ] לוודא שהשורה מופיעה במסך הנחיות ובדף האודות — ורק שם, ורק אחרי האישור.

**באנר ממתין:** ${data.pendingBanner}

---

## סעיפים ממוספרים

${sections.join('\n---\n\n')}

---

## בלוק נועם — מחלוקות (N-07)

\`\`\`
${N07_DISPUTED_TOPICS_BLOCK}
\`\`\`

**הערות הרב:**


---

## בלוק נועם — חובות ומצוקה (N-08)

\`\`\`
${N08_DEBT_DISTRESS_BLOCK}
\`\`\`

**הערות הרב:**


---

## הערה למפתחים

אחרי אישור הרב:
1. עדכנו טקסטים ב־\`shared/halakha.json\` לפי הערותיו.
2. \`npm run sync:halakha\` ואז \`npm run export:halakha\`.
3. \`src/constants/rabbiReview.ts\` → \`approved: true\`, \`name: "…"\`.
4. אותו אובייקט ב־\`public/about.html\`.
`;

writeFileSync(join(root, 'docs', 'halakha-review.md'), md, 'utf8');
console.log('wrote docs/halakha-review.md');
