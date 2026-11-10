/**
 * Two console switches per product, both through the existing audited module toggle:
 *  - 'account'    — plumbing: return handling, server exchange, session state. Invisible to users.
 *  - 'account-ui' — visibility: the sign-in / sign-up button and the «החשבון המרכזי» section.
 * Showing the button later is ONE step (switch 'account-ui' on for the product in the console). No code deploy.
 * 'account-ui' depends on 'account' in central.modules, so it can never be on without the plumbing.
 */
export const ACCOUNT_MODULE = 'account';
export const ACCOUNT_UI_MODULE = 'account-ui';

/** True only when both modules are in the product's verified module list. Off by default (anything missing = hidden). */
export function accountUiVisible(modules: Iterable<string> | null | undefined): boolean {
  if (!modules) return false;
  const s = modules instanceof Set ? (modules as ReadonlySet<string>) : new Set(modules);
  return s.has(ACCOUNT_MODULE) && s.has(ACCOUNT_UI_MODULE);
}
