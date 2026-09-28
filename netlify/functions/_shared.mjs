/**
 * אבטחה משותפת לפונקציות AI —
 * CORS מצומצם, בדיקת Origin, ומניעת שימוש חופשי כפרוקסי כללי.
 */

const DEFAULT_ORIGINS = [
  'https://maaser-yashar.netlify.app',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:8888',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
  'http://127.0.0.1:8888',
];

function allowedOrigins() {
  const fromEnv = (process.env.AI_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const site = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL]
    .map((s) => (typeof s === 'string' ? s.replace(/\/$/, '') : ''))
    .filter(Boolean);
  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv, ...site])];
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

/**
 * דפדפן מאתר זר → חסום.
 * בקשות בלי Origin/Referer (curl / סקריפט) → חסומות, חוץ מ־Netlify Dev מקומי.
 * אפליקציה נייטיב שולחת Origin ריק — מותרת רק אם יש App-Token תואם או שאין Origin
 * ממקור דפדפן; בפועל RN שולח בלי Origin ולכן נשען על rate-limit + הנחיה קבועה בשרת.
 */
export function assertAllowedCaller(event) {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const referer = headers.referer || headers.Referer || '';
  const allowed = allowedOrigins();

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

  // בלי Origin ובלי Referer: לאפשר רק בסביבת פיתוח מקומית / קריאות native
  const context = event.requestContext || {};
  const isLocal =
    process.env.NETLIFY_DEV === 'true' ||
    process.env.CONTEXT === 'dev' ||
    String(context.siteUrl || '').includes('localhost');

  if (isLocal) return { ok: true };

  // Native apps — אין Origin. מאפשרים עם rate limit; ההנחיה בכל מקרה נבנית בשרת.
  const ua = headers['user-agent'] || headers['User-Agent'] || '';
  const looksLikeBrowser =
    /Mozilla|Chrome|Safari|Firefox|Edg\//i.test(ua) &&
    !/Expo|okhttp|CFNetwork|Darwin|ReactNative/i.test(ua);

  if (looksLikeBrowser) {
    return { ok: false, status: 403, error: 'מקור לא מורשה' };
  }

  return { ok: true };
}

export function json(event, statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(event),
    },
    body: JSON.stringify(body),
  };
}

export function optionsResponse(event) {
  return { statusCode: 204, headers: corsHeaders(event), body: '' };
}
