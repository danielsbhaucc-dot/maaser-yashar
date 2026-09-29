# Changelog לביקורת — מעשר ישר

**תאריך:** 29 בספטמבר 2026  
**פריסה מיועדת:** https://maaser-yashar.netlify.app/  
**⏸️ Redeploy:** נדחה במכוון ע״י המפתח — יבוצע ידנית מאוחר יותר. אחרי הפריסה: `npm run verify:prod`.

מסמך תוצאות: [`docs/predeploy-checklist.md`](./predeploy-checklist.md) · Ops: [`docs/ops-go-live.md`](./ops-go-live.md)

---

## מה חדש לביקורת

- Deep links, OG/RTL meta, 404 אמיתי, CI + Playwright
- ריכוך טענות הלכתיות + סעיף 46 freshness + סטטוס סקירת רב (בתהליך)
- חיזוק Noam (N-01…N-08): פעולות מאומתות, בלי טענות «רשמתי», הקשר פנקס חי, עמידות להזרקה
- Pre-deploy polish: טאבים צרים, יתרה מעל הקיפול, PWA/SW, CSP, צילומי מסך, סקריפט אימות פרוד

## בדיקות מקומיות

- `npm test` — עובר
- `npm run test:e2e` (אחרי `expo export`) — עובר ברוחבי 320–430 + 1280

## צילומים

`docs/review-screenshots/` — home / settings / guide (mobile + desktop)
