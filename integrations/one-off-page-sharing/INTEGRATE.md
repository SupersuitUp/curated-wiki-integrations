# one-off-page-sharing

Share **one page** of a gated wiki with someone who has no business seeing the rest. They get that page as a self-contained letter at an unguessable address: no navbar, no sidebar, no table of contents, and no cross-links out. Every other route stays gated.

This is the recipe for the thing a password gate cannot do. `?key=<password>` and every "share link" built on it hand over the whole wiki, because the link IS the password. That is correct when you are inviting someone in. It is wrong when a single page belongs in a single conversation and the collection behind it does not.

Canonical write-up of the pattern: [The One-Off Share](https://userexperience.wiki/concepts/the-one-off-share).

## What the recipient gets

A dedicated reading page. The mirror is the same static HTML the wiki already built, with one `<style>` injected and the cross-links removed, so it cannot drift from the real page:

- **Chrome hidden.** Navbar, sidebar, TOC, breadcrumbs, prev/next pagination, footer.
- **Cross-links stripped.** The `Related:` line and bracketed `[See: ...]` pointers are removed; internal links unwrap to plain text so the prose still reads; links to the public web survive. An internal link on a shared page is a door that either bounces the guest off the gate or leaks the titles of pages nobody shared with them.
- **One deliberate door.** A footer linking to a `What Is This?` explainer, itself served as a share. Strip every exit and the guest holds a beautiful page with no idea what it came from.
- **No JS.** `/assets/js/*` stays gated, because Docusaurus chunks embed the rendered content of other pages. Without hydration the mirror is styled static HTML, which reads perfectly.

## Two kinds of share, one address space

Both live under `/s/<ref>`:

| | Expiring token (the default) | Committed slug |
|---|---|---|
| Minted by | The owner, from a button on the page | Editing `SHARES` in `shareRoutes.ts`, then a push |
| Lifetime | 24h by default, `ttlHours` up to 720 | Until you delete the entry |
| Revoke | Wait, or rotate the gate secret to kill all of them at once | Delete the line, push |
| Use it for | Nearly everything. A share belongs to the conversation that prompted it | A link you will hand out repeatedly (the explainer itself) |

A token is an HMAC of `{path, exp}` signed with the gate's own secret. Nothing is stored server-side, so there is no share database to keep, and rotating the gate secret revokes every outstanding link.

## Files

```
src/auth/shareRoutes.ts                    → <wiki>/src/auth/shareRoutes.ts
src/auth/share.ts                          → <wiki>/src/auth/share.ts
src/auth/share.test.ts                     → <wiki>/src/auth/share.test.ts
middleware.share-block.ts                  → <wiki>/middleware.share.ts
api/share.ts                               → <wiki>/api/share.ts
plugins/share-view-plugin/src/index.ts     → <wiki>/plugins/share-view-plugin/src/index.ts
plugins/share-view-plugin/src/stripCrossLinks.test.ts  → <wiki>/plugins/share-view-plugin/src/…
src/ShareLinkButton.tsx.snippet            → paste into the wiki's per-page control row
docs/what-is-this.md                       → <wiki>/docs/what-is-this.md   (REWRITE IT)
```

## Prerequisites

A gate that can answer "is this request authorized?" as a boolean, plus the secret it signs its own cookie with. `password-gate-edge-middleware` supplies both (`verifyTicket`, `WIKI_GATE_SECRET`). Any session gate works.

Serverless functions for `api/share.ts`. On a purely static host you can still ship committed slugs; you lose the mint button and the expiring half.

## Install steps

1. **Copy the files.** Rename `middleware.share-block.ts` to `middleware.share.ts` beside your existing `middleware.ts`.

2. **Register the plugin** in `docusaurus.config.ts`:

   ```ts
   plugins: [
     require.resolve('./plugins/share-view-plugin/src/index.ts'),
   ],
   ```

   It runs in `postBuild` and emits one mirror per page under `/share-view/`. Expect a log line like `[share-view] emitted 553 chrome-less share pages`.

3. **Call the share handler from `middleware.ts`**, after the bot-block 403 and before the gate's redirect:

   ```ts
   const shareResponse = await handleShare({
     url, cookieHeader: request.headers.get('cookie'),
     authorized, secret: process.env.WIKI_GATE_SECRET || '',
     readCookie, extraOpenAssets: ['/img/logo.webp'],
   });
   if (shareResponse === 'allow') return undefined;   // a share visitor's own asset
   if (shareResponse) return shareResponse;
   ```

   Put the wiki's navbar logo (and any other chrome asset) in `extraOpenAssets`, or shared pages render with a broken image where the logo goes.

4. **Point the gate's matcher at `/s/`.** If your matcher excludes anything with a file extension, `/s/<token>` already matches. Confirm it, because a share URL that never reaches the middleware just 404s.

5. **Set the cookie name** in `api/share.ts` (`SESSION_COOKIE`) and its `verifySession` import to your gate's.

6. **Wire the mint button.** Paste `ShareLinkButton.tsx.snippet` into wherever the wiki injects per-page controls.

7. **Rewrite `docs/what-is-this.md` in the owner's voice.** Shipping the placeholder is the one way this fails; a stranger can tell boilerplate from a real explanation.

8. **Run the tests.** `share.test.ts` covers the token (round-trip, expiry, tampering, wrong secret, empty secret, non-absolute path). `stripCrossLinks.test.ts` covers the mirror transform including minified markup.

## Gotchas

Every one of these shipped a visible bug before it was understood.

- **Authorized visitors must be REDIRECTED, never rewritten.** Their JS loads, Docusaurus hydrates, the client router finds no `/s/` route, and it paints "Page Not Found" over a page that was served correctly. Handled in `handleShare`; do not "simplify" it.
- **The rewrite target needs its trailing slash.** Platform rewrites resolve the exact static path with no clean-URL normalization, and Docusaurus emits `<route>/index.html`. A slashless rewrite serves the 404 shell. Handled in `shareViewPath`.
- **Production HTML is MINIFIED.** Attribute quotes are dropped when the value has no spaces (`href=/perspectives/x`) and optional closing tags like `</p>` are omitted. Regexes written against the pretty local build silently match nothing in production. Every pattern in the plugin tolerates both.
- **There is no `<main>` element** in the Docusaurus classic theme (the wrapper is `div.main-wrapper`), so any CSS scoped under `main` silently does nothing.
- **Hidden elements still reserve layout.** `docMainContainer` holds the sidebar's width via `calc(100% - var(--doc-sidebar-width))`, and the TOC sits inside a `col--3` wrapper. Hide the TOC alone and the column stays, off-centering the page. The shipped CSS releases both.
- **Bottom margin on the last element collapses out of the body.** The footer's breathing room is `padding`, not `margin`, or the text sits on the page edge.
- **Underscores are legal in slugs.** An overly strict path regex in `api/share.ts` rejects `letters/x_author`, which is exactly the kind of page people share. The shipped regex allows them.
- **Never report failure after a successful mint.** The clipboard write happens after an `await`, so a strict browser can refuse it on expired user activation. The link exists; show it instead of saying "Share failed".
- **Keep the repo private if you use committed slugs.** They are readable in source. Expiring tokens do not have this problem, which is a second reason they are the default.

## Verifying

```bash
# The share link serves the page, with no chrome and no internal links.
curl -sL https://<wiki>/s/<ref> | grep -c 'data-share-view'      # 1
curl -sL https://<wiki>/s/<ref> | grep -cE 'href="?/(perspectives|docs)'  # 0

# The canonical route is still gated.
curl -s -o /dev/null -w '%{http_code}\n' https://<wiki>/perspectives/<page>   # 302/401

# Crawlers are still refused (sharing is by path, for humans).
curl -s -A "ClaudeBot/1.0" -o /dev/null -w '%{http_code}\n' https://<wiki>/s/<ref>  # 403
```

Check the rendered page in a real browser too. The gate cannot tell you whether it reads beautifully.

## Alternatives

- **`?key=<password>` share links** (in `password-protect-docusaurus-wiki`): the right tool for inviting someone into the whole wiki. Wrong tool for one page.
- **Copy the page into a doc and send that.** Loses the art, the typography and every update, and the copy immediately goes stale.
- **Real per-document ACLs** (Vercel Authentication, Clerk, Cloudflare Access): correct when the material genuinely needs access control. This recipe is a soft share on top of a soft gate. Do not put regulated data behind either.
