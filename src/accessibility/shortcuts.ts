type KeyLike = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'code' | 'key'>;

/**
 * Alt+<אות> לפי מיקום המקש הפיזי (e.code) — ב־Mac Option+A מחזיר e.key='å',
 * ובפריסה עברית 'ש'. e.key נשאר גיבוי לדפדפנים בלי code.
 */
export function isAltShortcut(e: KeyLike, letter: 'a' | 'r' | 'h'): boolean {
  if (!e.altKey || e.ctrlKey || e.metaKey) return false;
  if (e.code) return e.code === `Key${letter.toUpperCase()}`;
  const heb = { a: 'ש', r: 'ר', h: 'י' }[letter];
  return e.key.toLowerCase() === letter || e.key === heb;
}
