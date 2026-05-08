# password-protect-docusaurus-wiki

A client-side React password gate for Docusaurus 3 wikis, plus a paired share-link button that lets gate-knowers send auto-unlocking URLs.

## What It Does

- Wraps the entire Docusaurus app in a `<Root>` swizzle that gates content behind a password until the visitor enters it correctly.
- Stores a localStorage flag on success, so the same browser auto-unlocks on subsequent visits.
- Accepts a `?key=<password>` query param on any URL: the gate auto-unlocks, the param is scrubbed from the URL with `history.replaceState`, and the flag is persisted.
- Returns `null` until React mounts so SSG output never flashes the unauthenticated content underneath.
- Pairs with `<ShareButton />`, an icon button you can place inside any doc (typically swizzled into `@theme/DocItem/Content`) that copies the current URL with the `?key=` param appended.

## Threat Model (Read This First)

This is a **soft gate**. Anyone who:
- views the page source,
- inspects the bundled JS,
- knows the password (it is hardcoded in source), or
- intercepts a share link

can bypass it. The intent is to:
- discourage casual browsing by people who shouldn't,
- keep search engines and most crawlers out (when paired with `bot-block-middleware` and a `Disallow: /` `robots.txt`),
- make gated content "feel" private without standing up real auth infra.

Do **not** put anything in a wiki guarded only by this that requires real access control (financial data, PII, regulated data, secrets). For that, use a server-side auth provider (Vercel Authentication, Clerk, Auth0).

## Files

```
src/Root.tsx              → wiki/src/theme/Root.tsx
src/ShareButton.tsx       → wiki/src/components/ShareButton.tsx
```

The `Root.tsx` path lives at `src/theme/Root.tsx` because Docusaurus auto-discovers `@theme/Root` swizzles from that location.

## Install Steps

1. **Copy `Root.tsx`** to `src/theme/Root.tsx` in your Docusaurus project. (No config change needed — Docusaurus picks up `@theme/Root` swizzles automatically.)

2. **Set the password.** At the top of `Root.tsx`:

   ```ts
   const STORAGE_KEY = 'your_wiki_auth_v1';   // unique per wiki
   const PASSWORD_LOWER = 'your-password';    // lowercase, will compare case-insensitively
   ```

   Bump `STORAGE_KEY` (e.g., `_v2`) any time you rotate the password and want existing browsers to re-enter.

3. **Brand the gate.** The `Root.tsx` markup has a hardcoded title (`Curia Regis · Truth Wiki`), CSS-variable color references (`--color-paper`, `--color-ink`, `--color-red`), and font-family references. Replace the title and define the CSS variables in `src/css/custom.css` (or remove the variable references and inline your colors).

4. **Copy `ShareButton.tsx`** to `src/components/ShareButton.tsx`.

5. **Set `SHARE_VALUE`** in `ShareButton.tsx` to match `PASSWORD_LOWER`. Both must stay in sync. The split exists because `ShareButton.tsx` runs in client bundles that may not import from `Root.tsx`.

6. **(Optional) Inject the share button under the H1** of every doc page. Swizzle `@theme/DocItem/Content`:

   ```bash
   npx docusaurus swizzle @docusaurus/theme-classic DocItem/Content -- --eject --typescript
   ```

   Then portal the `<ShareButton />` into a slot you create after the H1. (See `imagos-meta-repo/curia-regis-truth-wiki/src/theme/DocItem/Content/index.tsx` for the canonical pattern.)

7. **Test.**

   ```bash
   npm start
   ```

   Visit `http://localhost:3000` (or whatever port Docusaurus picks). You should see the gate. Enter the password. Reload — should auto-unlock. Visit `http://localhost:3000/?key=your-password` in a fresh browser — should auto-unlock and scrub the param.

## Customization

- **Storage key versioning.** Bumping `STORAGE_KEY` invalidates every existing browser's saved state. Use this for password rotation when you want to force re-entry.
- **Password hashing.** Replace the `===` compare with a hash check if you don't want the password sitting in plaintext in source. Note: this only raises the bar slightly — anyone who sees the source can still read the hash and brute-force it.
- **Multiple passwords.** Replace `PASSWORD_LOWER` with `PASSWORDS_LOWER: string[]` and check inclusion. Useful if different audiences share different links.
- **Animated entry.** The current gate is static and instant. To animate, gate the `setMounted(true)` behind a CSS animation completion, or wrap `<Root>` in a `<motion.div>`.

## Gotchas

- **SSG flash.** Returning `null` until mounted prevents the unauthenticated content from briefly rendering on first paint. Do not "fix" this by rendering content during SSR — it leaks the gated content into the static HTML, which crawlers (or anyone who curls the page) can then read directly.
- **localStorage failures.** Private browsing mode and some embedded browsers throw on `localStorage.setItem`. The wrapped try/catch keeps the gate working in-memory for the session even when storage is unavailable.
- **Share-link history pollution.** Without the `history.replaceState` cleanup, the password would persist in the URL and end up in browser history, screen recordings, and logs. The cleanup is non-optional.
- **Password compromise blast radius.** Once the password leaks, every existing share link works for whoever has it. Rotation requires updating both `Root.tsx` and `ShareButton.tsx` and bumping `STORAGE_KEY`.
- **AAS / SSO conflicts.** If your wiki sits behind an enterprise SSO at a higher layer (e.g., Cloudflare Access), you do not need this recipe and should not stack them.

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

Extracted from `imagos-meta-repo/curia-regis-truth-wiki` (cream paper / Cormorant Garamond / Geist) as of 2026-05-08. The original FaithWalk OS version had a slightly older auth model (different storage key, no share-link param scrubbing). Trust this version forward.
