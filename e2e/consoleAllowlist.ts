/**
 * Fail-on-console allow-list for Playwright e2e.
 *
 * Any console.error / console.warn whose text does NOT match one of these
 * patterns fails the test. Keep this list short and documented.
 */

export const CONSOLE_ALLOWLIST: RegExp[] = [
  /Download the React DevTools/i,
  /ReactDOM\.render is no longer supported/i,
  /\[noam\] client_ms=/i,
  /ServiceWorker|service worker|navigator\.serviceWorker/i,
  /ResizeObserver loop/i,
  /Non-passive event listener/i,
  /props\.pointerEvents is deprecated/i,
  /shadow\*.*deprecated|TouchableOpacity.*deprecated/i,
  // RN-web Animated stubs in static export
  /useNativeDriver/i,
  /RCTAnimation/i,
  /native animated module/i,
];

export function isConsoleAllowed(text: string): boolean {
  const t = String(text || '');
  return CONSOLE_ALLOWLIST.some((re) => re.test(t));
}
