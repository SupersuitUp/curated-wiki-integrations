<!-- last_updated: 2026-05-17 -->

# bot-block-middleware

Vercel Routing Middleware that returns `403` to known LLM training crawlers and AI-search bots by `User-Agent`. Framework-agnostic. Runs at the platform edge, before the cache, so even compliant crawlers that ignore `robots.txt` get hard-stopped.

## What It Does

- Inspects the `User-Agent` header on every HTML request.
- Matches against a regex of known training and AI-search bot identifiers.
- Returns `403 Forbidden` with a plain-text reason for matched bots.
- Lets every other request continue to the static site.
- Skips static assets (images, fonts, CSS, JS) so you don't pay function invocations on every fetch.

## Why It Matters

`robots.txt` is a polite request. Many crawlers honor it; some don't. Ones that don't (or that change their UA mid-rollout) ignore the directive entirely. Routing Middleware runs *before* anything reaches your site — there's no respect-it-or-not. The crawler gets a 403.

This is especially load-bearing for **gated wikis**. A password-gated SPA still serves a public HTML shell to crawlers (the gate runs in JS, after the HTML loads). Without bot-blocking at the edge, training crawlers fetch the shell + the bundled JS + (in some cases) the bundled content, even though casual readers see the gate. The middleware closes that gap.

## Files

```
middleware.ts                → wiki/middleware.ts (project root)
```

That's it. One file, at the project root.

## Install Steps

1. **Copy `middleware.ts`** to the root of your Docusaurus (or any other Vercel-deployed) project.

2. **No config change needed.** Vercel auto-discovers `middleware.ts` at the project root.

3. **Deploy to Vercel.**

   ```bash
   vercel deploy
   ```

   On the next deployment, the middleware runs at the edge.

4. **Verify.**

   ```bash
   curl -sI -A "GPTBot/1.0" https://your-wiki.example.com/ | head -1
   # expect: HTTP/2 403

   curl -sI -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" https://your-wiki.example.com/ | head -1
   # expect: HTTP/2 200
   ```

## What's Blocked

The shipped pattern blocks (case-insensitive):

| Bot | Operator | Purpose |
|-----|----------|---------|
| `GPTBot` | OpenAI | Training |
| `OAI-SearchBot` | OpenAI | AI search |
| `ChatGPT-User` | OpenAI | On-demand fetches inside ChatGPT |
| `ClaudeBot`, `Claude-Web`, `anthropic-ai` | Anthropic | Training and on-demand fetches |
| `CCBot` | Common Crawl | Public training data archive |
| `Google-Extended`, `GoogleOther` | Google | Bard/Gemini training (separate from regular Googlebot) |
| `Applebot-Extended` | Apple | Apple Intelligence training |
| `FacebookBot`, `Meta-ExternalAgent` | Meta | Llama training |
| `Bytespider` | ByteDance | Training |
| `PerplexityBot`, `Perplexity-User` | Perplexity | AI search and on-demand fetches |
| `Amazonbot` | Amazon | Alexa / training |
| `AI2Bot` | Allen Institute | Research training |
| `cohere-ai` | Cohere | Training |
| `Diffbot`, `Omgili` | Diffbot, etc. | AI-augmented scraping |
| `ImagesiftBot`, `YouBot`, `DuckAssistBot` | Various | AI-search/training |
| `peer39_crawler`, `TimpiBot`, `Webzio-Extended`, `Kangaroo`, `Cotoyogi` | Various | AI training and dataset aggregation |

What's **not** blocked (intentional):
- Regular Googlebot, Bingbot, etc. (use `robots.txt` `Disallow: /` to keep them out instead).
- `Twitterbot`, `facebookexternalhit`, `Slackbot-LinkExpanding` — link previews you usually want.

## Customization

- **Add new bots.** Append to the `BLOCKED_BOT_PATTERN` regex as new training UAs emerge. Some shops keep a separate file with the canonical list and grep it into the middleware on build.
- **Allow specific bots.** If you want to allow, e.g., `ChatGPT-User` (so visitors using ChatGPT can ask questions about your wiki content), drop it from the regex.
- **Custom 403 body.** The shipped reason is a one-line plain-text. Replace with whatever message fits your tone.
- **Logging.** Add a `console.log(ua)` before the return to track who's hitting you. The logs surface in the Vercel dashboard under "Logs" for the middleware function.

## Gotchas

- **Updates to UA strings.** Crawler UAs change over time. New bots emerge constantly. Audit the list quarterly. The list shipped here is current as of 2026-05.
- **Don't over-block.** Blocking real users (e.g., regex too broad, accidentally matches `Mozilla`) breaks the site. Test before pushing. The shipped pattern uses `\b` word boundaries to limit false matches.
- **`runtime: 'edge'` is required.** Routing Middleware uses the V8 isolate runtime (formerly known as Edge runtime), not Node.js. The shipped file declares `runtime: 'edge'` explicitly.
- **Static asset matcher.** The shipped `matcher` regex skips `.js`, `.css`, common image formats, fonts, and `.json`. If your site serves other extensions you want to block (or include), update the matcher. Skipping static assets reduces invocation cost ~10x in our experience.
- **`robots.txt` still belongs alongside this.** Belt-and-suspenders. The middleware catches non-compliant bots; `robots.txt` catches the compliant ones (cheaper, no function invocations).
- **Doesn't stop authenticated AI scraping.** A determined operator can scrape with a regular browser UA and bypass this entirely. The middleware is one layer in defense-in-depth, not a complete solution. Right thinking: this is the platform-level bot block. Combine with `robots.txt`, password gating (for content), and rate limiting (for abuse) as appropriate.

## Pairs Well With

- `password-protect-docusaurus-wiki` — bot block + content gate together: bots get 403, casual visitors hit the gate, share-link recipients auto-unlock.
- A `Disallow: /` `robots.txt` (you supply this separately; it's not a Docusaurus concept). Belt-and-suspenders.

## Alternatives

- **`robots.txt` only.** Cheap, polite, ineffective against non-compliant bots. Use as the first layer, not the only one.
- **Cloudflare Bot Management.** Production-grade, behavioral, costs money. Right for high-traffic sites or sites with serious adversarial scraping problems.
- **WAF rules at your CDN.** Equivalent functionality at a different layer. The shipped recipe uses Vercel's middleware because the wiki already deploys to Vercel; for non-Vercel hosts, port the logic to Cloudflare Workers, Netlify Edge Functions, or AWS CloudFront Functions.

## Source

Extracted from `imagos-meta-repo/curia-regis-truth-wiki` as of 2026-05-08. The same pattern (with a slightly older bot list) lives in `faithwalk-os/wiki/middleware.ts`. Trust the curia-regis version forward.
