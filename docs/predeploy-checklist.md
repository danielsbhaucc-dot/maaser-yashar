# Pre-deploy checklist — מעשר ישר

**תאריך עדכון:** 29 בספטמבר 2026  
**סביבת בדיקה:** repo מקומי (`npm test` 54✓, Playwright e2e על `dist/` ברוחבי 320/360/390/430/1280)  
**פריסת Netlify חיה:** ⏸️ **נדחתה במכוון ע״י המשתמש** (יפרוס מאוחר יותר) — לא כשל בקוד. אחרי redeploy להריץ `npm run verify:prod`.

### סיכום ספירות (אחרי סבב תיקונים ב־repo)

| סטטוס | מספר |
|--------|------|
| ✅ PASS | 42 |
| ⚠️ PARTIAL | 2 |
| ❌ FAIL | 0 |
| 🚫 BLOCKED (אנושי / דשבורד בלבד) | 7 |
| ⏸️ DEFERRED (פריסה חיה — בחירת משתמש) | פריטי live sync |

---

## מה תוקן בסבב זה (בקוד)

| נושא | שינוי |
|------|--------|
| טאבים 320–430 | תוויות מקוצרות תמיד גלויות (`shortTitle`); e2e בכל הרוחבים |
| יתרה בלי גלילה | כרטיס יתרה הועבר מעל באנרים משניים ב־`HomeScreen` |
| מקלדת | e2e: הוספת הכנסה ב־Enter |
| PWA / אופליין | `sw.js` v2 + precache fonts/about/privacy + `offline.html` |
| CSP / headers | חיזוק ב־`netlify.toml` (X-Frame-Options, CSP RO בלי Google Fonts) |
| צילומי מסך | `docs/review-screenshots/` (mobile+desktop: home/settings/guide) |
| Ops | `docs/ops-go-live.md`, `.env.example`, `scripts/verify-prod.mjs`, `npm run verify:prod` |
| מחיקת junk | `_verify_n05_n06.mjs` הוסר מהמעקב |

---

## 1. אמון ופרטיות

| פריט | סטטוס | הערות |
|------|--------|--------|
| אין נוסח ישן «לא נשלח לשרת» | ✅ | `PRIVACY_SHORT` + קישור |
| `/about` + `/privacy` בקוד | ✅ | `netlify.toml` + `_redirects` + HTML סטטי |
| פנקס בלי צ'אט = בלי API | ✅ | e2e |
| צ'אט: discovery + הסכמה + payload מצומצם | ✅ | |
| «האם אתה בן אדם?» → AI | ✅ | |
| Origin זר → 403 / rate 429 | ✅ | בקוד (`_shared` + `rateLimit`); אימות חי אחרי deploy |
| OpenRouter spend + מפתחות ישנים | 🚫 | דשבורד OpenRouter בלבד |
| מייל נגישות אמיתי | ⚠️ | כתובת בקוד: `accessibility@maaser-yashar.app` — קבלה בתיבה לא אומתה |
| מחק הכל כולל צ'אט | ✅ | |

## 2. אמינות

| פריט | סטטוס | הערות |
|------|--------|--------|
| parseMoney / חודש / היסטוריה / אין חובה / הוראות קבע / גיבוי / עריכה | ✅ | unit + e2e |
| npm test + e2e ב־CI | ✅ | workflow קיים; סימון required ב־GitHub: 🚫 |

## 3. עיצוב ונייד

| פריט | סטטוס | הערות |
|------|--------|--------|
| באדג' Netlify בקוד | ✅ | אין באדג' ב־UI; כיבוי בדשבורד: 🚫 |
| טאבים 320–430 | ✅ | e2e עבר |
| אין צף על טאבים | ✅ | |
| יתרה בלי גלילה | ✅ | layout + e2e |
| דיאלוג מחיקה / רוחב דסקטופ / דלג לחשבון | ✅ | |
| PWA + אופליין | ✅ | בקוד; התקנה אמיתית במכשיר: 🚫 |

## 4. נגישות

| פריט | סטטוס | הערות |
|------|--------|--------|
| Pinch zoom / יעדי 44px / הצהרה | ✅ | |
| מקלדת הוספה/עריכה | ✅ | e2e הוספה; עריכה/מחיקה — roles בקוד |
| Lighthouse a11y ≥98 | ⚠️ | לא הורץ Lighthouse מלא בסשן; ניגודיות/יעדים מטופלים בקוד |

## 5. ביצועים SEO שיתוף

| פריט | סטטוס | הערות |
|------|--------|--------|
| immutable / WOFF2 / OG / robots / sitemap / 404 / headers | ✅ | מוגדר ב־repo; תוקף בחי אחרי deploy המשתמש |
| Lighthouse Perf/SEO | ⚠️ | לא הורץ; CWV בחי אחרי deploy |
| כרטיס WhatsApp | 🚫 | תגיות בקוד ✅; תצוגה חיה אחרי deploy |

## 6. תוכן

| פריט | סטטוס | הערות |
|------|--------|--------|
| בלי «רוב הפוסקים» בלי מקור / ניכוי / סעיף 46 / סימון סקירת רב | ✅ | `RABBI_REVIEW.approved=false` |
| שליחה בפועל לרב | 🚫 | `docs/halakha-review.md` מוכן לשליחה |

## 7. לפני ביקורת

| פריט | סטטוס | הערות |
|------|--------|--------|
| P0/P1 אחרונים ב־main | ✅ | T-55…T-63 + N-01…N-08 נסגרו בקוד; אין לוח חיצוני |
| Changelog | ✅ | `docs/changelog-review.md` + `docs/ops-go-live.md` |
| צילומי מסך | ✅ | `docs/review-screenshots/` |

---

## נשאר לאדם (לא ניתן לסגור ב־repo)

1. **Netlify redeploy** מ־`main` (בחירת משתמש — מאוחר יותר) → אז `npm run verify:prod`
2. OpenRouter: spend cap + מחיקת מפתחות ישנים  
3. וידוא קבלת מייל ל־`accessibility@maaser-yashar.app`  
4. כיבוי באדג'/מיתוג Netlify בדשבורד (אם מופעל)  
5. בדיקת כרטיס שיתוף בוואטסאפ אחרי deploy  
6. Branch protection: Require checks → workflow **CI**  
7. שליחת תוכן הלכתי לרב (בלי לסמן `approved` בלי הסכמה)  
8. (אופציונלי) Lighthouse מובייל מול הפריסה החיה  

מדריך מפורט: [`docs/ops-go-live.md`](./ops-go-live.md)
