/**
 * Shared Playwright helpers for מעשר ישר e2e.
 *
 * Prerequisite: `npm run export:web` (or `npx expo export -p web`) so `dist/`
 * is fresh — Playwright serves `dist` via playwright.config webServer.
 */
import { expect, type Page, type Route } from '@playwright/test';
import { isConsoleAllowed } from './consoleAllowlist';

export const TAB_IDS = [
  'tab-home',
  'tab-history',
  'tab-tax',
  'tab-guide',
  'tab-settings',
] as const;

export const CHAT_BUTTON_NAME = /פתח צ'אט עם נועם/;

export const CHAT_ROUTE_GLOB = '**/api/chat**';
export const CHAT_NETLIFY_GLOB = '**/.netlify/functions/chat**';

export type ChatMockBody = {
  reply?: string;
  actions?: unknown[];
  model?: string;
};

export type ChatRequestCapture = {
  url: string;
  body: Record<string, unknown>;
};

export async function mockChatApi(
  page: Page,
  handler?: (
    route: Route,
    post: Record<string, unknown>
  ) => Promise<ChatMockBody | void> | ChatMockBody | void
): Promise<{ requests: ChatRequestCapture[]; setNext: (body: ChatMockBody) => void }> {
  const requests: ChatRequestCapture[] = [];
  let next: ChatMockBody = {
    reply: 'בסדר, רשמתי.',
    actions: [],
    model: 'e2e-mock',
  };

  const fulfill = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
      return;
    }
    let post: Record<string, unknown> = {};
    try {
      post = route.request().postDataJSON() as Record<string, unknown>;
    } catch {
      post = {};
    }
    requests.push({ url: route.request().url(), body: post });
    const override = handler ? await handler(route, post) : undefined;
    const payload = { ...next, ...(override || {}) };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  };

  await page.route(CHAT_ROUTE_GLOB, fulfill);
  await page.route(CHAT_NETLIFY_GLOB, fulfill);

  return {
    requests,
    setNext: (body) => {
      next = { model: 'e2e-mock', reply: 'בסדר.', actions: [], ...body };
    },
  };
}

export function attachConsoleGuard(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (isConsoleAllowed(text)) return;
    errors.push(`[${type}] ${text}`);
  });
  page.on('pageerror', (err) => {
    const text = String(err?.message || err);
    if (isConsoleAllowed(text)) return;
    errors.push(`[pageerror] ${text}`);
  });
  return { errors };
}

export async function assertNoConsoleNoise(errors: string[]) {
  expect(errors, errors.join('\n')).toEqual([]);
}

export async function clearServiceWorkers(page: Page) {
  await page.addInitScript(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) void r.unregister();
    });
  });
}

/** Seed profile so first paint skips onboarding; dismiss PWA banner. */
export async function seedOnboardingDone(page: Page) {
  await page.addInitScript(() => {
    const key = 'maaser_profile_v2';
    try {
      localStorage.setItem('maaser_pwa_banner_dismissed_v1', '1');
      const raw = localStorage.getItem(key);
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(
        key,
        JSON.stringify({
          ...prev,
          onboardingDone: true,
          skippedSetup: true,
          rate: typeof prev.rate === 'number' ? prev.rate : 0.1,
          chatShareTotals: prev.chatShareTotals !== false,
          saveChatHistory: prev.saveChatHistory !== false,
          chatConsentDone: !!prev.chatConsentDone,
        })
      );
    } catch {
      localStorage.setItem('maaser_pwa_banner_dismissed_v1', '1');
      localStorage.setItem(
        key,
        JSON.stringify({
          onboardingDone: true,
          skippedSetup: true,
          rate: 0.1,
          chatShareTotals: true,
          saveChatHistory: true,
          chatConsentDone: false,
        })
      );
    }
  });
}

export async function dismissOnboardingIfPresent(page: Page) {
  const skip = page.getByRole('button', { name: 'דלג ישר לחשבון' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    return;
  }
  try {
    await skip.waitFor({ state: 'visible', timeout: 1_500 });
    await skip.click();
  } catch {
    // already past onboarding
  }
}

export async function skipToHome(page: Page) {
  await clearServiceWorkers(page);
  await seedOnboardingDone(page);
  await page.goto('/');
  await dismissOnboardingIfPresent(page);
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });
}

/** Cold deep link with tab-click recovery if scroll race resets selection. */
export async function gotoDeepLink(page: Page, path: string, tabTestId: string) {
  await clearServiceWorkers(page);
  await seedOnboardingDone(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await dismissOnboardingIfPresent(page);
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });

  const tab = page.getByTestId(tabTestId);
  for (let i = 0; i < 8; i++) {
    if ((await tab.getAttribute('aria-selected')) === 'true') break;
    await page.waitForTimeout(150);
  }
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click({ force: true });
  }
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}(\\?|#|$)`));
}

