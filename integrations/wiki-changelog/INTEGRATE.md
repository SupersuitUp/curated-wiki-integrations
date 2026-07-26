# wiki-changelog

A git-derived "what was added when" log for Docusaurus 3 wikis. Two surfaces:

- **`<ChangelogWidget />`**: the Changelog widget — a compact widget that shows the N most-recently-modified entries, ideal for the wiki home page.
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
- The two components consume the same data: `ChangelogWidget` slices and renders the top N; `Changelog` groups by month and renders all of it.

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
  src/collect.ts         → wiki/plugins/creation-date-plugin/src/collect.ts
components/
  ChangelogWidget.tsx    → wiki/src/components/ChangelogWidget.tsx
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

4. **Adjust `SECTION_LABELS`** in both `ChangelogWidget.tsx` and `Changelog.tsx`. The shipped version assumes Curia Regis sections (`concepts`, `guides`, `case-studies`). Replace with your wiki's top-level folders (e.g., `perspectives`, `principles`, `patterns`).

5. **Use the components.**

   In your home page (e.g., `docs/index.mdx`):

   ```mdx
   import ChangelogWidget from '@site/src/components/ChangelogWidget';

   ## Changelog
   <ChangelogWidget limit={8} />
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

## New / Updated badges

Each row in both `ChangelogWidget` and `Changelog` is prefixed with a small pill badge: **New** (green) when the file's first git commit and most recent commit are the same (i.e., it has not been edited since creation), or **Updated** (blue) when the dates diverge.

`Changelog` honors its `sortBy` prop when assigning the badge:
- `sortBy="created"` (default): every row is anchored to the creation event, so the badge is always **New**.
- `sortBy="updated"`: rows surface because of edit activity, so the badge is **New** only when the file has never been edited; otherwise **Updated**.

The badge styles are inlined in each component as `NEW_BADGE_STYLE` and `UPDATED_BADGE_STYLE`. Override them by editing the constants. They render correctly on both light and dark Docusaurus themes because they use rgba backgrounds with explicit text colors.

## Customization

- **Sort by created vs. updated.** `Changelog` accepts a `sortBy="created" | "updated"` prop (default `"created"`). `ChangelogWidget` always sorts by `lastModifiedDate` (most recent activity first).
- **`ChangelogWidget` props.** `limit` (default `7`) and `showSectionLabels` (default `true`).
- **Excluding files.** Add to the `EXCLUDED_LEAF_KEYS` set in `plugin/src/index.ts` (e.g., `['index', 'intro', 'changelog']` if you want the changelog itself excluded from its own list).
- **Custom date formatting.** Rows and month headings both read the leading `YYYY-MM-DD` of the commit's ISO date, which carries the committer's own offset. Do not convert to UTC first: that pushes an evening commit onto the next day, and sometimes into the next month.
- **Section grouping.** `Changelog` groups by month. To group by section instead, change the `groups` key construction in `Changelog.tsx`.

## Vercel: commit the history snapshot

**Do not put `git fetch --unshallow` in the build command.** Earlier versions of
this recipe said to, and it does not work. Vercel's build container clones the
repo shallow AND strips the git remote, so inside a build `git remote -v` is
empty, any fetch dies with `fatal: 'origin' does not appear to be a git
repository`, and `git fetch --unshallow` exits 0 having done nothing at all.
(Verified on way-of-fire-wiki, 2026-07-26: `shallow=true commits=10` before and
after the fetch.) No build command can recover history the container was never
given.

So history rides along in the repo instead. The plugin keeps a snapshot at
`src/data/changelog-events.json`:

- On a **full clone** (your laptop) a build rewrites the snapshot from git.
- On a **shallow clone** (Vercel) the plugin leaves the snapshot alone and
  merges it with whatever recent history the clone does carry, live git winning
  on collision so titles track the working tree.

**Run a local build and commit the JSON when it changes**, the same discipline
as any other generated-and-committed artifact. Skip it and production quietly
shows only the last couple of weeks while your laptop shows everything, which is
exactly the failure this recipe used to ship with.

`vercel.json` needs nothing special:

```json
{
  "outputDirectory": "build",
  "framework": "docusaurus-2"
}
```

## Gotchas

- **A stale snapshot silently truncates production.** The symptom only shows up after deploy: your laptop renders the full log, the deployed site starts at whenever Vercel's clone window begins. Run a local build and commit `src/data/changelog-events.json`.
- **Docusaurus root in a subdirectory.** `git log --name-status` prints paths relative to the REPO root, not the directory it ran in, so a site living in e.g. `wiki/` sees `wiki/docs/...` and matches nothing. The collector strips the site's own prefix via `git rev-parse --show-prefix`; that is a no-op when the site IS the repo root.
- **The shallow clone's boundary commit lies.** Git presents the commit where a shallow clone is cut off as a root commit, so every file that merely EXISTED at that point reports as freshly added. Left alone that invents a "New" event for most of the wiki, dated whenever the clone window happens to start (56 of them on the wiki this was found on). The collector drops events from the commits listed in `.git/shallow`.
- **Squashed merges reset creation date.** If your repo squashes branches on merge, the original commit history is lost and the file's "creation date" becomes the merge date. Pre-merge dates are unrecoverable. Either don't squash, or accept the slight inaccuracy.
- **Renames not always followed.** `git log --follow` is a best-effort heuristic. Massive renames or splits can confuse it. The fallback in this plugin uses `lastModifiedDate` if `creationDate` isn't found, which handles most edge cases.
- **Build performance.** One `git log --name-status` pass over `docs/` covers the whole history, plus a `git show` per doc that no longer exists in the working tree (to recover its title). Negligible on a shallow clone, where there is almost no history to walk.
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
