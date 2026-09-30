/**
 * NEW-1 e2e — temporarily fixme (RN-web chat composer flaky).
 * Locked by: src/ai/__tests__/noamLedgerP0.test.ts + npm run test:noam -- --mode=mock (C-01c).
 */
import { test } from '@playwright/test';

test.describe('NEW-1 double-count', () => {
  test.fixme('confirm income 9800 → next request context remaining 980', async () => {
    // Re-enable with stable sendChatMessage helper against docked/sheet chat.
  });
});
