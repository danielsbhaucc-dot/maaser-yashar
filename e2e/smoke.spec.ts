/**
 * Smoke + acceptance flows. Requires fresh `dist/` — `npm run export:web` first.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  TAB_IDS,
  attachConsoleGuard,
  assertNoConsoleNoise,
  mockChatApi,
  skipToHome,
  addIncome,
  isTopAtCenter,
  isTopAtCenterChatBtn,
  onlyKeyViewports,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await mockChatApi(page);
});

test('skip onboarding, 10% scenario, archive refresh, no network', async ({
  page,
}) => {
  const { errors } = attachConsoleGuard(page);
  const calls: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/|\.netlify\/functions\//.test(r.url())) calls.push(r.url());
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/מעשר ישר/);

  await page.getByRole('button', { name: 'דלג ישר לחשבון' }).click();
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });

  const steps: Array<['income' | 'tzedaka', string]> = [
    ['income', '10000'],
    ['income', '2500'],
    ['tzedaka', '300'],
    ['tzedaka', '450'],
  ];
  for (const [kind, amount] of steps) {
    await page.getByTestId('fab-add').click();
    await page.getByTestId(`kind-${kind}`).click();
    await page.getByTestId('amount-input').fill(amount);
    await page.getByTestId('save-entry').click();
    await expect(page.getByTestId('amount-input')).toHaveCount(0);
  }

  await expect(page.getByTestId('remaining-amount')).toContainText('500');

  await page.getByTestId('save-month').click();
  await page.getByTestId('tab-history').click();
  await expect(page.getByText('עדיין אין ארכיון')).toHaveCount(0);

  // Ledger-only path — no chat → no API (mocks installed but unused)
  expect(calls).toEqual([]);
  await assertNoConsoleNoise(errors);
});

test('tab bar + chat button elementFromPoint (390 / 1280)', async ({
  page,
}, testInfo) => {
  test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);
  await expect(page.getByTestId('tab-home')).toBeVisible({ timeout: 30_000 });

  for (const id of TAB_IDS) {
    const tab = page.getByTestId(id);
    await expect(tab).toBeVisible();
    await expect(tab).toContainText(/.+/);
    expect(await isTopAtCenter(page, id), id).toBe(true);
  }

  const chatOk = await isTopAtCenterChatBtn(page);
  expect(chatOk, 'chat header button').toBe(true);
  await assertNoConsoleNoise(errors);
});

// Deep links covered in e2e/a11y-deeplinks.spec.ts (T-59)

test('home balance visible without scrolling', async ({ page }) => {
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);
  await addIncome(page, '5000');

  const remaining = page.getByTestId('remaining-amount');
  await expect(remaining).toBeVisible();
  const inView = await remaining.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= (window.innerHeight || 0) + 1;
  });
  expect(inView).toBe(true);
  await assertNoConsoleNoise(errors);
});

test('keyboard can add an income entry', async ({ page }) => {
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);

  await page.getByTestId('fab-add').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('amount-input')).toBeVisible();

  await page.getByTestId('kind-income').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('amount-input').fill('1200');
  await page.getByTestId('save-entry').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('amount-input')).toHaveCount(0);
  await expect(page.getByTestId('remaining-amount')).toBeVisible();
  await assertNoConsoleNoise(errors);
});

test('add / edit / delete+undo', async ({ page }, testInfo) => {
  test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);
  await addIncome(page, '2000');

  // Edit: open ledger row (not the "הוסף הכנסה" action) → change amount
  await page.getByRole('button', { name: /משכורת.*,.*2,?000|2,?000/ }).first().click();
  await expect(page.getByTestId('amount-input')).toBeVisible();
  await page.getByTestId('amount-input').fill('2500');
  await page.getByTestId('save-entry').click();
  await expect(page.getByTestId('amount-input')).toHaveCount(0);
  await expect(page.getByTestId('remaining-amount')).toContainText('250');

  // Delete + undo
  await page.getByRole('button', { name: /^מחק / }).first().click();
  await page.getByRole('button', { name: 'מחק', exact: true }).click();
  await expect(page.getByText(/התנועה נמחקה|מחק — בטל/).first()).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'בטל' }).click();
  await expect(page.getByTestId('remaining-amount')).toContainText('250');
  await assertNoConsoleNoise(errors);
});

test('recurring rule from add modal', async ({ page }, testInfo) => {
  test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);

  await page.getByTestId('fab-add').click();
  await page.getByTestId('kind-income').click();
  await page.getByTestId('amount-input').fill('3000');
  await page.getByRole('switch', { name: 'הוראת קבע חודשית' }).click();
  await page.getByTestId('save-entry').click();
  await expect(page.getByTestId('amount-input')).toHaveCount(0);
  await page.keyboard.press('Escape').catch(() => {});

  await page.getByTestId('tab-settings').click({ force: true });
  await expect(page.getByText(/משכורת · כל \d+ בחודש|₪3,?000/).first()).toBeVisible({
    timeout: 15_000,
  });
  await assertNoConsoleNoise(errors);
});

test('tax form persists across reload', async ({ page }, testInfo) => {
  test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);

  await page.getByTestId('tab-tax').click({ force: true });
  await expect(page.getByTestId('tab-tax')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('החזר מס').first()).toBeVisible({ timeout: 15_000 });
  // Chip "יודע הכנסה חייבת" also matches getByLabel — prefer textbox role
  await page.getByRole('button', { name: 'יודע הכנסה חייבת' }).click();
  const income = page.getByRole('textbox', { name: 'הכנסה חייבת' });
  await income.fill('120000');
  await page.waitForTimeout(400);

  await page.reload();
  await page.getByTestId('tab-tax').click({ force: true });
  await expect(page.getByRole('textbox', { name: 'הכנסה חייבת' })).toHaveValue(
    /120,?000|120000/,
    { timeout: 15_000 }
  );
  await assertNoConsoleNoise(errors);
});

test('backup JSON download smoke', async ({ page }, testInfo) => {
  test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);
  await addIncome(page, '1500');

  await page.getByTestId('tab-settings').click();
  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('button', { name: /גיבוי JSON/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/i);
  await assertNoConsoleNoise(errors);
});

test('CSV export smoke from settings', async ({ page }, testInfo) => {
  test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);
  await addIncome(page, '900');

  await page.getByTestId('tab-settings').click();
  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('button', { name: /ייצוא פנקס \(CSV\)/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  await assertNoConsoleNoise(errors);
});

test('head tags', async ({ page }) => {
  const { errors } = attachConsoleGuard(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /og\.png/
  );
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute(
    'content',
    /maximum-scale/
  );
  await assertNoConsoleNoise(errors);
});

test('review screenshots (mobile + desktop key screens)', async ({
  page,
}, testInfo) => {
  const name = testInfo.project.name;
  test.skip(
    name !== 'mobile-390' && name !== 'desktop-1280',
    'screenshots only on 390 and 1280'
  );

  const outDir = path.join(process.cwd(), 'docs', 'review-screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  const prefix = name.startsWith('mobile') ? 'mobile' : 'desktop';

  await skipToHome(page);
  await page.getByTestId('fab-add').click();
  await page.getByTestId('kind-income').click();
  await page.getByTestId('amount-input').fill('10000');
  await page.getByTestId('save-entry').click();
  await expect(page.getByTestId('remaining-amount')).toBeVisible();

  await page.screenshot({
    path: path.join(outDir, `${prefix}-home.png`),
    fullPage: false,
  });

  await page.getByTestId('tab-settings').click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, `${prefix}-settings.png`),
    fullPage: false,
  });

  await page.getByTestId('tab-guide').click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, `${prefix}-guide.png`),
    fullPage: false,
  });
});
