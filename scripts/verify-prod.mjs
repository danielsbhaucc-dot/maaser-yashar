#!/usr/bin/env node
/**
 * אימות מהיר מול הפריסה החיה אחרי Netlify build מ־main.
 * שימוש: node scripts/verify-prod.mjs [https://maaser-yashar.netlify.app]
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = (process.argv[2] || 'https://maaser-yashar.netlify.app').replace(/\/$/, '');

/** רק דומיין .app המת — לא maaser-yashar.netlify.app */
const DEAD_APP = /maaser-yashar\.app/;
const ALLOW = /(contact\.ts|contact\.test|apply-contact|verify-prod)/i;

async function check(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.headers || {},
    body: opts.body,
    redirect: 'manual',
  });
  const text = await res.text();
  return {
    url,
    status: res.status,
    headers: res.headers,
    text,
    ct: res.headers.get('content-type') || '',
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'coverage') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|html|css|json|toml)$/i.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function scanLocalDeadDomain() {
  const hits = [];
  for (const dir of ['src', 'public', 'netlify', 'dist']) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (ALLOW.test(rel)) continue;
      const text = readFileSync(file, 'utf8');
      if (DEAD_APP.test(text)) hits.push(rel);
    }
  }
  return hits;
}

function originMainSha() {
  try {
    const out = execSync('git ls-remote origin refs/heads/main', {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    const sha = out.split(/\s+/)[0];
    return sha || null;
  } catch {
    return null;
  }
}

async function main() {
  const fails = [];
  const ok = (msg) => console.log('✅', msg);
  const bad = (msg) => {
    console.error('❌', msg);
    fails.push(msg);
  };

  try {
    const about = await check('/about');
    assert(about.status === 200, `/about status ${about.status}`);
    assert(/אודות|מה עולה לשרת/.test(about.text), '/about not static HTML');
    assert(
      !/#root/.test(about.text) || /מה עולה לשרת/.test(about.text),
      '/about looks like SPA'
    );
    assert(/אני דניאל/.test(about.text), '/about must say אני דניאל');
    assert(!DEAD_APP.test(about.text), '/about still has maaser-yashar.app');
    ok('/about static');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const privacy = await check('/privacy');
    assert(privacy.status === 200, `/privacy status ${privacy.status}`);
    assert(/פרטיות|מה נשמר/.test(privacy.text), '/privacy not static');
    assert(!DEAD_APP.test(privacy.text), '/privacy still has maaser-yashar.app');
    ok('/privacy static');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const robots = await check('/robots.txt');
    assert(robots.status === 200, 'robots status');
    assert(/Sitemap:/i.test(robots.text), 'robots missing Sitemap');
    assert(!/<html/i.test(robots.text), 'robots returned HTML');
    ok('robots.txt');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const sm = await check('/sitemap.xml');
    assert(sm.status === 200, 'sitemap status');
    assert(/<urlset/i.test(sm.text), 'sitemap not xml');
    ok('sitemap.xml');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const nf = await check('/this-path-should-404-xyz');
    assert(nf.status === 404, `expected 404 got ${nf.status}`);
    ok('real 404');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const font = await check('/fonts/heebo-400.woff2');
    assert(font.status === 200, 'font status');
    assert(!/<html/i.test(font.text.slice(0, 200)), 'font returned HTML');
    const cc = font.headers.get('cache-control') || '';
    if (/immutable/i.test(cc)) ok('font immutable');
    else console.warn('⚠️ font Cache-Control:', cc || '(missing)');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const home = await check('/');
    const csp = home.headers.get('content-security-policy') || '';
    const nosniff = home.headers.get('x-content-type-options') || '';
    assert(/nosniff/i.test(nosniff), 'missing nosniff');
    assert(/frame-ancestors/i.test(csp), 'missing CSP frame-ancestors');
    ok('security headers');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const forbidden = await check('/api/chat', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert(
      forbidden.status === 403,
      `foreign Origin expected 403 got ${forbidden.status}`
    );
    ok('API foreign Origin → 403');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const ver = await check('/version.json');
    assert(ver.status === 200, `/version.json status ${ver.status}`);
    const json = JSON.parse(ver.text);
    assert(
      typeof json.commit === 'string' && json.commit.length >= 7,
      'version.json missing commit'
    );
    const remote = originMainSha();
    if (!remote) {
      console.warn('⚠️ cannot read origin/main via git ls-remote — skip SHA compare');
      ok(`version.json commit=${json.commit.slice(0, 7)} (remote unknown)`);
    } else if (
      json.commit === remote ||
      remote.startsWith(json.commit.slice(0, 7))
    ) {
      ok(`deployed == main (${json.commit.slice(0, 7)}) — PASS`);
    } else {
      bad(
        `deployed (${json.commit.slice(0, 7)}) != origin/main (${remote.slice(0, 7)}) — FAIL`
      );
    }
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const hits = scanLocalDeadDomain();
    if (hits.length) bad(`maaser-yashar.app found in: ${hits.join(', ')}`);
    else ok('no maaser-yashar.app in src/public/netlify/dist');
  } catch (e) {
    bad(String(e.message || e));
  }

  if (fails.length) {
    console.error(`\n${fails.length} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll prod checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
