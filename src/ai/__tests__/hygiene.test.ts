/**
 * Hygiene — דומיין מת, שמות אישיים בקוד, סודות ב־EXPO_PUBLIC_, הלכה כמקור יחיד.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'public', 'netlify'];
const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', '.git']);

const DEAD_APP = new RegExp(['maaser', '-', 'yashar', '\\.app'].join(''));
const PERSONAL_NAME = ['מי', 'כאל'].join('');
const PERSONAL_NAME_RE = new RegExp(PERSONAL_NAME);
const OPENROUTER_IN_CLIENT = new RegExp(['OPEN', 'ROUTER'].join(''));

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|cjs|html|css|json|toml|md)$/i.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function scanDirs(
  dirs: string[],
  predicate: (text: string, rel: string) => boolean,
  allowRel?: (rel: string) => boolean
): string[] {
  const hits: string[] = [];
  for (const dir of dirs) {
    const base = join(ROOT, dir);
    if (!existsSync(base)) continue;
    for (const file of walk(base)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (allowRel?.(rel)) continue;
      // קובץ הבדיקה עצמו מותר להזכיר מחרוזות אסורות כ־regex
      if (rel.includes('__tests__/hygiene.test')) continue;
      const text = readFileSync(file, 'utf8');
      if (predicate(text, rel)) hits.push(rel);
    }
  }
  return hits;
}

describe('repo hygiene', () => {
  it('dead .app domain must not appear in src/, public/, netlify/', () => {
    const hits = scanDirs(
      SCAN_DIRS,
      (text, rel) => {
        // contact tests / parse intentionally mention the dead domain
        if (
          /config\/contact\.ts$/.test(rel) ||
          /config\/__tests__\/contact/.test(rel)
        ) {
          return false;
        }
        return DEAD_APP.test(text);
      }
    );
    expect(hits).toEqual([]);
  });

  it('personal Hebrew name must not appear in src/, public/, netlify/ (use Daniel)', () => {
    const hits = scanDirs(SCAN_DIRS, (text) => PERSONAL_NAME_RE.test(text));
    expect(hits).toEqual([]);
  });

  it('OPENROUTER must not appear in src/ or public/ (no client secrets)', () => {
    const hits = scanDirs(['src', 'public'], (text) =>
      OPENROUTER_IN_CLIENT.test(text)
    );
    expect(hits).toEqual([]);
  });

  it('halakha: shared/halakha.json is the single JSON source (or only copy)', () => {
    const copies: string[] = [];
    for (const dir of ['src', 'public', 'netlify', 'shared']) {
      const base = join(ROOT, dir);
      if (!existsSync(base)) continue;
      for (const file of walk(base)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        if (/halakha\.json$/i.test(rel)) copies.push(rel);
      }
    }
    // מותר עותק יחיד ב־shared/; אם יש כפילויות — חייבות להיות זהות בתוכן
    if (copies.length === 0) {
      // chatHalakha.mjs כמקור יחיד בקוד
      const chatHalakha = join(ROOT, 'netlify', 'functions', 'chatHalakha.mjs');
      expect(existsSync(chatHalakha)).toBe(true);
      return;
    }
    expect(copies).toContain('shared/halakha.json');
    if (copies.length === 1) return;
    const primary = readFileSync(join(ROOT, 'shared', 'halakha.json'), 'utf8');
    for (const rel of copies) {
      if (rel === 'shared/halakha.json') continue;
      expect(readFileSync(join(ROOT, rel), 'utf8')).toBe(primary);
    }
  });
});
