#!/usr/bin/env node
/**
 * אחרי expo export -p web:
 * 1) מסיר כפילויות של meta description / theme-color שה־Expo מזריק
 * 2) מעתיק favicon.ico מ־public אם צריך
 * 3) מדווח על source maps
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PUBLIC = join(ROOT, 'public');

/** שומר את המופע הראשון של כל name/property; מוחק כפילויות מאוחרות יותר */
function dedupeMeta(html) {
  const seen = new Set();
  return html.replace(
    /<meta\b[^>]*>/gi,
    (tag) => {
      const name =
        tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ||
        tag.match(/\bproperty\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (!name) return tag;
      if (name !== 'description' && name !== 'theme-color') return tag;
      if (seen.has(name)) {
        return '';
      }
      seen.add(name);
      return tag;
    }
  );
}

function preferPublicDescription(html) {
  // public/index.html description מדויק יותר משורת Expo ב־app.json
  const preferred =
    'פנקס חודשי למעשר וחומש. חינם, בלי הרשמה, והפנקס נשמר אצלך.';
  return html.replace(
    /(<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["'])([^"']*)(["'][^>]*>)/i,
    `$1${preferred}$3`
  );
}

function ensureFavicon() {
  const src = join(PUBLIC, 'favicon.ico');
  const dest = join(DIST, 'favicon.ico');
  if (!existsSync(src)) {
    console.warn('post-export-web: חסר public/favicon.ico');
    return;
  }
  copyFileSync(src, dest);
  console.log('post-export-web: הועתק favicon.ico → dist/');
}

function ensureServeJson() {
  const src = join(PUBLIC, 'serve.json');
  const dest = join(DIST, 'serve.json');
  if (!existsSync(src)) return;
  copyFileSync(src, dest);
}

function reportSourceMaps() {
  const jsDir = join(DIST, '_expo', 'static', 'js', 'web');
  if (!existsSync(jsDir)) {
    console.warn('post-export-web: אין _expo/static/js/web');
    return;
  }
  const maps = readdirSync(jsDir).filter((f) => f.endsWith('.map'));
  const js = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
  console.log(
    `post-export-web: ${js.length} קבצי JS, ${maps.length} source maps ב־_expo/static/js/web`
  );
}

function main() {
  const indexPath = join(DIST, 'index.html');
  if (!existsSync(indexPath)) {
    console.error('post-export-web: dist/index.html חסר — הריצו expo export קודם');
    process.exit(1);
  }
  let html = readFileSync(indexPath, 'utf8');
  html = dedupeMeta(html);
  html = preferPublicDescription(html);
  // ניקוי שורות ריקות כפולות שנשארו אחרי מחיקת meta
  html = html.replace(/\n{3,}/g, '\n\n');
  writeFileSync(indexPath, html, 'utf8');
  console.log('post-export-web: הוסרו כפילויות description/theme-color');

  ensureFavicon();
  ensureServeJson();
  reportSourceMaps();
}

main();
