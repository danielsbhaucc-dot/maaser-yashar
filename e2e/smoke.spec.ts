import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const TAB_IDS = [
  'tab-home',
  'tab-history',
  'tab-tax',
  'tab-guide',
  'tab-settings',
] as const;

async function skipToHome(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג ישר לחשבון' }).click();
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });
}

test('skip onboarding, 10% scenario, archive refresh, no network', async ({
  page,
}) => {
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

  expect(calls).toEqual([]);
});

test('tab bar clickable and labels visible at acceptance widths', async ({
  page,
}) => {
  await skipToHome(page);
  await expect(page.getByTestId('tab-home')).toBeVisible({ timeout: 30_000 });

  for (const id of TAB_IDS) {
    const tab = page.getByTestId(id);
    await expect(tab).toBeVisible();
    await expect(tab).toContainText(/.+/);
    const free = await page.evaluate((tid) => {
      const el = document.querySelector(`[data-testid="${tid}"]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2
      );
      return !!hit && el.contains(hit);
    }, id);
    expect(free, id).toBe(true);
  }
});

test('home balance visible without scrolling', async ({ page }) => {
  await skipToHome(page);
  await page.getByTestId('fab-add').click();
  await page.getByTestId('kind-income').click();
  await page.getByTestId('amount-input').fill('5000');
  await page.getByTestId('save-entry').click();
  await expect(page.getByTestId('amount-input')).toHaveCount(0);

  const remaining = page.getByTestId('remaining-amount');
  await expect(remaining).toBeVisible();
  const inView = await remaining.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= (window.innerHeight || 0) + 1;
  });
  expect(inView).toBe(true);
});

test('keyboard can add an income entry', async ({ page }) => {
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
});

test('head tags', async ({ page }) => {
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
});

test('review screenshots (mobile + desktop key screens)', async ({
  page,
}, testInfo) => {
  // רק בפרויקטי הקצה — חוסך כפילויות ב־CI
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
