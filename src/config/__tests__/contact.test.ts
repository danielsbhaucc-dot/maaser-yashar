import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  CONTACT_PENDING_TEXT,
  parseContactEmail,
  contactMailto,
} from '../contact';

const ROOT = join(__dirname, '..', '..', '..');

/** רק דומיין .app המת — לא maaser-yashar.netlify.app */
const DEAD_APP_DOMAIN = /maaser-yashar\.app/;
const ACCESSIBILITY_AT = /accessibility@/;

const SCAN_DIRS = ['src', 'public', 'netlify'];
const ALLOW_NAME = /(config\/contact\.ts|config\/__tests__\/contact|apply-contact)/i;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'coverage') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|html|css|json|toml)$/i.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('contact config', () => {
  it('returns null when env missing', () => {
    expect(parseContactEmail(undefined)).toBeNull();
    expect(parseContactEmail('')).toBeNull();
    expect(parseContactEmail('  ')).toBeNull();
  });

  it('rejects invalid and blocked @maaser-yashar.app', () => {
    expect(parseContactEmail('not-an-email')).toBeNull();
    expect(parseContactEmail('a@maaser-yashar.app')).toBeNull();
    expect(parseContactEmail('accessibility@maaser-yashar.app')).toBeNull();
  });

  it('accepts a real email', () => {
    expect(parseContactEmail('test@example.com')).toBe('test@example.com');
  });

  it('contactMailto encodes subject or returns null', () => {
    // CONTACT_EMAIL בא מ־env בזמן טעינת המודול; בודקים את הפונקציה דרך parse
    expect(CONTACT_PENDING_TEXT).toBe('כתובת ליצירת קשר תתווסף בקרוב.');
    const href = contactMailto('משוב על מעשר ישר');
    if (href) {
      expect(href.startsWith('mailto:')).toBe(true);
      expect(href).toContain(encodeURIComponent('משוב על מעשר ישר'));
      expect(href).not.toMatch(DEAD_APP_DOMAIN);
    } else {
      expect(href).toBeNull();
    }
  });
});

describe('dead domain scan (T-07)', () => {
  it('src/, public/, netlify/ must not contain maaser-yashar.app (except allowlisted)', () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      const base = join(ROOT, dir);
      for (const file of walk(base)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        if (ALLOW_NAME.test(rel)) continue;
        const text = readFileSync(file, 'utf8');
        if (DEAD_APP_DOMAIN.test(text) || ACCESSIBILITY_AT.test(text)) {
          hits.push(rel);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
