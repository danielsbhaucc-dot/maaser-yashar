# צ׳ק־ליסט OpenRouter + Netlify (ידני)

רשימת פעולות לבעלים אחרי פריסת הקשחת ה־AI. אין כאן ערכי מפתחות/מלחים — רק שמות משתנים.

## OpenRouter

- [ ] (א) ליצור מפתח ייעודי לאתר עם מגבלת קרדיט של כ־5–10 USD ואיפוס (יומי או חודשי)
- [ ] (ב) לכבות Auto top-up בעמוד Credits
- [ ] (ג) להזין את המפתח החדש ב־Netlify → Environment variables כ־`OPENROUTER_API_KEY` (שרת בלבד, בלי קידומת `EXPO_PUBLIC_`), לפרוס מחדש, לבדוק צ׳אט, ואז למחוק את המפתח הישן
- [ ] (ד) אופציונלי: להגביל הגדרות מפתח/ספק ולהגדיר התראת תקציב קטנה ב־OpenRouter

## Netlify (משתני סביבה)

- [ ] (ה) להגדיר:
  - `AI_DAILY_BUDGET_USD` (ברירת מחדל בקוד: 2)
  - `AI_DAILY_REQUEST_LIMIT` (ברירת מחדל: 400)
  - `AI_LIMIT_SALT` (מחרוזת אקראית חזקה — לא בקומיט)
  - אופציונלי: `AI_HOURLY_PER_IP`, `AI_DAILY_PER_IP`, `AI_DAILY_UPSTREAM_LIMIT`, `AI_MAX_TOKENS`, `AI_ALLOWED_ORIGINS`
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
