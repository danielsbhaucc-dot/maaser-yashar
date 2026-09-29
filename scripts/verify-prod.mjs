#!/usr/bin/env node
/**
 * אימות מהיר מול הפריסה החיה אחרי Netlify redeploy.
 * שימוש: node scripts/verify-prod.mjs [https://maaser-yashar.netlify.app]
 */
const BASE = (process.argv[2] || 'https://maaser-yashar.netlify.app').replace(/\/$/, '');

async function check(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.headers || {},
    body: opts.body,
    redirect: 'manual',
  });
  const text = await res.text();
  return { url, status: res.status, headers: res.headers, text, ct: res.headers.get('content-type') || '' };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
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
    assert(!/#root/.test(about.text) || /מה עולה לשרת/.test(about.text), '/about looks like SPA');
    ok('/about static');
  } catch (e) {
    bad(String(e.message || e));
  }

  try {
    const privacy = await check('/privacy');
    assert(privacy.status === 200, `/privacy status ${privacy.status}`);
    assert(/פרטיות|מה נשמר/.test(privacy.text), '/privacy not static');
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
    assert(forbidden.status === 403, `foreign Origin expected 403 got ${forbidden.status}`);
    ok('API foreign Origin → 403');
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
