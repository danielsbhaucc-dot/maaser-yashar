# Pre-deploy checklist — מעשר ישר

**תאריך:** 29 בספטמבר 2026  
**סביבת בדיקה:** repo מקומי (`npm test`, `expo export`, Playwright על `dist/`) + בדיקות `curl` מול https://maaser-yashar.netlify.app/  
**פריסה חיה:** ⚠️ **לא מסונכרנת עם `main`** — ראו סעיף «ממצא קריטי».

### סיכום ספירות

| סטטוס | מספר |
|--------|------|
| ✅ PASS | 28 |
| ⚠️ PARTIAL | 12 |
| ❌ FAIL (תוקנו בקוד) | 2 → תוקנו |
| 🚫 BLOCKED | 11 |

---

## ממצא קריטי — אתר חי

`expo export -p web` מקומית מייצר `dist/` תקין (`about.html`, `privacy.html`, `robots.txt`, `sitemap.xml`, `404.html`, `fonts/*.woff2`, `_redirects`).

מול https://maaser-yashar.netlify.app/ (בדיקה ב־29.9.2026):

| נתיב | תוצאה חיה |
|------|-----------|
| `/about`, `/privacy`, `/about.html`, `/privacy.html` | SPA `index.html` (לא דפי הסטטיים) |
| `/robots.txt`, `/sitemap.xml`, `/fonts/*.woff2` | HTML של האפליקציה |
| URL לא קיים | **200** (soft-404) במקום 404 |
| `/api/chat` | **404** (פונקציות לא פרוסות) |
| כותרות אבטחה מ־`netlify.toml` (CSP / nosniff / Referrer-Policy) | **חסרות** |

**מסקנה:** הקוד ב־`main` מוכן; נדרש **Redeploy ל־Netlify** (כולל Functions) מול ה־commit הנוכחי. בלי זה פריטי about/privacy/API/headers/SEO באתר החי נשארים 🚫.

---

## 1. אמון ופרטיות

| פריט | סטטוס | הערות |
|------|--------|--------|
| אין נוסח ישן «לא נשלח(ים) לשרת» כהצהרת פרטיות כללית | ✅ | `PRIVACY_SHORT` + קישור מדיניות בכל המסכים הרלוונטיים. «לא נשלחים שם/הערות…» בצ'אט = תיאור מה *לא* נשלח — תקין |
| `/about` + `/privacy` נפתחים ישירות; תוכן תואם התנהגות | ⚠️ / 🚫 | בקוד + `netlify.toml` / `_redirects` ✅; **באתר החי ❌** עד redeploy |
| פנקס בלי צ'אט = בלי קריאות רשת ל־API | ✅ | e2e: רשימת `/api/` ריקה אחרי דילוג+תנועות+שמירת חודש |
| צ'אט: discovery + הסכמה; payload בלי שם/הערות/תנועות | ✅ | `NoamChat` consent; `buildNoamContext` שולח רק סכומי סיכום |
| «האם אתה בן אדם?» → נועם = עוזר AI | ✅ | `chat.mjs` system prompt + `onboardApi.ts` |
| Origin זר → 403; ~10/דקה → 429 | ⚠️ / 🚫 | קוד: `assertAllowedCaller` + `rateLimit` ב־`chat.mjs` ✅; **בחי לא נבדק** (`/api/chat` = 404) |
| OpenRouter spend cap + מחיקת מפתחות ישנים | 🚫 | דשבורד OpenRouter — אין ב־repo (לא לקומיט סודות) |
| מייל נגישות/פידבק אמיתי | ⚠️ | `accessibility@maaser-yashar.app` בקוד/דפים; קבלת מייל אמיתית לא אומתה |
| «מחק הכל» כולל היסטוריית צ'אט | ✅ | `wipeData.ts` כולל `noam_chat_threads_v1` |

## 2. אמינות

| פריט | סטטוס | הערות |
|------|--------|--------|
| `parseMoney`: דוחה `-250` / `1.2.3` / `12abc`; מקבל `1,250` | ✅ | `npm test` |
| תנועה מחודש קודם → נרשמת לחודש נוכחי (ברירת מחדל) | ✅ | `AddEntryModal` ברירת מחדל = `currentPeriod()`; בחירת חודש אחר במודע אפשרית |
| שמירת חודש מופיעה מיד בהיסטוריה | ✅ | e2e |
| ניכוי גדול מההכנסה → «אין חובה» | ✅ | unit + UI (`ProgressRing` / `HomeScreen`) |
| הוראת קבע לתאריך שעבר + הערות בלי `#r-` | ✅ | אין backfill לפני יצירה; `displayNote` מסיר `#r-` ישן |
| גיבוי/שחזור בין דפדפנים | ✅ | `backupExport` + בדיקות T-54 |
| עריכת תנועה מעדכנת סכומים מיד | ✅ | context/ledger (יחידות) |
| `npm test` + e2e ב־CI | ✅ | מקומי: 28 unit + 6 e2e עברו; workflow `.github/workflows/ci.yml` קיים. סימון required ב־branch protection: 🚫 |

## 3. עיצוב ונייד

