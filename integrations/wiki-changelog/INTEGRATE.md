# wiki-changelog

A git-derived "what was added when" log for Docusaurus 3 wikis. Two surfaces:

- **`<RecentlyAdded />`**: a compact widget that shows the N most-recently-modified entries, ideal for the wiki home page.
- **`<Changelog />`**: a full monthly-grouped log of every entry, ideal for a dedicated `/changelog` page.

Both are powered by a custom Docusaurus plugin that walks `docs/`, runs `git log --follow` per file to extract first-commit and last-commit dates (so renames don't reset the date), and exposes everything as plugin global data.

## What It Does

- At build time, the plugin scans every `.md` and `.mdx` file under `docs/`.
- For each file, it runs:
  - `git log --follow --diff-filter=A --format=%aI -- <file> | tail -1` → first-commit date (creation)
  - `git log --follow -1 --format=%aI -- <file>` → most recent commit date (modification)
- It parses the file's frontmatter to extract `title`, `description`, and `slug` (so links go to the canonical URL, not the file path).
- It excludes `index` and `intro` files from the listing (they're navigational, not content).
- It exposes the full list to React via `useGlobalData()` under the key `creation-date-plugin`.
- The two components consume the same data: `RecentlyAdded` slices and renders the top N; `Changelog` groups by month and renders all of it.

## Why Git-Derived (Not Frontmatter)

Earlier versions of this pattern (FaithWalk OS) required `creation_date:` in every doc's frontmatter and ignored files without it. That meant:
- Backfilling 50+ files when retrofitting an existing wiki.
- Drift when authors forgot to add the field.
- Renames silently breaking the date.

This version skips the manual field and reads directly from git. Renames are followed via `--follow`. Newly-created files appear automatically on next build. No frontmatter migration required.

## Files

```
plugin/
  package.json           → wiki/plugins/creation-date-plugin/package.json
  src/index.ts           → wiki/plugins/creation-date-plugin/src/index.ts
components/
  RecentlyAdded.tsx      → wiki/src/components/RecentlyAdded.tsx
  Changelog.tsx          → wiki/src/components/Changelog.tsx
docs/
  changelog.mdx          → wiki/docs/changelog.mdx
```

## Install Steps

1. **Copy the plugin folder** to `wiki/plugins/creation-date-plugin/`.

2. **Register the plugin** in `docusaurus.config.ts`:

   ```ts
   plugins: [
     // ...
     require.resolve('./plugins/creation-date-plugin/src/index.ts'),
   ],
   ```

3. **Copy both components** to `wiki/src/components/`.

4. **Adjust `SECTION_LABELS`** in both `RecentlyAdded.tsx` and `Changelog.tsx`. The shipped version assumes Curia Regis sections (`concepts`, `guides`, `case-studies`). Replace with your wiki's top-level folders (e.g., `perspectives`, `principles`, `patterns`).

5. **Use the components.**

   In your home page (e.g., `docs/index.mdx`):

   ```mdx
   import RecentlyAdded from '@site/src/components/RecentlyAdded';

   ## Recently Added
   <RecentlyAdded limit={8} />
   ```

   In a dedicated changelog page (`docs/changelog.mdx`, which this recipe ships):

   ```mdx
   import Changelog from '@site/src/components/Changelog';

   <Changelog />
   ```

6. **Register the changelog page** in `sidebars.ts`:

   ```ts
   wiki: [
     'index',
     'changelog',
     // ...
   ],
   ```

7. **Build.**

   ```bash
   npm run build
   ```

   The plugin runs git commands during build, so the build host needs git installed and a clean repo with history. Vercel build images include git, so this works out of the box on Vercel.

## Customization

- **Sort by created vs. updated.** `Changelog` accepts a `sortBy="created" | "updated"` prop (default `"created"`). `RecentlyAdded` always sorts by `lastModifiedDate` (most recent activity first).
- **`RecentlyAdded` props.** `limit` (default `7`) and `showSectionLabels` (default `true`).
- **Excluding files.** Add to the `EXCLUDED_LEAF_KEYS` set in `plugin/src/index.ts` (e.g., `['index', 'intro', 'changelog']` if you want the changelog itself excluded from its own list).
- **Custom date formatting.** The components currently use `toLocaleDateString` for month headings and `toISOString().slice(0, 10)` for daily dates. Replace with your preferred format.
- **Section grouping.** `Changelog` groups by month. To group by section instead, change the `groups` key construction in `Changelog.tsx`.

## Vercel: unshallow the clone before build

Vercel's default git clone is shallow (`--depth=1`). With a shallow clone, `git log --diff-filter=A` returns the deploy commit as the "added" date for every file, so every entry in the changelog shows the deploy date instead of the real creation date. The fix is one line in `vercel.json`:

```json
{
  "buildCommand": "git fetch --unshallow 2>/dev/null || true; npm run build",
  "outputDirectory": "build",
  "framework": "docusaurus-2"
}
```

`git fetch --unshallow` pulls the full history when the clone is shallow; the `2>/dev/null || true` swallows the error when the clone is already full (so the same config works locally and on Vercel). Without this, the plugin still runs cleanly but every changelog entry shows the same date.

## Gotchas

- **Vercel shallow clone (resolved by the unshallow step above).** If you skip the `git fetch --unshallow` in the build command, every entry shows the deploy date. The plugin has no way to detect or warn about a shallow clone — the symptom only shows up after deploy.
- **Squashed merges reset creation date.** If your repo squashes branches on merge, the original commit history is lost and the file's "creation date" becomes the merge date. Pre-merge dates are unrecoverable. Either don't squash, or accept the slight inaccuracy.
- **Renames not always followed.** `git log --follow` is a best-effort heuristic. Massive renames or splits can confuse it. The fallback in this plugin uses `lastModifiedDate` if `creationDate` isn't found, which handles most edge cases.
- **Build performance.** Each file runs two `git log` calls. On a 200-file wiki that's 400 git invocations per build. On Vercel this adds ~5–15 seconds. Acceptable for now; replace with `git log --all --name-status` parsing if it becomes a bottleneck.
- **Empty repo on first build.** If the wiki has never been committed, `git log` returns nothing and every file is excluded. First commit before first build.
- **Local dev incremental builds.** The plugin's `loadContent` runs on every restart but Docusaurus caches it across HMR cycles within a single dev session. To see updated dates without restarting, edit a file and let Docusaurus rebuild.
- **`useGlobalData()` typing.** The component casts the global data to a typed shape. If you change the plugin's output shape, update both consumers.

## Alternatives

- **Frontmatter `creation_date`.** Simpler, no git dependency, but requires manual maintenance. Right for wikis where authors are disciplined about adding the field, or where you want to backdate entries (e.g., importing from another system).
- **`docusaurus-plugin-content-blog`'s built-in date sorting.** Right if your wiki is structured as a blog. Wrong if it's a flat lexicon (concepts) or a tree (guides).
- **External CMS-driven changelog.** Right at scale where editorial workflow involves multiple contributors and reviews. Heavier for solo or small-team wikis.

## Pairs Well With

- Any other recipe in this repo. The changelog respects the password gate from `password-protect-docusaurus-wiki` automatically (the gate wraps everything).
- `wiki-search` — recently-added entries become searchable as soon as they're committed.

## Source

Extracted from `imagos-meta-repo/curia-regis-truth-wiki` as of 2026-05-08. The plugin and components are the canonical version. The shipped `changelog.mdx` is verbatim — copy in, replace the title/copy as needed.
