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

const TAB_PATHS: Record<(typeof TAB_IDS)[number], string> = {
  'tab-home': '/',
  'tab-history': '/history',
  'tab-tax': '/tax',
  'tab-guide': '/guide',
  'tab-settings': '/settings',
};

const SHORT_LABELS = ['בית', 'ארכיון', 'מס', 'מדריך', 'עוד'];
const LONG_LABELS = ['בית', 'היסטוריה', 'החזר מס', 'הנחיות', 'הגדרות'];

async function skipToHome(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג ישר לחשבון' }).click();
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });
}

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

test('tab bar clickable, no overlay, labels by breakpoint', async ({
  page,
}, testInfo) => {
  await skipToHome(page);
  await expect(page.getByTestId('tab-home')).toBeVisible({ timeout: 30_000 });

  const width = testInfo.project.use.viewport?.width ?? 390;
  const expectShort = width < 768;
  for (let i = 0; i < TAB_IDS.length; i++) {
    const id = TAB_IDS[i];
    const tab = page.getByTestId(id);
    await expect(tab).toBeVisible();
    await expect(tab).toContainText(expectShort ? SHORT_LABELS[i] : LONG_LABELS[i]);
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
  const chatBtn = page.locator('[data-testid="noam-chat-fab"]').locator('visible=true').first();
  if ((await chatBtn.count()) > 0) {
    const box = await chatBtn.boundingBox();
    if (
      box &&
      Number.isFinite(box.x) &&
      Number.isFinite(box.y) &&
      box.width > 0 &&
      box.height > 0
    ) {
      const free = await page.evaluate(
        ({ x, y, width, height }) => {
          const hit = document.elementFromPoint(x + width / 2, y + height / 2);
          if (!hit) return false;
          return !!hit.closest('[data-testid="noam-chat-fab"]');
        },
        box
      );
      expect(free, 'noam-chat-fab point').toBe(true);
    }
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
