# Go-live ops — פעולות אנושיות / דשבורד

אחרי `git push` ל־`main`, הריצו redeploy ל־Netlify ואז:

```bash
npx expo export -p web
npx netlify-cli deploy --prod --dir=dist
# או מהשורש (בונה לפי netlify.toml):
npx netlify-cli deploy --prod --build

node scripts/verify-prod.mjs
```

## חובה בדשבורדים (לא ב־repo)

| פריט | איפה | מה לעשות |
|------|------|----------|
| OpenRouter spend cap | openrouter.ai → Credits / Limits | הגדירו תקרת הוצאה חודשית; מחקו מפתחות ישנים שלא בשימוש |
| `OPENROUTER_API_KEY` | Netlify → Env vars | מפתח שרת בלבד, **בלי** `EXPO_PUBLIC_` |
| באדג'/מיתוג Netlify | Netlify → Site configuration → General | כבו Status badge / Branding אם מופעל |
| Branch protection | GitHub → Settings → Branches | Require status checks: workflow **CI** |
| מייל נגישות | תיבת `accessibility@maaser-yashar.app` | שלחו מייל בדיקה וודאו קבלה |
| OG בוואטסאפ | אחרי redeploy | שתפו קישור; אם יש cache ישן — facebook sharing debugger / המתנה |
| סקירת רב | `docs/halakha-review.md` | שלחו לרב; **אל** תסמנו `RABBI_REVIEW.approved=true` בלי הסכמה מפורשת |

## אימות מקומי לפני פריסה

```bash
npm test
npx expo export -p web
npm run test:e2e
```

צילומי מסך לביקורת נוצרים אוטומטית ב־`docs/review-screenshots/` בזמן e2e (פרויקטי 390 ו־1280).
