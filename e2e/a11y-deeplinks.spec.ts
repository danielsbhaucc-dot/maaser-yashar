import { test, expect } from '@playwright/test';

async function skipToHome(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג ישר לחשבון' }).click();
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });
}

const ROUTES = [
  { path: '/history', tab: 'tab-history', title: /היסטוריה|ארכיון/ },
  { path: '/tax', tab: 'tab-tax', title: /החזר מס|מס/ },
  { path: '/guide', tab: 'tab-guide', title: /הנחיות|מדריך/ },
  { path: '/settings', tab: 'tab-settings', title: /הגדרות|עוד/ },
] as const;

test.describe('deep links (T-59)', () => {
  for (const route of ROUTES) {
    test(`opens ${route.path} on the correct tab`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'דלג ישר לחשבון' }).click();
      await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });

      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(`${route.path.replace('/', '\\/')}(\\?|#|$)`));
      await expect(page.getByTestId(route.tab)).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveTitle(/מעשר ישר/);
    });
  }

  test('tab click updates URL; browser back restores previous tab', async ({
    page,
  }) => {
    await skipToHome(page);
    await expect(page).toHaveURL(/\/(\?|#|$)/);

    await page.getByTestId('tab-tax').click();
    await expect(page).toHaveURL(/\/tax(\?|#|$)/);
    await expect(page.getByTestId('tab-tax')).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId('tab-settings').click();
    await expect(page).toHaveURL(/\/settings(\?|#|$)/);

    await page.goBack();
    await expect(page).toHaveURL(/\/tax(\?|#|$)/);
    await expect(page.getByTestId('tab-tax')).toHaveAttribute('aria-selected', 'true');

    await page.goBack();
    await expect(page.getByTestId('tab-home')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('keyboard ledger + chat (T-49)', () => {
  test('add, edit, delete with undo, open/close Noam via keyboard', async ({
    page,
  }) => {
    await skipToHome(page);

    // Add income
    await page.getByTestId('fab-add').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('amount-input')).toBeVisible();
    await page.getByTestId('kind-income').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('amount-input').fill('5000');
    await page.getByTestId('save-entry').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('amount-input')).toHaveCount(0);
    await expect(page.getByTestId('remaining-amount')).toBeVisible();

    // Edit first ledger row (Enter on row)
    const row = page.getByRole('button', { name: /הכנסה|משכורת|5,?000/ }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('amount-input')).toBeVisible();
    await page.getByTestId('amount-input').fill('4500');
    await page.getByTestId('save-entry').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('amount-input')).toHaveCount(0);

    // Delete via delete button + confirm dialog, then undo toast
    const del = page.getByRole('button', { name: /מחק/ }).first();
    await del.focus();
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('button', { name: 'מחק' }).last();
    await expect(confirm).toBeVisible();
    await confirm.focus();
    await page.keyboard.press('Enter');

    const undo = page.getByRole('button', { name: 'בטל' }).first();
    if (await undo.count()) {
      await undo.focus();
      await page.keyboard.press('Enter');
    }

    // Noam chat open/close
    const noam = page.getByRole('button', { name: 'נועם' }).first();
    await expect(noam).toBeVisible();
    await noam.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  });

  test('exactly one main landmark on home', async ({ page }) => {
    await skipToHome(page);
    const mains = page.locator('[role="main"]');
    await expect(mains).toHaveCount(1);
  });
});

/** CSP Report-Only → enforce probe (T-09) */
const PROPOSED_CSP =
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";

test('CSP proposed policy has no violations on main screens', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cspV: string[] }).__cspV = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      const ev = e as SecurityPolicyViolationEvent;
      (window as unknown as { __cspV: string[] }).__cspV.push(
        `${ev.violatedDirective}|${ev.blockedURI}|${ev.effectiveDirective}`
      );
    });
  });

  await page.route('**/*', async (route) => {
    const res = await route.fetch();
    const headers = {
      ...res.headers(),
      'content-security-policy-report-only': PROPOSED_CSP,
    };
    await route.fulfill({ response: res, headers });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'דלג ישר לחשבון' }).click();
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });

  for (const id of [
    'tab-history',
    'tab-tax',
    'tab-guide',
    'tab-settings',
    'tab-home',
  ] as const) {
    await page.getByTestId(id).click();
    await page.waitForTimeout(500);
  }

  const violations = await page.evaluate(
    () => (window as unknown as { __cspV: string[] }).__cspV ?? []
  );
  expect(violations, `CSP violations: ${violations.join(' | ')}`).toEqual([]);
});
