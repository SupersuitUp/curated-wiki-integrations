# curated-wiki-integrations

A private bank of **wiki feature recipes** — drop-in code and instructions for building closed, password-gated, search-enabled, audit-logged knowledge wikis. Today the recipes assume **Docusaurus 3** as the host; some pieces (the bot-block middleware) are framework-agnostic.

This is the repo to look at when you want your wiki to *behave like ours*: cream paper, password gate, share-link auto-unlock, real search, no AI training crawlers in the index, and a changelog page that derives from git history.

## Why This Exists

The wikis we run (FaithWalk OS, Imagos Truth Wiki, Curia Regis Truth Wiki, Ron Truth Wiki) all share the same load-bearing features. Re-deriving them per repo is wasted work and produces drift. This repo holds the canonical version of each pattern, ready to copy into the next wiki without reinventing the auth model, the bot block, the search index, or the changelog generator.

## Repo Shape

```
curated-wiki-integrations/
├── README.md                               # this file
├── LICENSE
└── integrations/
    └── <recipe-name>/                      # one folder per feature recipe
        ├── INTEGRATE.md                    # narrative recipe (what, why, install, gotchas)
        ├── <source files>                  # the actual code to copy in
        └── ...
```

**Naming rule:** folder name describes the feature in kebab-case noun-or-verb form (e.g., `wiki-changelog`, `password-protect-docusaurus-wiki`, `bot-block-middleware`).

**Format of each recipe:**

- `INTEGRATE.md` — what it is, why it exists, what files go where, configuration changes, gotchas, alternatives.
- All source files in subfolders that mirror the destination layout (so copy-paste preserves structure).

## Available Recipes

| Recipe | Folder | Status |
|--------|--------|--------|
| `password-protect-docusaurus-wiki` | [`integrations/password-protect-docusaurus-wiki`](./integrations/password-protect-docusaurus-wiki) | ✅ Ready |
| `wiki-changelog` | [`integrations/wiki-changelog`](./integrations/wiki-changelog) | ✅ Ready |
| `wiki-search` | [`integrations/wiki-search`](./integrations/wiki-search) | ✅ Ready |
| `bot-block-middleware` | [`integrations/bot-block-middleware`](./integrations/bot-block-middleware) | ✅ Ready |

Future recipes (planned, not yet extracted): no-crawl policy (`robots.txt` + matching middleware), share-button-only-for-gated-wikis, navbar-only password reset, custom font stack pinning.

## How To Use A Recipe

1. Open the recipe's `INTEGRATE.md`.
2. Copy the source files into the matching paths in your wiki repo.
3. Apply the configuration changes the recipe lists (usually `docusaurus.config.ts`, `package.json`, sometimes `vercel.json`).
4. Run `npm run build` to verify nothing broke.
5. Customize the parts the recipe flags as customizable (passwords, brand strings, color tokens).

The recipes are opinionated and stylistically coherent (cream paper, austere serif typography, restraint-first). If your wiki has a different visual register, swap the styles inside the components after copying. The behavior is the load-bearing part.

## Source of Truth

These recipes are extracted from `imagos-meta-repo/curia-regis-truth-wiki`, which is the most recently updated of our wikis and has the canonical version of each feature. When a recipe diverges between curia-regis-truth-wiki and another wiki (e.g., faithwalk-os), trust this repo as the canonical version going forward. Backport the canonical version into the older wikis when convenient.

## Why Private

Public-facing wiki tooling reveals the shape of the audit surfaces, search behaviors, and access patterns we use across our gated wikis. We keep this repo private so the implementation details stay inside the trust boundary. Recipes here may reference proprietary brand patterns, internal phrasing, and our specific deployment topology. Treat the repo accordingly.

## License

MIT for the code itself (we may want to share recipes with collaborators or fork-friendly partners). The brand-specific strings, color tokens, and copy that appear inside the recipes are illustrative; replace them with your own when adapting.
