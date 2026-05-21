# password-protect-docusaurus-wiki

A client-side React password gate for Docusaurus 3 wikis, plus a paired share-link button that lets gate-knowers send auto-unlocking URLs. **The password is supplied via an environment variable at build time** — not hardcoded in source — so you can rotate it on Vercel without touching the repo.

## What It Does

- Wraps the entire Docusaurus app in a `<Root>` swizzle that gates content behind a password until the visitor enters it correctly.
- Stores a localStorage flag on success, so the same browser auto-unlocks on subsequent visits.
- Accepts a `?key=<password>` query param on any URL: the gate auto-unlocks, the param is scrubbed from the URL with `history.replaceState`, and the flag is persisted.
- Returns `null` until React mounts so SSG output never flashes the unauthenticated content underneath.
- Pairs with `<ShareButton />`, an icon button you can place inside any doc (typically swizzled into `@theme/DocItem/Content`) that copies the current URL with the `?key=` param appended.
- Reads the password from `siteConfig.customFields.wikiPassword`, which in turn reads `process.env.WIKI_PASSWORD` in `docusaurus.config.ts`. Both `Root.tsx` and `ShareButton.tsx` consume the same value through `useDocusaurusContext()` — single source of truth, no constant duplication.
- If `WIKI_PASSWORD` is unset at build time (empty string), the gate is bypassed entirely so dev/preview deploys don't blackhole. Set the env var to enable the gate.

## Threat Model (Read This First)

This is a **soft gate**. Anyone who:
- views the page source,
- inspects the bundled JS (the password is inlined into the client bundle at build time, regardless of whether it came from an env var or a hardcoded constant),
- knows the password, or
- intercepts a share link

can bypass it. The intent is to:
- discourage casual browsing by people who shouldn't,
- keep search engines and most crawlers out (when paired with `bot-block-middleware` and a `Disallow: /` `robots.txt`),
- make gated content "feel" private without standing up real auth infra.

Do **not** put anything in a wiki guarded only by this that requires real access control (financial data, PII, regulated data, secrets). For that, use a server-side auth provider (Vercel Authentication, Clerk, Auth0).

**The env-var approach does not add security** — it adds operational convenience (rotate via `vercel env` instead of editing source). The password ends up in the client JS bundle either way.

## Files

```
src/Root.tsx              → wiki/src/theme/Root.tsx
src/ShareButton.tsx       → wiki/src/components/ShareButton.tsx
```

The `Root.tsx` path lives at `src/theme/Root.tsx` because Docusaurus auto-discovers `@theme/Root` swizzles from that location.

## Install Steps

1. **Copy `Root.tsx`** to `src/theme/Root.tsx` in your Docusaurus project. (No config change needed for swizzle discovery — Docusaurus picks up `@theme/Root` automatically.)

2. **Copy `ShareButton.tsx`** to `src/components/ShareButton.tsx`.

3. **Expose the password via `customFields` in `docusaurus.config.ts`:**

   ```ts
   const config: Config = {
     // ...
     customFields: {
       // Read at build time, exposed to the client gate (src/theme/Root.tsx)
       // and share-link button (src/components/ShareButton.tsx).
       wikiPassword: process.env.WIKI_PASSWORD ?? '',
     },
     // ...
   };
   ```

   Both `Root.tsx` and `ShareButton.tsx` read this value via `useDocusaurusContext()`. No other configuration needed.

4. **Set `WIKI_PASSWORD` on Vercel** for the wiki's project (Production, Preview, Development):

   ```bash
   # From the wiki repo root, after `vercel link`:
   printf 'your-password' | npx vercel env add WIKI_PASSWORD production
   printf 'your-password' | npx vercel env add WIKI_PASSWORD preview
   printf 'your-password' | npx vercel env add WIKI_PASSWORD development
   ```

   Use `printf` not `echo` — `echo` appends a trailing `\n` that breaks the value.

