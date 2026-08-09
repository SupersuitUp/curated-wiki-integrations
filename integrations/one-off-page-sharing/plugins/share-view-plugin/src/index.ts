import path from 'path';
import fs from 'fs/promises';
import { glob } from 'glob';
import matter from 'gray-matter';
import type { LoadContext, Plugin } from '@docusaurus/types';

// ---------------------------------------------------------------------------
// Emits a CHROME-LESS mirror of every built page at /share-view/<route>/ for
// single-page sharing. A share recipient should read ONE piece as a dedicated
// page, not the wiki: no navbar, no sidebar, no table of contents, no
// breadcrumbs, no prev/next pagination. The mirror is the same static HTML
// with one <style> injected into <head>, so it needs no JS (share visitors
// have /assets/js gated by design) and cannot drift from the real page.
//
// Consumed by the edge middleware: an anonymous /s/<slug-or-token> request is
// rewritten to /share-view/<target>/ instead of the full page. The mirror is
// as session-gated as everything else; only the middleware's share rewrite
// (or a signed-in session) ever reaches it.
// ---------------------------------------------------------------------------

const SHARE_VIEW_DIR = 'share-view';

const CHROME_HIDING_CSS = [
  'nav.navbar, .theme-doc-sidebar-container, .theme-doc-toc-desktop,',
  '.theme-doc-toc-mobile, .theme-doc-breadcrumbs, .breadcrumbs,',
  '.pagination-nav, footer.footer, .theme-edit-this-page,',
  '.theme-doc-version-badge, .theme-last-updated { display: none !important; }',
  // With the columns hidden, cap and center the reading column. NOTE: there is no
  // <main> element in this theme's markup (the wrapper is div.main-wrapper), so
  // selectors scoped under `main` silently match nothing; scope to real classes.
  "[class*='docItemCol'] { max-width: 100% !important; flex: 0 0 100% !important; }",
  // The desktop TOC is hidden above, but it lives INSIDE a col--3 wrapper that still
  // occupies the right quarter of the row; drop the wrapper and center what remains.
  '.main-wrapper .row > .col.col--3 { display: none !important; }',
  '.main-wrapper .row { justify-content: center; }',
  // The doc main container reserves the (hidden) sidebar's width via
  // max-width: calc(100% - var(--doc-sidebar-width)), which off-centers everything.
  "[class*='docMainContainer'] { max-width: 100% !important; }",
  '.main-wrapper .container { max-width: 860px !important; padding-top: 2rem !important; }',
  '.share-view-subtitle { font-size: 1.1rem; color: var(--ifm-color-emphasis-700); margin: 0.5rem 0 0; font-style: italic; font-weight: 700; }',
  '.share-view-cover { width: 100%; height: auto; border-radius: 8px; margin: 0.75rem 0 1.75rem; display: block; }',
  // Bottom space is PADDING, not margin: the margin of the last element before </body>
  // collapses out of the body, so the text sat on the page edge (Gary, live).
  '.share-view-footer { max-width: 480px; margin: 5rem auto 0; padding: 2rem 1rem 7rem; border-top: 1px solid var(--ifm-color-emphasis-300); text-align: center; font-size: 0.85rem; color: var(--ifm-color-emphasis-600); font-style: italic; }',
  '.share-view-footer a { color: var(--ifm-color-emphasis-700); text-decoration: underline; }',
].join('\n');

const STYLE_TAG = `<style data-share-view>${CHROME_HIDING_CSS}</style>`;

interface DocMeta { subtitle?: string; image?: string; imageAlt?: string }

