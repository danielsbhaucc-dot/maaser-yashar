/**
 * Shared Playwright helpers for מעשר ישר e2e.
 *
 * Prerequisite: `npm run export:web` (or `npx expo export -p web`) so `dist/`
 * is fresh — Playwright serves `dist` via playwright.config webServer.
 * CI always exports before e2e; locally rerun export after app changes.
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

/** Chat API paths — never hit real OpenRouter. */
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

/**
 * Install page.route mocks for /api/chat and Netlify chat function.
 * Returns a mutable bag of captured POST bodies (newest last).
 */
export async function mockChatApi(
  page: Page,
  handler?: (route: Route, post: Record<string, unknown>) => Promise<ChatMockBody | void> | ChatMockBody | void
): Promise<{ requests: ChatRequestCapture[]; setNext: (body: ChatMockBody) => void }> {
  const requests: ChatRequestCapture[] = [];
  let next: ChatMockBody = {
    reply: 'בסדר, רשמתי.',
    actions: [],
    model: 'e2e-mock',
  };

  const fulfill = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
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

/** Fail the test on unexpected console error/warning. */
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

/** Drop PWA SW so cold deep links / reloads are not served from cache. */
export async function clearServiceWorkers(page: Page) {
  await page.addInitScript(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) void r.unregister();
    });
  });
}

/**
 * Seed AsyncStorage (web localStorage) so first paint skips onboarding.
 * RN AsyncStorage on web stores JSON under the same key names.
 */
export async function seedOnboardingDone(page: Page) {
  await page.addInitScript(() => {
    const key = 'maaser_profile_v2';
    try {
      // Avoid PWA banner covering the tab bar in e2e
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

/** If onboarding flash appears after navigation, skip again. */
export async function dismissOnboardingIfPresent(page: Page) {
  const skip = page.getByRole('button', { name: 'דלג ישר לחשבון' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    return;
  }
  try {
    await skip.waitFor({ state: 'visible', timeout: 2_000 });
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

/** Open tab via deep-link URL; recover with tab click if scroll race resets selection. */
export async function gotoDeepLink(
  page: Page,
  path: string,
  tabTestId: string
) {
  await clearServiceWorkers(page);
  await seedOnboardingDone(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await dismissOnboardingIfPresent(page);
  await expect(page.getByTestId('fab-add')).toBeVisible({ timeout: 30_000 });

  const tab = page.getByTestId(tabTestId);
  // Give layout/scroll snap a moment; if still wrong, click the tab
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
  // BottomSheet backdrop (aria-label סגור) can briefly intercept tab bar clicks
  await page.keyboard.press('Escape').catch(() => {});
  await expect(page.getByTestId('fab-add')).toBeVisible();
}

export async function openNoamChat(page: Page) {
  // PhoneFrame / duplicate headers can yield multiple chat buttons — prefer testID
  const btn = page.getByTestId('noam-header-btn').first();
  await btn.click({ force: true });
  await expect(page.getByText(/שיחות עם נועם|התחל שיחה חדשה/)).toBeVisible({
    timeout: 20_000,
  });
}

/** Home → שיחה חדשה → composer ready */
export async function startNoamConversation(page: Page) {
  // Pre-consent so composer is available (still exercises chat UI + mock API)
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

  // Expand sheet if collapsed (half-height clips CTA on mobile)
  const expand = page.getByLabel(/הרחב את חלון הצ׳אט|הרחב את חלון הצ'אט/);
  if (await expand.isVisible().catch(() => false)) {
    await expand.click({ force: true }).catch(() => {});
  }

  // DOM click bypasses Playwright viewport gating (RN-web Modal clipping)
  const clicked = await page
    .getByText('שיחה חדשה', { exact: true })
    .first()
    .evaluate((el) => {
      let t = el as HTMLElement;
      while (t.parentElement) {
        if (
          t.getAttribute('tabindex') === '0' ||
          t.getAttribute('role') === 'button' ||
          t.onclick
        ) {
          break;
        }
        t = t.parentElement;
      }
      t.click();
      return true;
    })
    .catch(() => false);

  if (!clicked) {
    await page.getByText('התחל שיחה חדשה', { exact: true }).first().evaluate((el) => {
      (el as HTMLElement).click();
    });
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
  // Send control is a glyph Pressable — Enter is the reliable path on web
  await input.press('Enter');
}

/** elementFromPoint hit-test — center of element must be the element (or a descendant). */
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

/** Prefer testID for chat hit-test when available. */
export async function isTopAtCenterChatBtn(page: Page): Promise<boolean> {
  const byId = page.getByTestId('noam-header-btn');
  if ((await byId.count()) > 0) {
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
