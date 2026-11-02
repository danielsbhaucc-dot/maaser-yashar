/**
 * תפריט נגישות — מצבי ARIA, ניגודיות בהירה, השתקת מדיה, פוקוס בגיליון מסמך.
 * Requires fresh `dist/` — `npm run export:web` first.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockChatApi, skipToHome, onlyKeyViewports } from './helpers';

const A11Y_KEY = '@maaser/a11y-v2';

async function seedA11y(page: Page, settings: Record<string, unknown>) {
  await page.addInitScript(
    ([k, v]) => localStorage.setItem(k as string, v as string),
    [A11Y_KEY, JSON.stringify(settings)]
  );
}

async function openPanel(page: Page) {
  await page.locator('[aria-label="פתח תפריט נגישות"]').first().click();
  await expect(page.locator('#maaser-a11y-root')).toBeVisible();
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!!onlyKeyViewports(testInfo), 'only mobile-390 + desktop-1280');
  await mockChatApi(page);
});

test('panel opens; switches expose aria-checked, accordions aria-expanded', async ({ page }) => {
  await skipToHome(page);
  await openPanel(page);
  const acc = page.locator('#maaser-a11y-root [aria-expanded]').nth(1);
  await expect(acc).toHaveAttribute('aria-expanded', 'false');
  await acc.click();
  await expect(acc).toHaveAttribute('aria-expanded', 'true');
  const sw = page.locator('#maaser-a11y-root [role=switch]').first();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  // הפאנל נשאר פתוח (פוקוס לא קפץ לכפתור הסגירה)
  await expect(page.locator('#maaser-a11y-root')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});

test('light contrast is a real light theme (no invert filter)', async ({ page }) => {
  await seedA11y(page, { contrast: 'light' });
  await skipToHome(page);
  const r = await page.evaluate(() => ({
    filter: getComputedStyle(document.getElementById('root')!).filter,
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  expect(r.filter).toBe('none');
  expect(r.bg).toBe('rgb(255, 255, 255)');
});

test('mute media mutes without hiding', async ({ page }) => {
  await seedA11y(page, { muteMedia: true });
  await skipToHome(page);
  await page.evaluate(() => {
    const v = document.createElement('video');
    v.id = 'probe-v';
    document.getElementById('root')!.firstElementChild!.appendChild(v);
  });
  await expect
    .poll(() => page.evaluate(() => (document.getElementById('probe-v') as HTMLVideoElement).muted))
    .toBe(true);
  expect(
    await page.evaluate(() => getComputedStyle(document.getElementById('probe-v')!).display)
  ).not.toBe('none');
});

test('doc sheet moves focus inside', async ({ page }) => {
  await skipToHome(page);
  await openPanel(page);
  const info = page.locator('#maaser-a11y-root [role=button]', { hasText: /הצהרת נגישות/ }).first();
  await info.scrollIntoViewIfNeeded();
  await info.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const d = [...document.querySelectorAll('[role=dialog]')].find((x) =>
          x.id.startsWith('maaser-a11y-doc')
        );
        return !!d && d.contains(document.activeElement);
      })
    )
    .toBe(true);
});
