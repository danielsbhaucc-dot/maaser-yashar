#!/usr/bin/env node
/**
 * Post-export: מזריק CONTACT_EMAIL לדפי HTML סטטיים ב־dist/,
 * כותב version.json, ומזריק שורת גרסה ל־about.html.
 *
 * Env: CONTACT_EMAIL או EXPO_PUBLIC_CONTACT_EMAIL
 * Netlify: COMMIT_REF, BRANCH
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const BLOCKED = /@maaser-yashar\.app$/i;
const PENDING = 'כתובת ליצירת קשר תתווסף בקרוב.';
const PLACEHOLDER = '{{CONTACT_EMAIL}}';
const VERSION_PLACEHOLDER = '{{VERSION_SHORT}}';

function resolveEmail() {
  const raw = (
    process.env.CONTACT_EMAIL ||
    process.env.EXPO_PUBLIC_CONTACT_EMAIL ||
    ''
  ).trim();
  if (!raw) return null;
  if (!EMAIL_RE.test(raw)) {
    console.warn(
      `\n⚠️  CONTACT_EMAIL לא תקין (${JSON.stringify(raw)}). ${PENDING}\n`
    );
    return null;
  }
  if (BLOCKED.test(raw)) {
    console.warn(
      `\n⚠️  CONTACT_EMAIL משתמש בדומיין אסור @maaser-yashar.app. ${PENDING}\n`
    );
    return null;
  }
  return raw;
}

function gitHead() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function contactHtml(email, subjectHe) {
  if (!email) return PENDING;
  const href = `mailto:${email}?subject=${encodeURIComponent(subjectHe)}`;
  return `<a class="inline" href="${href}" style="color:var(--gold);font-weight:700;text-decoration:none">${email}</a>`;
}

function patchFile(relPath, email) {
  const path = join(DIST, relPath);
  if (!existsSync(path)) {
    console.warn(`⚠️  apply-contact: חסר ${relPath} ב־dist/`);
    return;
  }
  let html = readFileSync(path, 'utf8');
  if (!html.includes(PLACEHOLDER)) {
    console.warn(`⚠️  apply-contact: אין ${PLACEHOLDER} ב־${relPath}`);
  }
  const subject =
    relPath === 'about.html' ? 'אודות מעשר ישר' : 'פרטיות מעשר ישר';
  html = html.split(PLACEHOLDER).join(contactHtml(email, subject));
  writeFileSync(path, html, 'utf8');
}

function writeVersion() {
  const commit = process.env.COMMIT_REF || gitHead();
  const branch = process.env.BRANCH || '';
  const builtAt = new Date().toISOString();
  const payload = { commit, builtAt, branch };
  writeFileSync(join(DIST, 'version.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return commit.slice(0, 7);
}

function patchVersionShort(short) {
  const path = join(DIST, 'about.html');
  if (!existsSync(path)) return;
  let html = readFileSync(path, 'utf8');
  if (html.includes(VERSION_PLACEHOLDER)) {
    html = html.split(VERSION_PLACEHOLDER).join(short);
    writeFileSync(path, html, 'utf8');
  }
}

function main() {
  if (!existsSync(DIST)) {
    console.error('apply-contact: dist/ לא קיים — הריצו expo export קודם');
    process.exit(1);
  }

  const email = resolveEmail();
  if (!email) {
    console.warn(`\n⚠️⚠️⚠️  אין כתובת יצירת קשר תקפה. ${PENDING}\n`);
  } else {
    console.log(`apply-contact: CONTACT_EMAIL=${email}`);
  }

  patchFile('about.html', email);
  patchFile('privacy.html', email);

  const short = writeVersion();
  patchVersionShort(short);
  console.log(`apply-contact: version.json commit=${short}`);
}

main();
