# בדיקות — מעשר ישר

## יחידה (unit)

```bash
npm test
```

Vitest על `src/**/__tests__` והמודולים ב־`netlify/functions` שמיובאים מהבדיקות.

בדיקת היגיינה בלבד:

```bash
npm run verify:hygiene
```

## E2E (Playwright)

אחרי ייצוא ווב:

```bash
npm run export:web
npm run test:e2e
```

## רגרסיית נועם (N-19)

### Mock (ברירת מחדל, מתאים ל־CI) — בלי רשת, בלי מפתח

```bash
npm run test:noam
# או במפורש:
npm run test:noam -- --mode=mock
```

מריץ את ה־pipeline הטהור (`chatSafety` + `chatPipeline`) על תשובות canned ב־`scripts/fixtures/noam-canned.json`.

### Live — עולה כסף

```bash
# שרת מקומי (netlify dev) עם OPENROUTER_API_KEY ב־env של השרת:
npm run test:noam -- --mode=live

# או מול preview:
CHAT_API_URL=https://<preview>.netlify.app/api/chat npm run test:noam -- --mode=live
```

- ברירת מחדל: `CHAT_API_URL=http://localhost:8888/api/chat`
- **אל תריצו live מול production** (`maaser-yashar.netlify.app`) — הסקריפט מסרב, אלא אם מעבירים במפורש `--i-know-this-costs-money`
- בין בקשות יש השהייה אקראית 1–3 שניות
- פלט: `scripts/fixtures/last-run.json` ו־`docs/noam-regression-report.md`

## הכל ביחד (unit + e2e + noam mock)

```bash
npm run test:all
```

דורש ש־e2e יוכל לרוץ (ייצוא / שרת סטטי לפי הגדרת Playwright בפרויקט).
