# password-gate-edge-middleware

A soft password gate for a **static wiki deployed on Vercel** (Docusaurus 3 or any other static output), implemented as Vercel Routing Middleware at the repo root with an HMAC-signed, expiring cookie.

**The password never reaches the browser.** It lives in `WIKI_PASSWORD` on Vercel and is compared at the edge. What the visitor's browser stores is a signed ticket that proves nothing except "this browser answered correctly at time T."

## Choose This Or `password-protect-docusaurus-wiki`

Both are soft gates. They differ in where the password ends up.

| | `password-gate-edge-middleware` (this one) | `password-protect-docusaurus-wiki` |
|---|---|---|
| Where the check runs | Vercel edge, before the cache | Browser, in a `Root.tsx` swizzle |
| Where the password ends up | Only in the Vercel env var | **Inlined into the JS bundle every visitor downloads** |
| Unlock proof | HMAC-signed HttpOnly cookie, 30 days | `localStorage` boolean |
| What is gated | Exactly what the `matcher` says | Every React-rendered route, all or nothing |
| Static files (`/llms.txt`, `*.md`) | Open, by explicit matcher exclusion | Open, incidentally (React never runs on them) |
| Share links | Not included (add one if you want it) | `?key=<password>` auto-unlock plus `<ShareButton />` |
| Host requirement | Vercel | Any static host |

**Default to this recipe** when the wiki deploys to Vercel. Reach for the client-side one when you need the `?key=` share-link flow, or when the host is not Vercel.

Neither is real access control. Do not put anything behind either one that needs it (PII, secrets, regulated data). For that, use Vercel Authentication, Clerk, or Cloudflare Access.

## Files

```
middleware.ts        → <wiki-repo>/middleware.ts        (repo root, NOT src/)
middleware.test.ts   → <wiki-repo>/scripts/middleware.test.ts
```

## Install Steps

1. **Copy `middleware.ts` to the repo root.** Vercel discovers it there for any framework.

2. **Edit the `matcher` so your machine layer stays open.** This is the load-bearing step. The shipped matcher skips the `assets/` and `img/` prefixes plus **anything with a file extension**:

   ```
   '/((?!assets/|img/|.*\\.(?:md|txt|json|xml|js|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|map|pdf)$).*)'
   ```

   That one rule keeps `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/search-index.json`, `/tools/*.md`, `/skills/**/SKILL.md`, `/generators/**/GENERATE.md`, and every og share card publicly reachable, while gating the extensionless HTML routes. Add prefixes for anything else that must stay open.

3. **Rebrand the gate page.** `gatePage()` holds the whole page: colors, fonts, copy. Replace the CSS custom properties with your wiki's tokens and rewrite the copy. Keep the `<link rel="stylesheet">` to your font provider, because middleware responses do not inherit the site's CSS.

4. **Set the env vars on Vercel:**

   ```bash
   printf 'your-password' | npx vercel env add WIKI_PASSWORD production
   printf "$(openssl rand -hex 32)" | npx vercel env add WIKI_GATE_SECRET production
   ```

   Use `printf`, not `echo`; `echo` appends a `\n` that breaks the value. Repeat for `development`. For `preview`, the CLI's non-interactive path currently loops on a `git_branch_required` prompt even when you follow its own suggested command; leaving preview unset is safe, because an unset `WIKI_PASSWORD` disables the gate.

   `WIKI_GATE_SECRET` is optional. Without it the code derives a secret from the password, which means rotating the password also invalidates every cookie. Set it explicitly when you want those to be independent.

5. **Run the tests.** Copy `middleware.test.ts` to `scripts/`, add the script, and run it. Node 22.6+ strips the types natively, so there is no test framework to install:

   ```json
   "test:middleware": "node --test scripts/middleware.test.ts"
   ```

   Edit the must-stay-open path list to match your wiki before trusting it. That test is the reason you find a broken matcher on your machine instead of on the live site.

6. **Verify live after deploying**, because the matcher is the thing that silently breaks:

   ```bash
   for p in / /llms.txt /robots.txt /img/og/home.png; do
     printf '%-24s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://your.wiki$p")"
   done
   ```

   Gated paths should return `401`; open paths `200`.

## How It Works

- **GET a gated path with no valid cookie** returns `401` with the gate page and `X-Robots-Tag: noindex`.
- **POST to the same path** carries the form. A wrong answer re-renders the gate with an error at `401`. A right answer returns `303` back to the same path with `Set-Cookie`. Posting to the requested path is what preserves deep links: unlock on `/concepts/foo` and you land on `/concepts/foo`.
- **The cookie** is `v1.<unix-expiry>.<base64url HMAC-SHA256 of "v1.<expiry>">`, `HttpOnly; Secure; SameSite=Lax`, 30 days. Verification checks the version, the expiry, and the signature with a constant-time compare.
- **Password comparison is trimmed and lowercased**, so a phone's autocapitalize does not lock a visitor out.
- **Link-preview crawlers pass through** by User-Agent (Twitterbot, Slackbot, facebookexternalhit, Applebot, Discordbot and friends) so shared links keep unfurling with their real per-page og card. Drop that block if you would rather every unfurl show the gate page's own card.

## Gotchas

- **The matcher is the whole recipe.** Get it wrong and you either gate `/llms.txt` (agents get a password form) or ungate a whole section. Test it, then curl it live.
- **Extensionless routes only.** If your wiki serves an HTML route containing a dot (rare, but slugs like `/v1.2/notes` do it), the extension rule will skip the gate on it. Check your route list.
- **`trailingSlash` matters.** If the site is configured with trailing slashes, verify the `303` `location` lands where you expect rather than bouncing through a redirect.
- **Rotation.** Update `WIKI_PASSWORD` on Vercel **and** bump `COOKIE_VERSION` in `middleware.ts`, otherwise everyone holding a live cookie stays in for up to 30 days.
- **Env vars are read at runtime by the edge function**, but a fresh deploy is still the reliable way to pick up a change. Redeploy after adding them.
- **SEO.** A gated wiki returning `401` with `noindex` will progressively drop out of the search index. That is the honest behavior. Do not try to fix it by letting Googlebot through, which is cloaking; if search traffic matters more than the gate, remove the gate.
- **Do not stack this under an enterprise SSO** (Vercel Authentication, Cloudflare Access). Pick one layer.

## Pairs Well With

- `generate-llms-txt`: the machine layer this recipe deliberately leaves open.
- `bot-block-middleware`: same file, same matcher shape. If you want both, merge the UA check into this one file rather than shipping two middlewares; only one root `middleware.ts` runs.

## Source

Extracted from `buildonanthropic-wiki` (clay on ivory, Source Serif 4 over Inter) as of 2026-07-22, where the gate exists as an in-group handshake for YC founders rather than a security boundary. Ships with the test file that caught the matcher cases.