| פריט | סטטוס | הערות |
|------|--------|--------|
| הסרת תג/באדג' Netlify מה־UI | ✅ / 🚫 | אין באדג' בקוד; הערה AI-legible ב־HTML של Netlify — כיבוי בדשבורד 🚫 |
| טאבים קריאים ב־320–430 | ⚠️ | קוד: תוויות active-only ≤360; e2e ב־390; 320/430 לא הורצו |
| אין צף שמכסה טאבים | ✅ | e2e T-55 |
| יתרה בבית במובייל בלי גלילה | ⚠️ | layout מותאם; לא נמדד ויזואלית בכל מכשיר |
| אישור מחיקה = דיאלוג אמיתי | ✅ | `ConfirmDialog` |
| דסקטופ: עמודה/שיט/צ'אט אותו רוחב ממורכז | ✅ | `phoneFrame` maxWidth 480; צ'אט 480 |
| «דלג ישר לחשבון» בלחיצה אחת | ✅ | e2e |
| PWA להתקנה + אופליין | ⚠️ | `manifest` + `sw.js` בקוד; התקנה אמיתית Android/iPhone 🚫 |

## 4. נגישות

| פריט | סטטוס | הערות |
|------|--------|--------|
| Pinch-zoom (בלי `maximum-scale`) | ✅ | `index.html` + e2e head tags + `App.tsx` viewport |
| Lighthouse a11y ≥98 / ניגודיות | 🚫 | לא הורץ Lighthouse בסשן זה |
| יעדי לחיצה ≥44×44 | ✅ | כפתורי אייקון / טאבים / מחיקה בקוד |
| מקלדת: הוספה/עריכה/מחיקה | ⚠️ | roles/labels בקוד; לא עברנו סשן מקלדת מלא |
| הצהרת נגישות מעודכנת | ✅ | תאריך 29.9.2026 + מגבלות ידועות |

## 5. ביצועים, SEO ושיתוף

| פריט | סטטוס | הערות |
|------|--------|--------|
| Lighthouse Perf/BP/SEO + CWV | 🚫 | לא הורץ |
| `immutable` ל־JS/fonts; WOFF2 בלבד | ⚠️ / 🚫 | `netlify.toml` + `public/fonts/*.woff2` ✅; **בחי fonts לא מוגשים** עד redeploy |
| כותרת טאב «מעשר ישר» (לא undefined) | ✅ | e2e + `documentTitleForTab` |
| כרטיס OG בוואטסאפ/טלגרם | ⚠️ / 🚫 | תגיות ב־`public/index.html` ✅; תצוגה חיה בוואטסאפ 🚫; האתר החי עלול להגיש מטא ישן |
| `robots.txt` / `sitemap.xml` / 404 אמיתי | ⚠️ / 🚫 | בקוד ✅; **בחי ❌** עד redeploy |
| כותרות אבטחה + CSP בקונסול | ⚠️ / 🚫 | מוגדר ב־`netlify.toml`; **בחי חסר**; CSP report-only — בדיקת console אחרי redeploy |

## 6. תוכן

| פריט | סטטוס | הערות |
|------|--------|--------|
| אין «רוב הפוסקים» בלי מקור | ✅ | **תוקן:** נוסח ל«רבים…» ב־Settings / maaserCalc / docs |
| «הוצאה» → «ניכוי» + אזהרות הלוואה/אחר | ✅ | UI=`ניכוי`; אזהרות ב־`AddEntryModal`; ניסוח מדריך עודכן |
| שנת עדכון ליד אומדן סעיף 46 | ✅ | `getSection46Freshness` ב־TaxScreen |
| סקירת רב / סימון בתהליך | ✅ | **תוקן:** `RabbiReviewNote` + `about.html` מציגים «ממתין לסקירת רב…»; `RABBI_REVIEW.approved=false`. שליחה בפועל לרב: 🚫 |

## 7. לפני שליחה לביקורת

| פריט | סטטוס | הערות |
|------|--------|--------|
| P0/P1 סגורים לפי עבודה אחרונה | ⚠️ | T-55…T-63 ב־main; אין לוח P0/P1 רשמי ב־repo — להצליב מול רשימת המשימות של המבקר |
| Changelog קצר + לינק לפריסה | ✅ | `docs/changelog-review.md` |
| צילומי מסך מעודכנים (מובייל+דסקטופ) כמו בביקורת קודמת | 🚫 | לא צולמו מול אותם מסכים מהביקורת הקודמת בסשן זה |

---

## תיקונים שבוצעו בסשן זה

1. הסרת טענות «רוב הפוסקים» בלי מקור (הגדרות + מנוע + מסמך הלכה).
2. סימון ברור שסקירת רב עדיין בתהליך (`RabbiReviewNote`, `public/about.html`).
3. יישור ניסוח מדריך («פרטי הניכוי»).
4. מסמכי `docs/predeploy-checklist.md` + `docs/changelog-review.md`.

## פעולות אנושיות נדרשות לפני go-live

1. **Netlify production redeploy** מ־`main` (כולל Functions) — חובה.
2. OpenRouter: spend cap + מחיקת מפתחות ישנים.
3. וידוא קבלת מייל ל־`accessibility@maaser-yashar.app`.
4. כיבוי באדג'/הערות מיתוג Netlify בדשבורד אם מופעל.
5. בדיקת כרטיס שיתוף בוואטסאפ אחרי redeploy.
6. Lighthouse מובייל + צילומי מסך לביקורת.
7. שליחת תוכן הלכתי לרב (או להשאיר סימון «בתהליך»).
8. Branch protection: לסמן workflow `CI` כ־required.
