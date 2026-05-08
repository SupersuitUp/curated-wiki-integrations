# wiki-search

A custom MiniSearch-powered search plugin for Docusaurus 3 wikis. Build-time index, runtime modal with `Cmd+K` and `/` triggers, lazy-loaded modal bundle so the search UI doesn't bloat the initial page load.

## What It Does

- Walks `docs/**/*.{md,mdx}` at build time, parses frontmatter, strips Markdown/MDX to plain text via `remark` + `strip-markdown`, and writes a `SearchEntry[]` JSON array to `static/search-index.json`.
- Indexes title, headings, description, and body text.
- Swizzles `@theme/SearchBar` to render a navbar trigger button (with `Cmd+K` / `/` keyboard shortcuts).
- On first open, dynamically imports the search modal, which mounts via `createPortal` to `document.body` (so it escapes the navbar's stacking context).
- Runtime engine is a pure module (`engine.ts`) with no React or Docusaurus imports — testable in isolation.

## Files

```
plugin/
  package.json                              → wiki/plugins/search-plugin/package.json
  src/
    index.ts                                → wiki/plugins/search-plugin/src/index.ts
    build-index.ts                          → wiki/plugins/search-plugin/src/build-index.ts
    engine.ts                               → wiki/plugins/search-plugin/src/engine.ts
    theme/
      SearchBar/
        index.tsx                           → wiki/plugins/search-plugin/src/theme/SearchBar/index.tsx
        styles.module.css                   → wiki/plugins/search-plugin/src/theme/SearchBar/styles.module.css
      SearchModal/
        index.tsx                           → wiki/plugins/search-plugin/src/theme/SearchModal/index.tsx
        styles.module.css                   → wiki/plugins/search-plugin/src/theme/SearchModal/styles.module.css
```

## Install Steps

1. **Copy the entire plugin folder** to `wiki/plugins/search-plugin/`.

2. **Install runtime dependencies** (the plugin is private and pulls these from the host repo):

   ```bash
   npm install --save minisearch glob gray-matter remark remark-stringify strip-markdown
   ```

   Versions used at extraction time: `minisearch@^7`, `glob@^10`, `gray-matter@^4`, `remark@^15`, `strip-markdown@^6`. Use the latest compatible majors.

3. **Register the plugin** in `docusaurus.config.ts`:

   ```ts
   plugins: [
     require.resolve('./plugins/search-plugin/src/index.ts'),
     // ...
   ],
   ```

   The plugin's `getThemePath()` automatically overrides `@theme/SearchBar`, so the classic theme picks up the navbar trigger without any `themeConfig` change.

4. **Add to `.gitignore`:**

   ```
   /static/search-index.json
   ```

   The index is regenerated on every build. Keeping it out of git avoids merge conflicts and stale state.

5. **Build.**

   ```bash
   npm run build
   ```

   You should see something like:

   ```
   [search-plugin] Indexed 192 entries → static/search-index.json
   ```

   If the count doesn't match your doc count, check that your `.md` files are under `docs/` and have valid frontmatter.

6. **Verify in dev.**

   ```bash
   npm start
   ```

   Click the navbar search button (or hit `Cmd+K` / `/`). Type a query. Results should appear with snippet highlighting. Press `↑/↓` to navigate, `Enter` to open, `Esc` to close.

## Customization

- **Indexed fields.** `build-index.ts` controls what gets into the JSON. Adjust `SearchEntry` interface and `buildEntry()` if you want to index additional frontmatter fields (e.g., `tags`, `section`).
- **Search behavior.** `engine.ts` exposes `buildEngine`, `searchEngine`, and `buildSnippet`. The MiniSearch options (boost weights, fuzzy matching, prefix matching) are configured in `buildEngine`. Tune to taste.
- **UI styling.** `SearchBar/styles.module.css` and `SearchModal/styles.module.css` carry all CSS. The shipped version uses CSS variables (`--ifm-color-content`, etc.) from Docusaurus + custom variables (`--color-paper`, `--color-ink`). Replace with your color tokens.
- **Keyboard shortcuts.** Hardcoded to `Cmd+K`, `Ctrl+K`, and `/` in `SearchBar/index.tsx`. Adjust the `useEffect` listener.
- **Snippet length.** `buildSnippet()` in `engine.ts` defaults to ~140 chars around the first match. Bump for longer previews.

## Gotchas

- **MiniSearch `extractField` callback runs for every indexed field including the `idField`.** If you coerce non-string values to `''` in `extractField`, every numeric `id` becomes `""` and `addAll` throws `duplicate ID` after the first row. The shipped `engine.ts` passes IDs through verbatim and only stringifies arrays (e.g., `headings`). Do not "tidy this up" without understanding why.
- **Stacking context.** The modal uses `createPortal` to escape the navbar's `z-index: 9000` stacking context. Without the portal, results render *behind* the page content. Do not refactor this away.
- **MDX parsing.** `strip-markdown` handles standard Markdown but doesn't fully understand MDX components. If your docs have lots of inline JSX, the index will include literal JSX strings (or strip them, depending on the remark plugin chain). For most wikis this is fine; for component-heavy MDX, extend the strip pipeline.
- **Client-side index size.** A 200-entry wiki produces a ~150KB JSON. The index is fetched on first search, not on initial page load. Acceptable for sub-1000-entry wikis. Above that, consider partitioning the index by section.
- **Missing slug → wrong URL.** The build-time indexer uses frontmatter `slug` if present, otherwise falls back to file path. Ensure every doc has an explicit `slug:` to keep search links stable across reorganizations.
- **No anchor support.** The search results link to the page, not to specific headings. Adding heading anchors is a future enhancement.

## Testing

The shipped plugin includes (in the source repo) a Vitest suite that verifies:
- Index generation from frontmatter (`build-index.test.ts`)
- Runtime search against synthetic fixtures and the real built index (`engine.test.ts`)

When extracting, decide whether to copy the tests over. They cover the load-bearing logic (the `extractField` bug above was caught this way) but require Vitest setup in the host repo.

## Alternatives

- **Algolia DocSearch.** Production-grade, free for OSS docs. Wrong for private/gated wikis (the index lives on Algolia's servers; the gated content would be exposed there).
- **`@easyops-cn/docusaurus-search-local`.** Off-the-shelf local search plugin. Right if the customization needs are low. The shipped recipe in this repo is more opinionated about UI, snippet formatting, and the bundler boundary between build-time and runtime.
- **Pagefind.** Static-site search via WASM. Good but adds a separate build step and asset pipeline. Worth considering for very large wikis where MiniSearch's index size becomes a bottleneck.

The recipe in this folder is right when:
- the wiki is gated and you don't want the index on a third-party server,
- you want fast, local, no-egress search,
- you want the UI to match a specific brand register,
- the wiki is under ~1000 entries.

## Pairs Well With

- `password-protect-docusaurus-wiki` — search runs entirely client-side after auth, so the index never leaves the gated boundary.
- `wiki-changelog` — both surface the same wiki content, indexed and time-ordered respectively.

## Source

Extracted from `imagos-meta-repo/curia-regis-truth-wiki` as of 2026-05-08. The plugin in that repo includes Vitest tests not copied here; pull them from the source if you want them.
