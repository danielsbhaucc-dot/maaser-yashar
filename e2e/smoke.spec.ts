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

const TAB_PATHS: Record<(typeof TAB_IDS)[number], string> = {
  'tab-home': '/',
  'tab-history': '/history',
  'tab-tax': '/tax',
  'tab-guide': '/guide',
  'tab-settings': '/settings',
};

const SHORT_LABELS = ['בית', 'ארכיון', 'מס', 'מדריך', 'עוד'];
const LONG_LABELS = ['בית', 'היסטוריה', 'החזר מס', 'הנחיות', 'הגדרות'];

test.beforeEach(async ({ page }) => {
  await mockChatApi(page);
});

async function assertPointIsTarget(
  page: import('@playwright/test').Page,
  testId: string
) {
  const free = await page.evaluate((tid) => {
    const el = document.querySelector(`[data-testid="${tid}"]`);
    if (!el) return { ok: false, reason: 'missing' };
    const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { ok: false, reason: 'no-hit' };
    const ok = el === hit || el.contains(hit);
    return {
      ok,
      reason: ok ? 'ok' : (hit as HTMLElement).tagName,
    };
  }, testId);
  expect(free.ok, `${testId}: ${free.reason}`).toBe(true);
}

async function assertNoOverlayAboveBar(
  page: import('@playwright/test').Page,
  barTestId: string
) {
  const bad = await page.evaluate((tid) => {
    const bar = document.querySelector(`[data-testid="${tid}"]`);
    if (!bar) return 'missing-bar';
    const br = bar.getBoundingClientRect();
    const barZ = Number.parseInt(getComputedStyle(bar as HTMLElement).zIndex || '0', 10) || 0;
    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    for (const el of all) {
      if (bar === el || bar.contains(el)) continue;
      if (el.closest('[data-testid="noam-chat-fab"]')) continue;
      if (el.closest('[data-testid="fab-add"]')) continue;
      const st = getComputedStyle(el);
      const pos = st.position;
      if (pos !== 'fixed' && pos !== 'absolute') continue;
      const z = Number.parseInt(st.zIndex || '0', 10) || 0;
      if (z <= barZ) continue;
      const r = el.getBoundingClientRect();
      const overlaps =
        r.width > 0 &&
        r.height > 0 &&
        r.left < br.right &&
        r.right > br.left &&
        r.top < br.bottom &&
        r.bottom > br.top;
      if (overlaps) {
        return el.getAttribute('data-testid') || el.className || el.tagName;
      }
    }
    return null;
  }, barTestId);
  expect(bad, `overlay above ${barTestId}: ${bad}`).toBeNull();
}

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

test('tab bar clickable, no overlay, labels by breakpoint', async ({
  page,
}, testInfo) => {
  test.skip(!!onlyKeyViewports(testInfo), String(onlyKeyViewports(testInfo)));
  const { errors } = attachConsoleGuard(page);
  await skipToHome(page);
  await expect(page.getByTestId('tab-home')).toBeVisible({ timeout: 30_000 });

  const width = testInfo.project.use.viewport?.width ?? 390;
  const expectShort = width < 768;
  for (let i = 0; i < TAB_IDS.length; i++) {
    const id = TAB_IDS[i];
    const tab = page.getByTestId(id);
    await expect(tab).toBeVisible();
    await expect(tab).toContainText(expectShort ? SHORT_LABELS[i] : LONG_LABELS[i]);
    expect(await isTopAtCenter(page, id), id).toBe(true);
    await assertPointIsTarget(page, id);
    await tab.click();
    if (id === 'tab-home') {
      await expect(page).toHaveURL(/\/(|index\.html)$/);
    } else {
      await expect(page).toHaveURL(new RegExp(`${TAB_PATHS[id]}(\\?|#|$)`));
    }
  }

  await assertNoOverlayAboveBar(page, 'tab-bar');

  await page.getByTestId('tab-home').click();
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

test('restart onboarding button visible in settings', async ({ page }) => {
  await skipToHome(page);
  await page.getByTestId('tab-settings').click();
  await expect(page.getByTestId('restart-onboarding')).toBeVisible();
  await expect(page.getByTestId('restart-onboarding')).toContainText(
    'התחל היכרות מחדש'
  );
});

test('review screenshots (home history tax guide settings sheet chat)', async ({
  page,
}, testInfo) => {
  const name = testInfo.project.name;
  const allowed = new Set([
    'mobile-390',
    'tablet-768',
    'desktop-1280',
    'desktop-1920',
  ]);
  test.skip(!allowed.has(name), 'screenshots on 390/768/1280/1920 only');

  const outDir = path.join(process.cwd(), 'docs', 'review-screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  const prefix =
    name === 'mobile-390'
      ? '390'
      : name === 'tablet-768'
        ? '768'
        : name === 'desktop-1280'
          ? '1280'
          : '1920';

  await skipToHome(page);
  await page.getByTestId('fab-add').click();
  await page.getByTestId('kind-income').click();
  await page.getByTestId('amount-input').fill('10000');
  await page.getByTestId('save-entry').click();
  await expect(page.getByTestId('remaining-amount')).toBeVisible();

  const shot = async (suffix: string) => {
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(outDir, `${prefix}-${suffix}.png`),
      fullPage: false,
    });
  };

  await shot('home');

  await page.getByTestId('tab-history').click();
  await shot('history');

  await page.getByTestId('tab-tax').click();
  await shot('tax');

  await page.getByTestId('tab-guide').click();
  await shot('guide');

  await page.getByTestId('tab-settings').click();
  await shot('settings');

  await page.getByTestId('tab-home').click();
  await page.getByTestId('fab-add').click();
  await expect(page.getByTestId('amount-input')).toBeVisible();
  await shot('new-entry');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('amount-input')).toHaveCount(0);

  const chat = page.locator('[data-testid="noam-chat-fab"]').locator('visible=true').first();
  if (await chat.count()) {
    await chat.click();
    await page.waitForTimeout(500);
    await shot('noam-chat');
  }
});
