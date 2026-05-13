<!-- last_updated: 2026-05-13 -->

# Generate `llms.txt` and `llms-full.txt`

A drop-in recipe to make any Docusaurus 3 wiki AI-agent-readable via the [`llms.txt` convention](https://llmstxt.org). One bash script runs at prebuild, walks `docs/`, and emits two files into `static/` that Docusaurus serves at the site root: an index of every page (`llms.txt`) and the full concatenated content of every page (`llms-full.txt`).

## What this gives you

After installing this recipe, the wiki ships:

- `https://<your-wiki>/llms.txt` — index of every doc with title, URL, and description. The standard surface an AI agent (or a user pasting a URL into Claude) fetches to discover what is here.
- `https://<your-wiki>/llms-full.txt` — the full text of every doc, frontmatter stripped, concatenated with URL headers. The standard surface for "load the whole wiki into context."

Both files regenerate on every build. No content lives in git; the script reads from `docs/` and emits at build time. The script is fully parameterized via environment variables so a single canonical version works across every wiki.

## Why this recipe

Three reasons over alternative approaches:

1. **No extra dependency.** Pure bash + standard Unix tools (`find`, `sed`, `awk`, `grep`). No npm package to maintain or audit. Works on any machine that builds Docusaurus.
2. **Deterministic output.** Files are walked in sorted order, frontmatter is parsed predictably, headers are templated from env vars. Two consecutive builds produce identical output.
3. **Parameterized once, deployed everywhere.** The script does not know which wiki it is in. Per-wiki configuration lives in three environment variables set inline by the prebuild hook in `package.json`. Same script, different wiki — same shape.

The alternative (a Docusaurus plugin like `docusaurus-plugin-llms`) introduces a runtime dependency, configuration ceremony, and a moving npm surface to maintain. For static text generation at build time, a 60-line bash script is the right size.

## Prerequisites

- Docusaurus 3 site with a standard layout (`docs/` for content, `static/` for ship-as-is assets)
- A POSIX shell environment at build time (Vercel build images, GitHub Actions, local Mac/Linux all qualify)
- An `npm run build` flow you can hook a prebuild step into

## Setup

### Step 1: Copy the script

Place `generate-llms-txt.sh` at `scripts/generate-llms-txt.sh` in your wiki repo:

```bash
mkdir -p scripts
cp <path-to-this-recipe>/scripts/generate-llms-txt.sh scripts/generate-llms-txt.sh
chmod +x scripts/generate-llms-txt.sh
```

### Step 2: Wire the prebuild hook in `package.json`

Add or modify the `prebuild` script in `package.json`. Set the three required environment variables inline so the script knows what to write into the headers and how to build URLs.

```json
{
  "scripts": {
    "prebuild": "WIKI_TITLE='supersuit.wiki' WIKI_DESCRIPTION='Canonical reference for getting Jarvised: the personal agentic surface in two forms.' BASE_URL='https://supersuit.wiki' bash scripts/generate-llms-txt.sh",
    "build": "docusaurus build"
  }
}
```

Tune `WIKI_TITLE`, `WIKI_DESCRIPTION`, and `BASE_URL` per wiki. Docusaurus runs `prebuild` automatically before `build`.

### Step 3: Gitignore the generated files

The script writes into `static/`. Those files should regenerate on every build and never be committed.

Append to `.gitignore`:

```
static/llms.txt
static/llms-full.txt
```

### Step 4: Verify

Run a fresh build:

```bash
npm run build
```

Then inspect:

```bash
cat static/llms.txt | head -20
wc -l static/llms-full.txt
```

You should see your wiki title in the header, the first dozen doc entries in the index, and a substantial line count in the full file.

### Step 5: Verify on deploy

After the next deploy:

```bash
curl https://<your-wiki>/llms.txt | head
curl https://<your-wiki>/llms-full.txt | head
```

If both return content, you are done.

## Usage from your Jarvis

Once the files are live, an operator can point their Jarvis (Claude Code, Hermes, Codex, any harness) at the wiki by pasting the `llms.txt` URL or by asking the harness to fetch it. The agent reads the index, decides which pages are relevant, and fetches the corresponding doc URLs (or pulls everything from `llms-full.txt` if context budget allows).

The pattern works the same for end-users pasting `https://supersuit.wiki/llms.txt` into a chat — the model reads the index and can answer questions grounded in the wiki content.

## Common gotchas

- **Frontmatter parsing is line-based.** The script grabs the first `title:` line and the first `description:` line via `grep -m1`. Multi-line YAML values or unusual escaping will trip it. Keep frontmatter conventional.
- **The script honors only `.md` and `.mdx`.** Other formats are ignored.
- **`/index.md` files become directory URLs.** A file at `docs/start-here/index.md` becomes `https://<wiki>/start-here/` (with trailing-slash semantics handled by Docusaurus).
- **Pages without a title are skipped.** If a file has neither a `title:` frontmatter nor an `# H1`, it does not appear in the output. Usually this is correct behavior.
- **The Vercel bot-block middleware (if installed) will 403 known LLM-training UAs at the edge.** That means a bot fetching `/llms.txt` via the standard GPTBot or ClaudeBot user agent gets blocked. Two implications:
  1. Humans pasting the URL into a chat are not affected (they fetch via the browser UA).
  2. An operator running their Jarvis to ingest the wiki will reach `/llms.txt` only if their harness's UA is not in the deny-list. Claude Code, Hermes, Codex local harnesses generally fetch via the user's UA and pass through; remote crawlers do not.

  If you want llms.txt to be open to all bots, narrow the middleware deny-list or carve an exception for `/llms.txt` and `/llms-full.txt` paths.

## Last Verified

- OS: macOS 15 (Sequoia)
- Bash: 5.x (Homebrew) and 3.2 (system) both work
- Docusaurus: 3.x
- Date: 2026-05-13

## Alternatives

- **`docusaurus-plugin-llms`** — npm package that does roughly the same thing as a Docusaurus plugin. Adds a runtime dependency. Choose this if you prefer npm-managed config over a bash script.
- **Hand-written `llms.txt`** — a static file you write and commit. Choose this if your wiki is small (say, fewer than 20 pages) and you do not want any build-time generation.
- **No `llms.txt` at all** — choose this if your wiki is private and you do not want AI agents fetching it, OR if your bot-block middleware aggressively blocks all LLM user agents anyway.

## Maintainer

`SupersuitUp/curated-wiki-integrations` — see the bank for related recipes and updates.

---

*This recipe follows the canonical [INTEGRATE.md v0.2 spec, Flavor B](https://github.com/SupersuitUp/curated-personal-agentic-os-integrations).*
