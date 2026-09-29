# Go-live ops — פעולות אנושיות / דשבורד

## פריסה (רק דרך git)

**פריסה לפרודקשן רק על ידי merge ל־`main`.** Netlify בונה מ־git אוטומטית.
**לעולם אל תריצו `netlify deploy --prod` מהמחשב הנייד** — זה יוצר פער בין מה שרץ לבין `main`.

אחרי merge ל־`main` והשלמת ה־build ב־Netlify:

```bash
node scripts/verify-prod.mjs
```

הסקריפט משווה את `/version.json` החי ל־`origin/main` (PASS/FAIL).

## חובה בדשבורדים (לא ב־repo)

| פריט | איפה | מה לעשות |
|------|------|----------|
| OpenRouter spend cap | openrouter.ai → Credits / Limits | הגדירו תקרת הוצאה חודשית; מחקו מפתחות ישנים שלא בשימוש |
| `OPENROUTER_API_KEY` | Netlify → Env vars | מפתח שרת בלבד, **בלי** `EXPO_PUBLIC_` |
| `EXPO_PUBLIC_CONTACT_EMAIL` | Netlify → Site configuration → Environment variables | כתובת מייל אמיתית ליצירת קשר / משוב / נגישות. אותה משתנה גם ב־`.env` מקומי. בלי ערך — אין mailto והמשתמש רואה «כתובת ליצירת קשר תתווסף בקרוב.» |
| באדג'/מיתוג Netlify | Netlify → Site configuration → General | כבו Status badge / Branding אם מופעל |
| באדג' «Powered by Netlify» | Netlify → Project configuration → General → Status badge / Branding | **חובה לכבות ידנית** את «Powered by Netlify» / Status badge. הקוד ב־repo לא מזריק באדג'; אין דרך להוכיח זאת ב־CI. אחרי הכיבוי — בדקו במכשיר אמיתי (לא רק headless) שהטאב־בר וה־✦ לא חסומים. |
| Branch protection | GitHub → Settings → Branches | Require status checks: workflow **CI** |
| OG בוואטסאפ | אחרי deploy מ־main | שתפו קישור; אם יש cache ישן — facebook sharing debugger / המתנה |
| סקירת רב | `docs/halakha-review.md` | שלחו לרב; **אל** תסמנו `RABBI_REVIEW.approved=true` בלי הסכמה מפורשת |

## אימות מקומי לפני פריסה

```bash
npm test
npx expo export -p web && node scripts/apply-contact.mjs
npm run test:e2e
```

צילומי מסך לביקורת נוצרים אוטומטית ב־`docs/review-screenshots/` בזמן e2e (פרויקטי 390, 768, 1280, 1920): בית, היסטוריה, מס, הנחיות, הגדרות, תנועה חדשה, צ׳אט נועם.
