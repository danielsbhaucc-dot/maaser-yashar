import { createHash, createHmac, randomBytes } from 'node:crypto';

const CENTRAL = 'https://snvjsopfvoshddaydjlm.supabase.co/functions/v1/product-link';
const PATH = '/v1/central';
const BODY = JSON.stringify({ fn: 'central_module_states', args: { p_product: 'maaser-yashar' } });

export const config = { path: '/api/module-status' };

const reply = (statusCode, payload, headers = {}) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': statusCode === 200 ? 'public, max-age=0, s-maxage=30' : 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  },
  body: JSON.stringify(payload),
});

export function a11yStatus(data) {
  if (!Array.isArray(data?.states)) return null;
  const rows = data.states.filter(row => row?.moduleId === 'a11y');
  if (rows.length !== 1 || typeof rows[0].enabled !== 'boolean') return null;
  return rows[0].enabled && data.productStatus !== 'disabled';
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return reply(405, { error: 'method' }, { allow: 'GET' });

  const key = process.env.PRODUCT_LINK_KEY_ID;
  const secret = process.env.PRODUCT_LINK_SECRET;
  if (!/^pk_[a-z0-9]{16}$/.test(key ?? '') || !secret) return reply(503, { error: 'not_configured' });

  const ts = String(Date.now());
  const nonce = randomBytes(18).toString('base64url');
  const digest = createHash('sha256').update(BODY).digest('hex');
  const sig = createHmac('sha256', secret).update([ts, nonce, PATH, digest].join('\n')).digest('base64url');
  try {
    const response = await fetch(CENTRAL + PATH, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(4500),
      headers: { 'content-type': 'application/json', 'x-pl-key': key, 'x-pl-ts': ts, 'x-pl-nonce': nonce, 'x-pl-sig': sig },
      body: BODY,
    });
    if (!response.ok) return reply(503, { error: 'central_unavailable' });
    const state = a11yStatus((await response.json())?.data);
    return state === null ? reply(503, { error: 'module_state_unavailable' }) : reply(200, { a11y: state });
  } catch {
    return reply(503, { error: 'central_unavailable' });
  }
}
