/**
 * E2E: גיבוי / מחיקה / PIN / אזהרת גיבוי — רק ב־390 ו־1280
 */
import { test, expect } from '@playwright/test';

test.beforeEach(({}, testInfo) => {
  test.skip(
    !['mobile-390', 'desktop-1280'].includes(testInfo.project.name),
    'data-safety acceptance widths only'
  );
});

/** ניקוי חד־פעמי — לא addInitScript (שמוחק גם אחרי שמירת PIN) */
async function clearStorageOnce(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.reload();
}

async function skipToHome(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'דלג ישר לחשבון' }).click();
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });
}

test('empty new profile: no stale-backup warning', async ({ page }) => {
  await clearStorageOnce(page);
  await skipToHome(page);
  await expect(page.getByText('עבר יותר מחודש בלי גיבוי')).toHaveCount(0);
});

test('delete-all returns to onboarding', async ({ page }) => {
  await clearStorageOnce(page);
  await skipToHome(page);
  await page.getByTestId('tab-settings').click();
  const wipeBtn = page.getByLabel('מחק את כל הנתונים');
  await wipeBtn.scrollIntoViewIfNeeded();
  await expect(wipeBtn).toBeVisible({ timeout: 15_000 });
  await wipeBtn.click();
  await page.getByRole('button', { name: 'מחק הכל' }).click();
  await expect(page.getByRole('button', { name: 'דלג ישר לחשבון' })).toBeVisible({
    timeout: 30_000,
  });
});

test('PIN lock screen after enable + reload; plain pin absent', async ({ page }) => {
  await clearStorageOnce(page);
  await skipToHome(page);
  await page.getByTestId('tab-settings').click();
  const enable = page.getByRole('button', { name: /הפעל נעילת קוד|הפעילי נעילת קוד/ });
  await enable.scrollIntoViewIfNeeded();
  await expect(enable).toBeVisible({ timeout: 15_000 });
  await enable.click();
  await page.getByLabel('קוד חדש').fill('2468');
  await page.getByLabel('אימות הקוד').fill('2468');
  await page.getByRole('button', { name: 'שמור קוד' }).click();
  await expect(page.getByText('סטטוס: פעילה')).toBeVisible({ timeout: 10_000 });

  const stored = await page.evaluate(() => {
    const values = Object.values(localStorage);
    const pinRaw =
      values.find(
        (v) => typeof v === 'string' && v.includes('"salt"') && v.includes('"hash"')
      ) ?? null;
    return {
      pinRaw,
      hasPlain: values.some((v) => typeof v === 'string' && v.includes('2468')),
    };
  });
  expect(stored.hasPlain).toBe(false);
  expect(stored.pinRaw).toBeTruthy();
  expect(stored.pinRaw!).not.toContain('2468');

  await page.goto('/');
  await expect(page.getByText('הפנקס נעול')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('קוד נעילה, 4 עד 6 ספרות')).toBeVisible();
  await expect(page.getByRole('button', { name: 'שכחתי את הקוד' })).toBeVisible();
});

test('error boundary crash probe shows recovery copy', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    try {
      localStorage.clear();
      localStorage.setItem(
        'maaser_profile_v2',
        JSON.stringify({
          onboardingDone: true,
          displayName: 'בדיקה',
          gender: 'unspecified',
          maritalStatus: 'unknown',
          includeSpouse: false,
          rate: 0.1,
          chatShareTotals: true,
          saveChatHistory: true,
          chatConsentDone: true,
          carryForwardSurplus: false,
          advanced: { enabled: true },
        })
      );
    } catch {
      /* ignore */
    }
  });
  // __crash רק ב־non-production — serve של dist הוא production bundle
  await page.goto('/?__crash=1');
  const recovery = page.getByText('משהו השתבש. הנתונים שלך שמורים במכשיר');
  const homeFab = page.getByTestId('fab-add');
  const which = await Promise.race([
    recovery.waitFor({ timeout: 20_000 }).then(() => 'crash' as const),
    homeFab.waitFor({ timeout: 20_000 }).then(() => 'home' as const),
  ]);
  if (which === 'home') {
    test.skip(true, 'production bundle — __crash probe stripped');
  }
  await expect(page.getByRole('button', { name: 'טען מחדש' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'הורד גיבוי' })).toBeVisible();
});
