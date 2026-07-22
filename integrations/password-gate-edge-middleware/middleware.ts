// Vercel Routing Middleware (platform-level, runs before the cache).
//
// A soft password gate on the HTML pages of this wiki. It is a handshake, not
// a security boundary: nothing here is secret, and the machine-readable layer
// is deliberately left wide open.
//
// WHAT STAYS OPEN, ON PURPOSE (see `config.matcher` below):
//   /llms.txt, /llms-full.txt   agents cannot type passwords
//   /tools/*.md                 paste-in files people are told to copy
//   /skills/**, /generators/**  canonical agent files served for fetching
//   /robots.txt, /sitemap.xml   crawl surface
//   /img/**, /assets/**         og share cards, fonts, bundles
//
// Why edge middleware and not the client-side Root.tsx gate recipe: a
// client-side gate inlines the password into the JS bundle that every visitor
// downloads. Here the password never leaves the edge. What the browser gets is
// an HMAC-signed, expiring cookie that proves nothing except "this browser
// answered correctly at time T".

const COOKIE_NAME = 'boa_gate';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const COOKIE_VERSION = 'v1';

// Link-preview crawlers pass through so shared links keep unfurling with their
// real per-page og:image card. This is not a hole worth worrying about: every
// word on this wiki is already published at /llms-full.txt.
const UNFURL_BOT_PATTERN =
  /\b(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Slack-ImgProxy|Discordbot|WhatsApp|TelegramBot|Applebot|redditbot|Pinterest|SkypeUriPreview|Iframely|embedly|Mastodon|Bluesky|Cardyb|vkShare)\b/i;

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

async function hasValidTicket(request: Request, secret: string): Promise<boolean> {
  const raw = readCookie(request, COOKIE_NAME);
  if (!raw) return false;
  const [version, expires, signature] = raw.split('.');
  if (version !== COOKIE_VERSION || !expires || !signature) return false;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() / 1000) return false;
  const expected = await sign(`${version}.${expires}`, secret);
  return constantTimeEqual(signature, expected);
}

