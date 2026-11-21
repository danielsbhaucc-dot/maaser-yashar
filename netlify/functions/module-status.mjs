// Public anonymous gateway credential. The upstream returns only Maaser Yashar's accessibility flag.
const ENDPOINT = 'https://snvjsopfvoshddaydjlm.supabase.co/functions/v1/maaser-module-status';
const PUBLIC_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudmpzb3Bmdm9zaGRkYXlkamxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjAyOTksImV4cCI6MjEwODU5NjI5OX0.BOeBKT9G6HUQ0ObRk8vHZ9874YP-yhKP98QQUc1U40o";

export const config = { path: '/api/module-status' };

const response = (statusCode, body, extra = {}) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': statusCode === 200 ? 'public, max-age=0, s-maxage=30' : 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod !== 'GET') return response(405, { error: 'method' }, { allow: 'GET' });
  try {
    const upstream = await fetch(ENDPOINT, {
      headers: { apikey: PUBLIC_ANON, authorization: `Bearer ${PUBLIC_ANON}` },
      redirect: 'error',
      signal: AbortSignal.timeout(4500),
    });
    if (!upstream.ok) return response(503, { error: 'unavailable' });
    const data = await upstream.json();
    return typeof data?.a11y === 'boolean'
      ? response(200, { a11y: data.a11y })
      : response(503, { error: 'unavailable' });
  } catch {
    return response(503, { error: 'unavailable' });
  }
}
