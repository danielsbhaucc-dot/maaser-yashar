/* מעשר ישר — service worker מינימלי
 * HTML/navigate: network-first
 * נכסים סטטיים: cache-first
 * /api/ וצ'אט: בלי cache לעולם
 * עדכונים נטענים ברקע ומופעלים בפתיחה הבאה (בלי skipWaiting)
 */
const CACHE_NAME = 'maaser-yashar-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
];

function isApiOrChat(url) {
  const p = url.pathname;
  return p.startsWith('/api/') || p.startsWith('/.netlify/functions/');
}

function isNavigate(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return request.method === 'GET' && accept.includes('text/html');
}

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|eot|map)$/i.test(
    url.pathname
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isApiOrChat(url)) return;

  if (isNavigate(request)) {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  if (isStaticAsset(url) || url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirstHtml(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone()).catch(() => undefined);
      cache.put('/index.html', fresh.clone()).catch(() => undefined);
    }
    return fresh;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/'));
    if (cached) return cached;
    return new Response('אופליין — אין גרסה שמורה.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone()).catch(() => undefined);
    }
    return fresh;
  } catch (err) {
    throw err;
  }
}
