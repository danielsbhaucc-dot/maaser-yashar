/**
 * אבטחה משותפת לפונקציות AI —
 * CORS מצומצם, בדיקת Origin/Referer/Content-Type, ומניעת שימוש חופשי כפרוקסי.
 *
 * חשוב (כנות): Origin/Referer ניתנים לזיוף ע״י לקוחות שאינם דפדפן.
 * זו שכבת חיכוך נגד שימוש שגוי/מקרי מהדפדפן — לא אבטחה מוחלטת.
 * ההגנות האמיתיות: rate-limit (Netlify + per-IP), תקציב יומי, ו־credit cap במפתח OpenRouter.
 */

const PROD_DEFAULT_ORIGINS = ['https://maaser-yashar.netlify.app'];

const LOCAL_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:8888',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
  'http://127.0.0.1:8888',
];

/** CONTEXT=production או לא ב־netlify dev מקומי */
export function isProdLike() {
  return (
    process.env.CONTEXT === 'production' || process.env.NETLIFY_DEV !== 'true'
  );
}

export function isProductionContext() {
  return process.env.CONTEXT === 'production';
}

function allowedOrigins() {
  const fromEnv = (process.env.AI_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const site = [];
  const url = typeof process.env.URL === 'string' ? process.env.URL.replace(/\/$/, '') : '';
  if (url) site.push(url);

  // DEPLOY_PRIME_URL / DEPLOY_URL — רק מחוץ ל־production (preview / branch)
  if (!isProductionContext()) {
    for (const key of ['DEPLOY_PRIME_URL', 'DEPLOY_URL']) {
      const v =
        typeof process.env[key] === 'string'
          ? process.env[key].replace(/\/$/, '')
          : '';
      if (v) site.push(v);
    }
  }

  // localhost בברירת מחדל רק מחוץ ל־production; ב־prod רק אם מופיע ב־AI_ALLOWED_ORIGINS
  const locals = isProductionContext() ? [] : LOCAL_ORIGINS;

  return [...new Set([...PROD_DEFAULT_ORIGINS, ...locals, ...fromEnv, ...site])];
}

export function corsHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const allowed = allowedOrigins();
  // אף פעם לא * — רק מקור מאושר. מקור זר לא מקבל Allow-Origin.
  if (origin && allowed.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };
  }
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': allowed[0],
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };
  }
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function header(headers, name) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === lower) return typeof v === 'string' ? v : '';
  }
  return '';
}

/**
 * מאמת שהקריאה מגיעה ממקור מורשה + Content-Type תקין.
 * ב־production / מחוץ ל־netlify dev: חובה Origin או Referer ברשימה.
 * פטור בלי Origin רק אם AI_ALLOW_NO_ORIGIN=true (ברירת מחדל כבוי) או NETLIFY_DEV.
 */
export function assertAllowedCaller(event) {
  const headers = event.headers || {};
  const origin = header(headers, 'origin');
  const referer = header(headers, 'referer');
  const allowed = allowedOrigins();

  const contentType = header(headers, 'content-type').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return { ok: false, status: 415, error: 'Content-Type חייב להיות application/json' };
  }

  const secFetchSite = header(headers, 'sec-fetch-site').toLowerCase();
  if (secFetchSite) {
    if (secFetchSite !== 'same-origin' && secFetchSite !== 'same-site') {
      return { ok: false, status: 403, error: 'מקור לא מורשה' };
    }
  }

  if (origin) {
    if (!allowed.includes(origin)) {
      return { ok: false, status: 403, error: 'מקור לא מורשה' };
    }
    return { ok: true };
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!allowed.includes(refOrigin)) {
        return { ok: false, status: 403, error: 'מקור לא מורשה' };
      }
      return { ok: true };
    } catch {
      return { ok: false, status: 403, error: 'מקור לא מורשה' };
    }
  }

  // בלי Origin ובלי Referer
  const isLocalDev = process.env.NETLIFY_DEV === 'true';
  if (isLocalDev) return { ok: true };

  // פטור מפורש (למשל בדיקות) — ברירת מחדל כבוי
  if (process.env.AI_ALLOW_NO_ORIGIN === 'true') {
    return { ok: true };
  }

  // ב־production / preview: דפדפן תמיד שולח Origin ב־POST — בלי זה → 403
  if (isProdLike()) {
    return { ok: false, status: 403, error: 'מקור לא מורשה' };
  }

  return { ok: false, status: 403, error: 'מקור לא מורשה' };
}

export function json(event, statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(event),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function optionsResponse(event) {
  return { statusCode: 204, headers: corsHeaders(event), body: '' };
}

/** ייצוא לבדיקות */
export { allowedOrigins };