async function issueTicket(secret: string): Promise<string> {
  const expires = String(Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS);
  const payload = `${COOKIE_VERSION}.${expires}`;
  return `${payload}.${await sign(payload, secret)}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function gatePage(siteUrl: string, wrongAnswer: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Build on Anthropic</title>
<meta name="description" content="A complete, dated, linked reference for building on Anthropic: every customer case study, engineering pattern, and platform capability, organized for founders shipping on the Claude Developer Platform." />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Build on Anthropic" />
<meta property="og:title" content="Build on Anthropic" />
<meta property="og:description" content="Everything you need to build on the Claude Developer Platform." />
<meta property="og:url" content="${siteUrl}/" />
<meta property="og:image" content="${siteUrl}/img/og/home.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${siteUrl}/img/og/home.png" />
<link rel="icon" href="/img/favicon.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/img/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" />
<style>
  :root {
    --clay: #cc785c;
    --ivory: #f7f4ed;
    --paper: #fdfbf6;
    --ink: #1a1a17;
    --slate: #3b382f;
    --muted: #6b6862;
    --line: #e6dfd1;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--ivory);
    color: var(--ink);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  main {
    width: 100%;
    max-width: 34rem;
  }
  .rule {
    width: 3rem;
    height: 3px;
    background: var(--clay);
    border-radius: 2px;
    margin-bottom: 1.75rem;
  }
  .eyebrow {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--clay);
    margin: 0 0 0.9rem;
  }
  h1 {
    font-family: 'Source Serif 4', 'Iowan Old Style', Georgia, serif;
    font-size: clamp(1.9rem, 6vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 1.1rem;
    color: #0a0a0a;
  }
  p { margin: 0 0 1.2rem; color: var(--slate); }
  .hint {
    background: var(--paper);
    border: 1px solid var(--line);
    border-left: 3px solid var(--clay);
    border-radius: 4px;
    padding: 0.9rem 1.1rem;
    margin: 0 0 1.6rem;
    font-size: 0.95rem;
    color: var(--slate);
  }
  .hint strong {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--clay);
    display: block;
    margin-bottom: 0.35rem;
    font-weight: 500;
  }
  form { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0 0 1rem; }
  input[type="password"] {
    flex: 1 1 16rem;
    min-width: 0;
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 1rem;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.8rem 0.95rem;
  }
  input[type="password"]::placeholder { color: #a8a29a; }
  input[type="password"]:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--clay);
    outline-offset: 2px;
    border-color: var(--clay);
  }
  button {
    flex: 0 0 auto;
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    color: var(--paper);
    background: var(--clay);
    border: 1px solid var(--clay);
    border-radius: 4px;
    padding: 0.8rem 1.6rem;
    cursor: pointer;
  }
  button:hover { background: #b8654a; border-color: #b8654a; }
  .error {
    color: #a3543c;
    font-size: 0.95rem;
    margin: 0 0 1rem;
  }
  footer {
    margin-top: 2.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--line);
    font-size: 0.88rem;
    color: var(--muted);
  }
  footer a { color: var(--clay); text-decoration: none; border-bottom: 1px solid rgba(204, 120, 92, 0.35); }
  footer a:hover { border-bottom-color: var(--clay); }
  @media (max-width: 420px) {
    form { flex-direction: column; }
    button { width: 100%; }
  }
</style>
</head>
<body>
<main>
  <div class="rule"></div>
  <p class="eyebrow">Build on Anthropic</p>
  <h1>Two words you already say out loud.</h1>
  <p>Nothing behind this door is secret. Every page is public knowledge about a public platform. The password is a handshake, so the room stays full of people who are actually shipping.</p>
  <div class="hint">
    <strong>Hint</strong>
    PG's phrase, hyphenated and lowercase. It is the state you want to be in when the runway runs out, and the first thing your partner asks about at office hours.
  </div>
  ${wrongAnswer ? '<p class="error">Not it. Ask literally anyone in your batch.</p>' : ''}
  <form method="POST">
    <input
      type="password"
      name="password"
      placeholder="you know this one"
      autocomplete="current-password"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      aria-label="Password"
      autofocus
    />
    <button type="submit">Come in</button>
  </form>
  <footer>
    Building an agent instead? It does not need a password. Point it at
    <a href="/llms.txt">/llms.txt</a> or <a href="/llms-full.txt">/llms-full.txt</a>.
  </footer>
</main>
</body>
</html>`;
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const password = process.env.WIKI_PASSWORD ?? '';

  // No password configured (local dev, a preview deploy without the env var):
  // the gate is off rather than black-holing the site.
  if (!password) return undefined;

  const secret = process.env.WIKI_GATE_SECRET || `${password}:boa-gate-hmac`;
  const url = new URL(request.url);
  const siteUrl = `${url.protocol}//${url.host}`;

  // Answering the gate.
  if (request.method === 'POST') {
    const body = await request.text();
    const submitted = new URLSearchParams(body).get('password') ?? '';
    if (normalize(submitted) !== normalize(password)) {
      return new Response(gatePage(siteUrl, true), {
        status: 401,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex',
        },
      });
    }
    return new Response(null, {
      status: 303,
      headers: {
        location: url.pathname + url.search,
        'set-cookie': `${COOKIE_NAME}=${await issueTicket(secret)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure; HttpOnly`,
        'cache-control': 'no-store',
      },
    });
  }

  if (UNFURL_BOT_PATTERN.test(request.headers.get('user-agent') ?? '')) return undefined;

  if (await hasValidTicket(request, secret)) return undefined;

  return new Response(gatePage(siteUrl, false), {
    status: 401,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

export const config = {
  // HTML routes only. Everything with a file extension is skipped, which is
  // what keeps /llms.txt, /llms-full.txt, /robots.txt, /sitemap.xml,
  // /search-index.json, /tools/*.md, /skills/**/SKILL.md and
  // /generators/**/GENERATE.md publicly reachable with no gate. The /img/ and
  // /assets/ prefixes are excluded outright so share cards and bundles never
  // pay a function invocation.
  matcher: [
    '/((?!assets/|img/|.*\\.(?:md|txt|json|xml|js|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|map|pdf)$).*)',
  ],
  runtime: 'edge',
};
