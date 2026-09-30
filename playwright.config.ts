import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Smoke + acceptance widths (320–430 mobile, 1280 desktop).
 * Serves static `dist/` — run `npm run export:web` first (CI does this).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'he-IL',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  outputDir: 'test-results',
  webServer: {
    // Prerequisite: dist/ from `npm run export:web` (stale dist → flaky UI assertions)
    // -s: SPA fallback so /history|/tax|/guide|/settings deep links hit index.html (like Netlify redirects)
    command: `npx --yes serve dist -s -l tcp://127.0.0.1:${PORT} --no-port-switching`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'mobile-320', use: { viewport: { width: 320, height: 568 } } },
    { name: 'mobile-360', use: { viewport: { width: 360, height: 740 } } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 } } },
    { name: 'mobile-430', use: { viewport: { width: 430, height: 932 } } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
