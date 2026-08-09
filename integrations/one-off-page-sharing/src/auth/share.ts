// Expiring share tokens (default 24h), the inline complement to the committed SHARES
// map in shareRoutes.ts. A token IS the unguessable slug: /s/<token> serves one article until
// the token expires. Minted by api/share.ts for the wiki owner, verified by the edge middleware. Same HMAC + Web Crypto approach as session.ts, the same secret the
// gate signs its own cookie with, so rotating that secret revokes every outstanding
// share link at once (along with every session).
const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export interface SharePayload { p: string; exp: number } // p = article route, exp = unix seconds

export async function mintShareToken(payload: SharePayload, secret: string): Promise<string> {
  // Fail closed: an empty key is known to any attacker.
  if (!secret) throw new Error('SESSION_SECRET is required to mint a share token');
  if (!payload.p.startsWith('/')) throw new Error('share path must be site-absolute');
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = b64urlEncode(await hmac(secret, body));
  return `${body}.${sig}`;
}

export async function verifyShareToken(token: string, secret: string, nowSeconds: number): Promise<SharePayload | null> {
  if (!secret) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = b64urlEncode(await hmac(secret, body));
  if (!timingSafeEqual(sig, expected)) return null;
  let payload: SharePayload;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))); } catch { return null; }
  if (typeof payload?.exp !== 'number' || payload.exp < nowSeconds) return null;
  if (typeof payload?.p !== 'string' || !payload.p.startsWith('/')) return null;
  return { p: payload.p, exp: payload.exp };
}