5. **Set `WIKI_PASSWORD` for local dev.** Either:
   - Inline per command: `WIKI_PASSWORD=your-password npm start`
   - Or `npx vercel env pull .env.local` to grab it from Vercel, then source it in your shell before starting (Docusaurus doesn't auto-load `.env` files unless you wire up `dotenv` in `docusaurus.config.ts`).

   If `WIKI_PASSWORD` is unset, the gate is bypassed (`gateDisabled=true`). That's intentional so local dev and preview deploys without the env var don't black-hole.

6. **Bump `STORAGE_KEY` in `Root.tsx`** when you rotate the password (e.g. `'your_wiki_auth_v1'` → `'your_wiki_auth_v2'`) so existing browsers' saved unlocks invalidate and force re-entry. Otherwise rotation only blocks new visitors.

7. **Brand the gate.** `Root.tsx` has a hardcoded label (`Your Wiki · Truth Wiki`), CSS-variable color references (`--color-paper`, `--color-ink`, `--color-red`), and font-family references. Replace the label and define the CSS variables in `src/css/custom.css` (or remove the variable references and inline your colors).

8. **(Optional) Inject the share button under the H1** of every doc page. Swizzle `@theme/DocItem/Content`:

   ```bash
   npx docusaurus swizzle @docusaurus/theme-classic DocItem/Content -- --eject --typescript
   ```

   Then portal the `<ShareButton />` into a slot you create after the H1. (See `imagos-meta-repo/curia-regis-truth-wiki/src/theme/DocItem/Content/index.tsx` or `supersuit-repos/supersuit-wiki/src/theme/DocItem/Content/index.tsx` for the canonical pattern.)

9. **Test.**

   ```bash
   WIKI_PASSWORD=your-password npm start
   ```

   Visit `http://localhost:3000` (or whatever port Docusaurus picks). You should see the gate. Enter the password. Reload — should auto-unlock. Visit `http://localhost:3000/?key=your-password` in a fresh browser — should auto-unlock and scrub the param.

## Customization

- **Storage key versioning.** Bumping `STORAGE_KEY` invalidates every existing browser's saved state. Use this for password rotation when you want to force re-entry.
- **Password hashing.** Replace the `===` compare in `Root.tsx` with a hash check if you don't want the password sitting in plaintext in the bundle. Note: anyone who sees the bundle can still read the hash and brute-force it.
- **Multiple passwords.** Change `customFields.wikiPassword` to `wikiPasswords: (process.env.WIKI_PASSWORDS ?? '').split(',')` and check inclusion in `Root.tsx`/`ShareButton.tsx`. Useful when different audiences share different links.
- **Animated entry.** The current gate is static and instant. To animate, gate the `setMounted(true)` behind a CSS animation completion, or wrap the gate in a `<motion.div>`.

## Gotchas

- **SSG flash.** Returning `null` until mounted prevents the unauthenticated content from briefly rendering on first paint. Do not "fix" this by rendering content during SSR — it leaks the gated content into the static HTML, which crawlers (or anyone who curls the page) can then read directly.
- **Env-var not inlined.** If you find the gate is bypassed in production, check that `WIKI_PASSWORD` is actually set on the Vercel project for the Production environment. `vercel env ls production` lists what's there. After adding a new env var, trigger a fresh deploy — Vercel inlines env vars at build time, not runtime, so existing deployments don't pick up new values automatically.
- **localStorage failures.** Private browsing mode and some embedded browsers throw on `localStorage.setItem`. The wrapped try/catch keeps the gate working in-memory for the session even when storage is unavailable.
- **Share-link history pollution.** Without the `history.replaceState` cleanup, the password would persist in the URL and end up in browser history, screen recordings, and logs. The cleanup is non-optional.
- **Password compromise blast radius.** Once the password leaks, every existing share link works for whoever has it. Rotation requires updating `WIKI_PASSWORD` on Vercel, bumping `STORAGE_KEY` in `Root.tsx`, and redeploying.
- **AAS / SSO conflicts.** If your wiki sits behind an enterprise SSO at a higher layer (e.g., Cloudflare Access, Vercel Authentication), you do not need this recipe and should not stack them.

## Alternatives

- **Vercel Authentication.** Server-side, free for personal accounts. Better security model. The user must have a Vercel account to view. Heavier UX (the visitor has to authenticate with Vercel, not just type a password).
- **Clerk / Auth0 / Descope.** Production-grade auth. Higher operational cost. Right when the wiki holds anything sensitive.
- **Cloudflare Access.** Enterprise zero-trust. Right for orgs that already run on Cloudflare.

The recipe in this folder is right when:
- the wiki is informational, not regulated,
- the audience is small and trusted,
- you want the gate to be an aesthetic and friction layer rather than a security boundary.

## Pairs Well With

- `bot-block-middleware` — also in this repo. Stops LLM crawlers from indexing the gated wiki even if a share link leaks. Both layers should run together.
- `wiki-changelog` — adds a recently-added page that respects the same gate.

## Source

Extracted from `imagos-meta-repo/curia-regis-truth-wiki` (cream paper / Cormorant Garamond / Geist) as of 2026-05-08. Updated 2026-05-21 to read the password from `siteConfig.customFields.wikiPassword` (sourced from `process.env.WIKI_PASSWORD`) rather than hardcoded constants — pattern proven on `supersuit-repos/supersuit-wiki`. Trust this version forward.
