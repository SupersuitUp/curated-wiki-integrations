// Share routing: the address space for one-off page shares, decoupled from whatever
// gate the wiki already runs. Both kinds of share live under one prefix, /s/<ref>:
//
//   1. A COMMITTED SLUG in SHARES, for a link that should outlive any expiry.
//   2. An EXPIRING TOKEN minted at runtime by api/share.ts (see share.ts).
//
// The gate calls shareTarget() before its session check and, when it returns a route,
// serves the chrome-less mirror of that route instead of the gated page.

// Permanent shares. Each entry maps an unguessable slug to ONE exact route.
// Mint a slug with: openssl rand -hex 8
// Deleting an entry revokes that link. Keep this file in a PRIVATE repo, or every
// permanent slug is readable in source.
export const SHARES: Record<string, string> = {
  // 'a1b2c3d4e5f6a7b8': '/perspectives/some-article',

  // Deliberately guessable, and that is the point: the public explainer every shared
  // page links to in its footer. Ships with the recipe's docs/what-is-this.md.
  'what-is-this': '/what-is-this',
};

// Where the chrome-less mirror lives (emitted by plugins/share-view-plugin).
export const SHARE_VIEW_PREFIX = '/share-view';

function lastSegment(route: string): string {
  const parts = route.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

// /s/<ref> (with or without trailing slash) -> the ref, else undefined.
export function shareRef(pathname: string): string | undefined {
  const m = pathname.match(/^\/s\/([^/]+)\/?$/);
  return m ? m[1] : undefined;
}

// A committed slug resolves here. Expiring tokens resolve in the middleware, because
// verifying one is async.
export function shareTarget(
  pathname: string,
  shares: Readonly<Record<string, string>> = SHARES,
): string | undefined {
  const ref = shareRef(pathname);
  return ref ? shares[ref] : undefined;
}

// The static path that serves a share target.
//
// The trailing slash is LOAD-BEARING: a platform rewrite resolves the exact static
// path with no clean-URL normalization, and Docusaurus emits <route>/index.html, so a
// slashless rewrite serves the 404 shell.
export function shareViewPath(route: string): string {
  return SHARE_VIEW_PREFIX + (route.endsWith('/') ? route : route + '/');
}

// Assets a shared page needs to render, and no more.
//
// Deliberately NOT included: /assets/js/*. Docusaurus JS chunks embed the rendered
// content of OTHER pages, so serving them to a share visitor leaks the wiki. Without
// hydration the mirror is styled static HTML, which reads perfectly.
export function isSharedAsset(
  pathname: string,
  shares: Readonly<Record<string, string>> = SHARES,
  extraOpenAssets: readonly string[] = [],
): boolean {
  const targets = Object.values(shares);
  if (targets.length === 0) return false;
  if (pathname.startsWith('/assets/css/')) return true;
  // The navbar logo and any other chrome asset the host wiki names.
  if (extraOpenAssets.includes(pathname)) return true;
  // The shared page's own images, by the cover-naming convention
  // (/img/<slug>.webp, /img/<slug>-body.webp, ...). Other pages' images stay gated.
  if (pathname.startsWith('/img/')) {
    const file = pathname.slice('/img/'.length);
    return targets.some((p) => {
      const base = lastSegment(p);
      return base !== '' && (file.startsWith(base + '.') || file.startsWith(base + '-'));
    });
  }
  return false;
}
