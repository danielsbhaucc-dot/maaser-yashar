/** compact < 768 · medium 768–1199 · wide ≥ 1200 (web בלבד) */
export type ShellMode = 'compact' | 'medium' | 'wide';

export function shellModeForWidth(width: number, isWeb: boolean): ShellMode {
  if (!isWeb) return 'compact';
  if (width >= 1200) return 'wide';
  if (width >= 768) return 'medium';
  return 'compact';
}

export const COMPACT_MAX = 767;
export const MEDIUM_MAX = 1199;
