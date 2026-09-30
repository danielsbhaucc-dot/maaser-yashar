# צ׳ק־ליסט OpenRouter + Netlify (ידני)

רשימת פעולות לבעלים אחרי פריסת הקשחת ה־AI. אין כאן ערכי מפתחות/מלחים — רק שמות משתנים.

## OpenRouter

- [ ] (א) ליצור מפתח ייעודי לאתר עם מגבלת קרדיט של כ־5–10 USD ואיפוס (יומי או חודשי)
- [ ] (ב) לכבות Auto top-up בעמוד Credits
- [ ] (ג) להזין את המפתח החדש ב־Netlify → Environment variables כ־`OPENROUTER_API_KEY` (שרת בלבד, בלי קידומת `EXPO_PUBLIC_`), לפרוס מחדש, לבדוק צ׳אט, ואז למחוק את המפתח הישן
- [ ] (ד) אופציונלי: להגביל הגדרות מפתח/ספק ולהגדיר התראת תקציב קטנה ב־OpenRouter

## בחירת מודל (A/B) — אל תשנו בשקט בקוד

המודל נקבע אך ורק ע״י משתנה הסביבה `OPENROUTER_MODEL` ב־Netlify (קריאה ב־`netlify/functions/chat.mjs` → `resolveModel()`).

- **ברירת מחדל בקוד** (כש־`OPENROUTER_MODEL` ריק): `meta-llama/llama-4-scout`
- **ידוע:** llama-4-scout מייצר שגיאות איכות שנצפו בפרודקשן — סימן מטבע שגוי (₦ במקום ₪), מילים שבורות («הכנסיה», «אזכורת»), חשבון מומצא, הבטחות תזכורת, ושם באנגלית שגוי («Nachman»). חלק מתוקן ב־pipeline בשרת, אבל מודל חזק יותר מפחית מלכתחילה.
- **A/B מומלץ:** להגדיר ב־Netlify Preview / branch deploy למשל `OPENROUTER_MODEL=anthropic/claude-sonnet-4` (או מודל אחר מאושר ב־OpenRouter), לפרוס preview, ולהריץ את סקריפט הרגרסיה בלי לפגוע בפרודקשן:
  ```bash
  # מקומי / מול preview — רק כשיש מפתח שלכם ובמודע:
  OPENROUTER_API_KEY=… CHAT_API_URL=https://<preview>/api/chat npm run test:noam
  ```
- **אל תשנו** את ברירת המחדל בקומיט בלי החלטת מוצר מפורשת. אחרי A/B מוצלח — עדכנו רק את ה־env בפרודקשן.

## Netlify (משתני סביבה)

- [ ] (ה) להגדיר:
  - `AI_DAILY_BUDGET_USD` (ברירת מחדל בקוד: 2)
  - `AI_DAILY_REQUEST_LIMIT` (ברירת מחדל: 400)
  - `AI_LIMIT_SALT` (מחרוזת אקראית חזקה — לא בקומיט)
  - אופציונלי: `AI_HOURLY_PER_IP`, `AI_DAILY_PER_IP`, `AI_DAILY_UPSTREAM_LIMIT`, `AI_MAX_TOKENS`, `AI_ALLOWED_ORIGINS`, `OPENROUTER_MODEL`
- [ ] לפרוס מחדש אחרי שינוי env

## תחזוקה וחירום

- [ ] (ו) תזכורת ביומן חודשית לבדוק שימוש ב־OpenRouter ובלוגי Netlify Functions
- [ ] (ז) מתג חירום: להגדיר `AI_DISABLED=true` ב־Netlify ולפרוס מחדש (או לטריגר deploy). הצ׳אט יחזיר «נועם נח כרגע…»; הפנקס ממשיך לעבוד

## אימות מהיר בלי עלות מודל

```bash
npm run verify:hardening
# או מול preview:
CHAT_API_URL=https://<preview>/api/chat npm run verify:hardening
```

הסקריפט בודק 403 בלי Origin, 403 ל־Origin זר, 413 לגוף גדול, 429 בפרץ injection-guard, ו־405/410 ל־GET — בלי לקרוא למודל בתשלום.
