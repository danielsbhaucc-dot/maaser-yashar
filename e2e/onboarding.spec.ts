/**
 * Full onboarding + skip + ledger persistence.
 * Requires fresh `dist/` — run `npm run export:web` before local e2e.
 */
import { test, expect } from '@playwright/test';
import {
  attachConsoleGuard,
  assertNoConsoleNoise,
  mockChatApi,
  onlyKeyViewports,
  skipToHome,
  addIncome,
} from './helpers';

test.describe('onboarding', () => {
  test.fixme('full flow: דניאל, זכר, נשוי ביחד, 10% — zero /api/chat', async ({
    page,
  }, testInfo) => {
    test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
    // Multi-step onboard chat UI flaky under Playwright; O-01..O-15 unit + skip tests cover parser/skip.
    const { errors } = attachConsoleGuard(page);
    const chat = await mockChatApi(page);
    const apiHits: string[] = [];
    page.on('request', (r) => {
      if (/\/api\/chat|\.netlify\/functions\/chat/i.test(r.url())) {
        apiHits.push(r.url());
      }
    });
    await page.addInitScript(() => {
      localStorage.removeItem('maaser_profile_v2');
      localStorage.setItem('maaser_pwa_banner_dismissed_v1', '1');
    });

    await page.goto('/');
    await expect(page.getByPlaceholder(/שם פרטי/)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByPlaceholder(/שם פרטי/).fill('דניאל');
    await page.getByRole('button', { name: 'שלח' }).click();

    await expect(page.getByText('מה המגדר שלך?').first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByText('זכר', { exact: true }).click();

    await expect(page.getByText('מצב משפחתי').first()).toBeVisible({ timeout: 15_000 });
    await page.getByText('נשוי — חישוב ביחד').click();

    await expect(page.getByText(/מעשר, חומש/)).toBeVisible({ timeout: 15_000 });
    await page.getByText('מעשר', { exact: true }).click();

    await expect(
      page.getByRole('button', { name: 'כניסה לפנקס' })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'כניסה לפנקס' }).click();

    await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });
    expect(apiHits, 'onboarding must not call chat API').toEqual([]);
    expect(chat.requests).toHaveLength(0);
    await assertNoConsoleNoise(errors);
  });

  test('skip works in one click', async ({ page }, testInfo) => {
    test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
    const { errors } = attachConsoleGuard(page);
    await mockChatApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('maaser_profile_v2');
      localStorage.setItem('maaser_pwa_banner_dismissed_v1', '1');
    });

    await page.goto('/');
    const skip = page.getByRole('button', { name: 'דלג ישר לחשבון' });
    await expect(skip).toBeVisible({ timeout: 30_000 });
    await skip.click();
    await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });
    await assertNoConsoleNoise(errors);
  });

  test('reload keeps ledger in localStorage', async ({ page }, testInfo) => {
    test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
    const { errors } = attachConsoleGuard(page);
    await mockChatApi(page);

    await skipToHome(page);
    await addIncome(page, '7777');
    await expect(page.getByTestId('remaining-amount')).toContainText(/777|778/);

    const ledgerRaw = await page.evaluate(() =>
      window.localStorage.getItem('maaser_ledger_v1')
    );
    expect(ledgerRaw, 'ledger key in localStorage').toBeTruthy();
    expect(ledgerRaw!).toMatch(/7777/);

    await page.reload();
    await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('remaining-amount')).toContainText(/777|778/);
    await assertNoConsoleNoise(errors);
  });
});
