import { test, expect } from '@playwright/test';

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

  // 10% of 12500 = 1250; given 750 → remaining 500
  await expect(page.getByTestId('remaining-amount')).toContainText('500');

  await page.getByTestId('save-month').click();
  await page.getByTestId('tab-history').click();
  // UI copy is without parentheses; count 0 means archive refreshed
  await expect(page.getByText('עדיין אין ארכיון')).toHaveCount(0);

  expect(calls).toEqual([]);
});

test('tab bar is not covered by floating elements', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג ישר לחשבון' }).click();
  await expect(page.getByTestId('tab-home')).toBeVisible({ timeout: 30_000 });

  const tabIds = [
    'tab-home',
    'tab-history',
    'tab-tax',
    'tab-guide',
    'tab-settings',
  ];
  for (const id of tabIds) {
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
