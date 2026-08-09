// PASTE-IN MODULE for the host wiki's `middleware.ts`. Copy this file next to your
// middleware and call `handleShare(...)` from it: immediately AFTER the bot-block 403
// and BEFORE the gate's own redirect-to-login.
//
// Works with `password-gate-edge-middleware` (verifyTicket / the wiki_gate cookie) or
// any gate that can answer "is this request already authorized?" as a boolean.
//
//   const shareResponse = await handleShare({
//     url, cookieHeader: request.headers.get('cookie'),
//     authorized, secret: process.env.WIKI_GATE_SECRET || '', readCookie,
//   });
//   if (shareResponse) return shareResponse;

import { shareRef, shareTarget, shareViewPath, isSharedAsset, SHARES } from './src/auth/shareRoutes';
import { verifyShareToken } from './src/auth/share';

export interface ShareRequest {
  url: URL;
  cookieHeader: string | null;
  /** The host gate's own verdict on this request. */
  authorized: boolean;
  /** The same secret the host gate signs its cookie with. */
  secret: string;
  readCookie: (header: string | null, name: string) => string | undefined;
  /** Chrome assets a shared page needs, e.g. ['/img/logo.webp']. */
  extraOpenAssets?: readonly string[];
}

/**
 * Returns a Response when the request is a share request (or a share visitor's asset
 * that should be allowed), and undefined when the host gate should handle it.
 *
 * `undefined` means two different things by design, and both are correct: "not a share
 * request, gate it normally" and "a share visitor's own asset, let it through". The
 * caller distinguishes them by checking `allowed` on the returned marker below.
 */
export async function handleShare(req: ShareRequest): Promise<Response | 'allow' | undefined> {
  const { url, cookieHeader, authorized, secret, readCookie, extraOpenAssets = [] } = req;
  const now = Math.floor(Date.now() / 1000);

  const ref = shareRef(url.pathname);
  if (ref) {
    // 1. A committed permanent slug, or 2. a signed expiring token.
    let target = shareTarget(url.pathname);
    let tokenRef: string | undefined;
    let tokenExp = 0;

    if (!target && !(ref in SHARES)) {
      const share = await verifyShareToken(ref, secret, now);
      if (share) {
        target = share.p;
        tokenRef = ref;
        tokenExp = share.exp;
      }
    }

    if (target) {
      // AUTHORIZED visitors get a REDIRECT to the canonical page, never the mirror.
      // Their JS loads, Docusaurus hydrates, and the client router 404s the /s/ path,
      // painting "Page Not Found" over a page that was served correctly.
      if (authorized) return Response.redirect(new URL(target, url.origin), 302);

      const headers = new Headers({
        'x-middleware-rewrite': new URL(shareViewPath(target), url.origin).toString(),
      });
      // A token's target images cannot be enumerated at build time, so hand the browser
      // a scoped cookie and let the asset branch below verify it.
      if (tokenRef) {
        const maxAge = Math.max(60, Math.min(tokenExp - now, 86400));
        headers.append(
          'set-cookie',
          `wiki_share=${tokenRef}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
        );
      }
      return new Response(null, { headers });
    }
    // An unknown /s/<ref>: fall through so the host gate refuses it.
    return undefined;
  }

  // 3. Asset requests from a share visitor.
  if (!authorized) {
    if (isSharedAsset(url.pathname, SHARES, extraOpenAssets)) return 'allow';

    const shareCookie = readCookie(cookieHeader, 'wiki_share');
    if (shareCookie && !(shareCookie in SHARES)) {
      const share = await verifyShareToken(shareCookie, secret, now);
      if (share && isSharedAsset(url.pathname, { token: share.p }, extraOpenAssets)) {
        return 'allow';
      }
    }
  }

  return undefined;
}
