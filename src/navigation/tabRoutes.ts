import type { TabKey } from './TabNavContext';

/** נתיבי SPA לטאבים (web deep links) */
export const TAB_PATHS: Record<TabKey, string> = {
  Home: '/',
  History: '/history',
  Tax: '/tax',
  Guide: '/guide',
  Settings: '/settings',
};

const PATH_TO_TAB: Record<string, TabKey> = {
  '/': 'Home',
  '/history': 'History',
  '/tax': 'Tax',
  '/guide': 'Guide',
  '/settings': 'Settings',
};

export const TAB_LABELS: Record<TabKey, string> = {
  Home: 'בית',
  History: 'היסטוריה',
  Tax: 'החזר מס',
  Guide: 'הנחיות',
  Settings: 'הגדרות',
};

/** נרמול pathname ללא סלאש סופי (חוץ מ־`/`) */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

export function tabFromPathname(pathname: string): TabKey | null {
  return PATH_TO_TAB[normalizePathname(pathname)] ?? null;
}

export function pathForTab(key: TabKey): string {
  return TAB_PATHS[key];
}

/** כותרת דפדפן — לעולם לא מחזיר undefined */
export function documentTitleForTab(key: TabKey | null | undefined): string {
  if (!key) return 'מעשר ישר';
  const label = TAB_LABELS[key];
  return label ? `מעשר ישר · ${label}` : 'מעשר ישר';
}

export function documentTitleFromLocation(): string {
  if (typeof window === 'undefined') return 'מעשר ישר';
  return documentTitleForTab(tabFromPathname(window.location.pathname));
}