export async function addIncome(page: Page, amount: string) {
  await page.getByTestId('fab-add').click();
  await page.getByTestId('kind-income').click();
  await page.getByTestId('amount-input').fill(amount);
  await page.getByTestId('save-entry').click();
  await expect(page.getByTestId('amount-input')).toHaveCount(0);
  await page.keyboard.press('Escape').catch(() => {});
}

export async function openNoamChat(page: Page) {
  const btn = page.getByTestId('noam-header-btn').first();
  if ((await btn.count()) > 0) {
    await btn.click({ force: true });
  } else {
    await page.getByRole('button', { name: CHAT_BUTTON_NAME }).first().click({ force: true });
  }
  await expect(page.getByText(/שיחות עם נועם|התחל שיחה חדשה|שיחה חדשה/)).toBeVisible({
    timeout: 20_000,
  });
}

/** Click RN-web pressable by visible Hebrew label (avoids viewport / overlay issues). */
async function clickByVisibleText(page: Page, labels: string[]) {
  const ok = await page.evaluate((wanted) => {
    const match = (t: string) => wanted.some((w) => t === w || t.includes(w));
    const nodes = Array.from(document.querySelectorAll('*'));
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      const text = (el.textContent || '').trim();
      if (!match(text)) continue;
      // Prefer the pressable ancestor (tabindex / role / cursor)
      let cur: HTMLElement | null = el;
      for (let i = 0; i < 6 && cur; i++) {
        const role = cur.getAttribute('role');
        const tab = cur.getAttribute('tabindex');
        if (role === 'button' || tab === '0' || cur.onclick) {
          cur.click();
          return true;
        }
        cur = cur.parentElement;
      }
      el.click();
      return true;
    }
    return false;
  }, labels);
  if (!ok) throw new Error(`clickByVisibleText failed: ${labels.join('|')}`);
}

/** Home → שיחה חדשה → consent (if needed) → composer ready */
export async function startNoamConversation(page: Page) {
  // Pre-consent so we skip the consent sheet when possible
  await page.evaluate(() => {
    const key = 'maaser_profile_v2';
    try {
      const raw = localStorage.getItem(key);
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(
        key,
        JSON.stringify({
          ...prev,
          onboardingDone: true,
          chatConsentDone: true,
          chatShareTotals: true,
        })
      );
    } catch {
      /* ignore */
    }
  });
  await page.reload();
  await dismissOnboardingIfPresent(page);
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });

  await openNoamChat(page);

  const expand = page.getByLabel(/הרחב את חלון הצ׳אט|הרחב את חלון הצ'אט/);
  if (await expand.isVisible().catch(() => false)) {
    await expand.click({ force: true }).catch(() => {});
  }

  await clickByVisibleText(page, ['שיחה חדשה', 'התחל שיחה חדשה']);

  const consent = page
    .getByLabel("המשך לצ'אט")
    .or(page.getByRole('button', { name: /המשך לצ'אט|הבנתי, בואו נדבר/ }));
  try {
    await consent.first().waitFor({ state: 'visible', timeout: 2_500 });
    await consent.first().click({ force: true });
  } catch {
    // already consented
  }

  await expect(page.getByPlaceholder(/כתוב לנועם/)).toBeVisible({
    timeout: 15_000,
  });
}

export async function sendChatMessage(page: Page, text: string) {
  const input = page.getByPlaceholder(/כתוב לנועם/);
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.click();
  await input.fill(text);
  const send = page.getByRole('button', { name: 'שלח' });
  if ((await send.count()) > 0) {
    await send.first().click({ force: true });
  } else {
    await input.press('Enter');
  }
}

export async function isTopAtCenter(page: Page, testId: string): Promise<boolean> {
  return page.evaluate((tid) => {
    const el = document.querySelector(`[data-testid="${tid}"]`);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && el.contains(hit);
  }, testId);
}

export async function isTopAtCenterByRole(
  page: Page,
  role: string,
  name: RegExp | string
): Promise<boolean> {
  const loc = page.getByRole(role as 'button', { name }).first();
  await expect(loc).toBeVisible();
  const handle = await loc.elementHandle();
  if (!handle) return false;
  return handle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && (el === hit || el.contains(hit));
  });
}

export async function isTopAtCenterChatBtn(page: Page): Promise<boolean> {
  if ((await page.getByTestId('noam-header-btn').count()) > 0) {
    return isTopAtCenter(page, 'noam-header-btn');
  }
  return isTopAtCenterByRole(page, 'button', CHAT_BUTTON_NAME);
}

export function onlyKeyViewports(
  testInfo: { project: { name: string } },
  reason = 'only mobile-390 + desktop-1280'
) {
  const name = testInfo.project.name;
  return name !== 'mobile-390' && name !== 'desktop-1280' ? reason : false;
}