// The subtitle line and the cover engraving are normally injected by client JS
// (src/theme/DocItem/Content), which never runs for share visitors: their
// /assets/js is gated. So the mirror bakes both into the HTML at build time.
async function loadDocMeta(siteDir: string): Promise<Map<string, DocMeta>> {
  const docsDir = path.join(siteDir, 'docs');
  const files = await glob('**/*.{md,mdx}', { cwd: docsDir, nodir: true });
  const map = new Map<string, DocMeta>();
  for (const rel of files) {
    const raw = await fs.readFile(path.join(docsDir, rel), 'utf8');
    const fm = matter(raw).data as Record<string, unknown>;
    const slug = typeof fm.slug === 'string' ? fm.slug : undefined;
    const noExt = rel.replace(/\.(md|mdx)$/, '');
    let permalink: string;
    if (slug) permalink = slug === '/' ? '/' : slug.replace(/\/$/, '');
    else if (noExt.endsWith('/index')) permalink = `/${noExt.slice(0, -'/index'.length)}`;
    else if (noExt === 'index') permalink = '/';
    else permalink = `/${noExt}`;
    map.set(permalink, {
      subtitle: typeof fm.subtitle === 'string' ? fm.subtitle : undefined,
      image: typeof fm.image === 'string' ? fm.image : undefined,
      imageAlt: typeof fm.image_alt === 'string' ? fm.image_alt : undefined,
    });
  }
  return map;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// A shared piece is a self-contained letter, not a door into the wiki. Recipients get
// no cross-links and no related-content trails: the Related line disappears, the
// bracketed "[See: ...]" pointers disappear, and every INTERNAL link is unwrapped to
// plain text so the prose still reads while the navigation is gone (a link would only
// bounce them off the login wall and leak the titles of gated pieces). External links
// to the public web survive. Exported for tests.
export function stripCrossLinks(html: string): string {
  // The production HTML is MINIFIED: attribute quotes are dropped when the value has
  // no spaces (href=/perspectives/x) and optional closing tags like </p> are omitted.
  // Every pattern below tolerates both the pretty and the minified form.
  let out = html;
  // 1. The trailing "Related: ..." paragraph (its </p> may be omitted).
  out = out.replace(/<p><em>Related:[\s\S]*?<\/em>(<\/p>)?/g, '');
  // 2. Heading anchor permalinks (the # hash-links).
  out = out.replace(/<a[^>]*hash-link[^>]*>[\s\S]*?<\/a>/g, '');
  // 3. Unwrap every internal anchor (site-absolute href, quoted or not) to its inner
  //    text. Anchors do not nest, so non-greedy to the closing tag is sound.
  out = out.replace(/<a\s[^>]*href=(?:"\/[^"]*"|\/[^\s>]*)[^>]*>([\s\S]*?)<\/a>/g, '$1');
  // 4. Bracketed pointer sentences, now linkless: <em>[See: ...]</em>,
  //    <em>[Full definition: ...]</em> and kin. Only ems that are entirely one
  //    bracketed aside are removed.
  out = out.replace(/\s*<em>\[[^<>]*\]<\/em>/g, '');
  return out;
}

// Every shared piece carries one deliberate door: a footer pointing recipients at the
// public explainer (served through the same share system at /s/what-is-this). Injected
// AFTER stripCrossLinks so it is the only internal link that survives. The explainer
// itself gets no footer, or it would link to itself. Exported for tests.
export function withShareFooter(html: string, route: string): string {
  if (route === '/what-is-this' || !html.includes('</body>')) return html;
  const footer =
    '<footer class="share-view-footer">A piece from FaithWalk OS, shared with you personally. ' +
    '<a href="/s/what-is-this">What is this?</a></footer>';
  return html.replace('</body>', `${footer}</body>`);
}

async function buildShareViews(outDir: string, docMeta: Map<string, DocMeta>): Promise<number> {
  const pages = await glob('**/index.html', {
    cwd: outDir,
    nodir: true,
    ignore: [`${SHARE_VIEW_DIR}/**`, '404.html', 'login/**', 'search/**'],
  });
  let count = 0;
  for (const rel of pages) {
    const html = await fs.readFile(path.join(outDir, rel), 'utf8');
    if (!html.includes('</head>')) continue;
    let out = stripCrossLinks(html.replace('</head>', `${STYLE_TAG}</head>`));
    const route = '/' + rel.replace(/\/index\.html$/, '').replace(/^index\.html$/, '');
    const meta = docMeta.get(route === '/index.html' ? '/' : route);
    if (meta && (meta.subtitle || meta.image)) {
      const subtitleHtml = meta.subtitle
        ? `<div class="share-view-subtitle">${escapeHtml(meta.subtitle)}</div>`
        : '';
      const coverHtml = meta.image
        ? `<img class="share-view-cover" src="${escapeHtml(meta.image)}" alt="${escapeHtml(meta.imageAlt || 'Cover illustration')}" width="1536" height="1024">`
        : '';
      // After the article's H1 only (the first </h1> in <main> territory). The built
      // page has exactly one article H1; the navbar carries none.
      out = out.replace('</h1>', `</h1>${subtitleHtml}${coverHtml}`);
    }
    out = withShareFooter(out, route === '/index.html' ? '/' : route);
    const dest = path.join(outDir, SHARE_VIEW_DIR, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, out);
    count++;
  }
  return count;
}

export default function shareViewPlugin(context: LoadContext): Plugin<void> {
  return {
    name: 'share-view-plugin',
    async postBuild({ outDir }) {
      const docMeta = await loadDocMeta(context.siteDir);
      const count = await buildShareViews(outDir, docMeta);
      console.log(`[share-view] emitted ${count} chrome-less share pages under /${SHARE_VIEW_DIR}/`);
    },
  };
}
