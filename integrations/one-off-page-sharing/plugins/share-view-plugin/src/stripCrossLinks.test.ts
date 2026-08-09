import { describe, it, expect } from 'vitest';
import { stripCrossLinks, withShareFooter } from './index';

describe('share view strips cross-links, because a shared piece is a letter, not a door', () => {
  it('removes the Related paragraph entirely', () => {
    const html = '<p>Body.</p><p><em>Related: <a href="/perspectives/a">A</a> | <a href="/letters/b">B</a></em></p>';
    const out = stripCrossLinks(html);
    expect(out).not.toContain('Related:');
    expect(out).not.toContain('/perspectives/a');
    expect(out).toContain('<p>Body.</p>');
  });

  it('unwraps internal links to plain text so the prose still reads', () => {
    const html = '<p>walk the <a href="/concepts/the-golden-path" class="x">Golden Path</a> daily</p>';
    expect(stripCrossLinks(html)).toBe('<p>walk the Golden Path daily</p>');
  });

  it('keeps external links to the public web', () => {
    const html = '<p>see <a href="https://garysheng.com/voice.md">the spec</a></p>';
    expect(stripCrossLinks(html)).toBe(html);
  });

  it('removes bracketed see-pointers after unwrapping', () => {
    const html = '<p>Receptivity grows. <em>[See: <a href="/perspectives/learn-to-receive">Learn to Receive</a>.]</em></p>';
    expect(stripCrossLinks(html)).toBe('<p>Receptivity grows.</p>');
  });

  it('removes heading hash-link anchors', () => {
    const html = '<h2>Title<a class="hash-link" href="#title">#</a></h2>';
    expect(stripCrossLinks(html)).toBe('<h2>Title</h2>');
  });

  it('leaves ordinary italic text alone', () => {
    const html = '<p><em>her hap was to light on</em> a field</p>';
    expect(stripCrossLinks(html)).toBe(html);
  });

  // The production build MINIFIES: unquoted attribute values and omitted </p>.
  it('handles minified markup: unquoted hrefs and an omitted closing p tag', () => {
    const html = '<div><p><em>Related: <a class="" href=/perspectives/a>A</a> | <a class="" href=/letters/b>B</a></em></div>';
    const out = stripCrossLinks(html);
    expect(out).not.toContain('Related:');
    expect(out).not.toContain('/perspectives/a');
  });

  it('unwraps minified unquoted internal anchors in prose', () => {
    const html = '<p>walk the <a class="" href=/concepts/the-golden-path>Golden Path</a> daily</p>';
    expect(stripCrossLinks(html)).toBe('<p>walk the Golden Path daily</p>');
  });

  it('keeps minified external anchors', () => {
    const html = '<p>see <a href=https://garysheng.com/voice.md>the spec</a></p>';
    expect(stripCrossLinks(html)).toBe(html);
  });
});

describe('the share footer is the one deliberate door', () => {
  it('appends the what-is-this footer before </body>', () => {
    const out = withShareFooter('<body><p>piece</p></body>', '/perspectives/x');
    expect(out).toContain('href="/s/what-is-this"');
    expect(out.indexOf('share-view-footer')).toBeLessThan(out.indexOf('</body>'));
  });

  it('gives the explainer page itself no footer', () => {
    const html = '<body><p>about</p></body>';
    expect(withShareFooter(html, '/what-is-this')).toBe(html);
  });
});
