---
name: generate-llms-txt
description: Install the llms.txt + llms-full.txt build-time generator into a Docusaurus 3 wiki. Use when the user wants their wiki to be AI-agent-readable per the llms.txt convention.
---

# Skill: Install `generate-llms-txt` into a Docusaurus wiki

This skill installs the [`llms.txt` build-time generator recipe](../INTEGRATE.md) into a Docusaurus 3 wiki. After installation the wiki's build process emits `static/llms.txt` (index) and `static/llms-full.txt` (full content) on every run.

## When to invoke

The user says any of:

- "add llms.txt to this wiki"
- "make this wiki llms-readable"
- "install the generate-llms-txt recipe"
- "wire up llms.txt and llms-full.txt"

## Inputs

You will need from the user (or infer from the repo):

- **`WIKI_TITLE`** — the human-readable name (e.g. `"supersuit.wiki"`)
- **`WIKI_DESCRIPTION`** — a one-line description for the llms.txt header (e.g. `"Canonical reference for getting Jarvised."`)
- **`BASE_URL`** — the canonical public URL with no trailing slash (e.g. `"https://supersuit.wiki"`)

If the wiki's `docusaurus.config.ts` already has a `title:`, a `tagline:`, or a `url:` field, propose those as defaults and ask the user to confirm or override.

## Procedure

### 1. Copy the script

From the bank's `integrations/generate-llms-txt/scripts/generate-llms-txt.sh`, copy into the wiki at `scripts/generate-llms-txt.sh`. Create the `scripts/` directory if it does not exist.

```bash
mkdir -p scripts
cp <bank-path>/integrations/generate-llms-txt/scripts/generate-llms-txt.sh scripts/generate-llms-txt.sh
chmod +x scripts/generate-llms-txt.sh
```

### 2. Wire `package.json` prebuild

Add (or merge into) the `scripts.prebuild` field in the wiki's `package.json`. Substitute the three input values into the command:

```json
"prebuild": "WIKI_TITLE='<TITLE>' WIKI_DESCRIPTION='<DESCRIPTION>' BASE_URL='<URL>' bash scripts/generate-llms-txt.sh"
```

If a `prebuild` script already exists (e.g., for sidebar checks), chain the existing command with `&&` so both run:

```json
"prebuild": "<existing-prebuild-command> && WIKI_TITLE='<TITLE>' WIKI_DESCRIPTION='<DESCRIPTION>' BASE_URL='<URL>' bash scripts/generate-llms-txt.sh"
```

### 3. Update `.gitignore`

Append to `.gitignore` (if not already present):

```
static/llms.txt
static/llms-full.txt
```

### 4. Verify locally

Run a clean build and inspect the output:

```bash
npm run build
head -20 static/llms.txt
wc -l static/llms-full.txt
```

The header should match `WIKI_TITLE` and `WIKI_DESCRIPTION`. The index should list every doc with `BASE_URL`-prefixed URLs. The full file should be substantial (multiple KB per dozen docs).

### 5. Commit

```bash
git add scripts/generate-llms-txt.sh package.json .gitignore
git commit -m "llms.txt: install generate-llms-txt recipe (build-time emit at /llms.txt and /llms-full.txt)"
```

### 6. Verify on next deploy

After the next deploy, hit the public URLs:

```bash
curl https://<wiki>/llms.txt | head
curl https://<wiki>/llms-full.txt | head
```

Both should return content.

## Gotchas

- **The script generates into `static/`.** Docusaurus serves files from `static/` at the site root, so `static/llms.txt` becomes `https://<wiki>/llms.txt`. Do not put it elsewhere.
- **The Vercel bot-block middleware (if installed) will 403 known LLM-training UAs at the edge.** A bot fetching `/llms.txt` via GPTBot or ClaudeBot will be blocked. Humans fetching via browser UA pass through. If the user wants llms.txt to be open to all bots, narrow the middleware deny-list.
- **Frontmatter parsing is line-based grep.** Multi-line YAML values trip the parser. The wiki should use standard one-line `title:` and `description:` fields.

## Report back to the user

After installation, report:

- Files modified
- The first 5 lines of the generated `static/llms.txt` so they can see the header lands correctly
- The page count from the script's stdout
- The next-step verification commands for after deploy

If the bot-block middleware is installed and would block the standard LLM bot UAs from reaching `/llms.txt`, mention it so the user can decide whether to carve an exception.
