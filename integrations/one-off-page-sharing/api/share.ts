// Mint an expiring share link (default 24h) for one article. Signed-in users only:
// the fw_session cookie is the authorization. Returns the /s/<token> URL the caller
// can hand to anyone; the edge middleware verifies and serves it until expiry.
import type { VercelRequest, VercelResponse } from '@vercel/node';
// The host wiki's own session verifier. With password-gate-edge-middleware this is
// verifyTicket in middleware.ts; with any other gate, swap this import for whatever
// proves "this request is the wiki owner". Minting must never be open to the public.
import { verifySession } from '../src/auth/session';
import { mintShareToken } from '../src/auth/share';

// Rename to match the host wiki's gate cookie.
const SESSION_COOKIE = 'wiki_session';

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const secret = process.env.SESSION_SECRET || '';
  const now = Math.floor(Date.now() / 1000);
  const session = await verifySession(readCookie(req.headers.cookie, SESSION_COOKIE) || '', secret, now);
  if (!session) return res.status(401).json({ error: 'not_signed_in' });

  const path = typeof req.body?.path === 'string' ? req.body.path : '';
  // Only a plain article route is shareable: site-absolute, one origin, and never the
  // auth surfaces or the share prefix itself. Underscores are load-bearing: every
  // letter slug carries one (_russ, _brenda), and omitting it made Share fail on
  // exactly the pages Gary shares most (found live 2026-08-09).
  if (!/^\/[a-z0-9\-_/]+$/i.test(path) || path.includes('//')) {
    return res.status(400).json({ error: 'bad_path' });
  }
  if (['/login', '/api', '/s'].some((p) => path === p || path.startsWith(p + '/'))) {
    return res.status(400).json({ error: 'bad_path' });
  }

  const ttlHours = Math.min(Math.max(Number(req.body?.ttlHours) || 24, 1), 720);
  const exp = now + ttlHours * 3600;
  const tokenStr = await mintShareToken({ p: path.replace(/\/$/, ''), exp }, secret);
  const url = `https://${req.headers.host}/s/${tokenStr}`;
  return res.status(200).json({ url, expiresAt: exp, ttlHours });
}
