// Tests for the soft password gate in middleware.ts.
// Run: pnpm run test:middleware   (Node >= 22.6, uses native type stripping)
//
// The load-bearing assertion is the matcher: /llms.txt, /llms-full.txt,
// /tools/*.md, /img/**, /robots.txt and /sitemap.xml must never be gated.

import assert from 'node:assert/strict';
import test from 'node:test';

process.env.WIKI_PASSWORD = 'default-alive';
process.env.WIKI_GATE_SECRET = 'test-secret';

const { default: middleware, config } = await import('../middleware.ts');

const matcher = new RegExp(`^${config.matcher[0]}$`);
const matches = (pathname: string) => matcher.test(pathname);

const get = (pathname: string, headers: Record<string, string> = {}) =>
  new Request(`https://www.buildonanthropic.com${pathname}`, { headers });

const post = (pathname: string, password: string) =>
  new Request(`https://www.buildonanthropic.com${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password }).toString(),
  });

test('matcher gates HTML routes', () => {
  for (const path of ['/', '/concepts/the-harness', '/case-studies', '/tools', '/changelog']) {
    assert.equal(matches(path), true, `${path} should be gated`);
  }
});

test('matcher leaves the machine layer and static files open', () => {
  for (const path of [
    '/llms.txt',
    '/llms-full.txt',
    '/robots.txt',
    '/sitemap.xml',
    '/search-index.json',
    '/tools/build-on-claude.md',
    '/tools/customize-the-generator.md',
    '/skills/buildonanthropic-intake/SKILL.md',
    '/img/og/home.png',
    '/img/favicon.png',
    '/assets/js/main.abc123.js',
  ]) {
    assert.equal(matches(path), false, `${path} must stay open`);
  }
});

test('an unauthenticated page request gets the gate', async () => {
  const res = await middleware(get('/concepts/the-harness'));
  assert.ok(res);
  assert.equal(res.status, 401);
  const html = await res.text();
  assert.match(html, /Two words you already say out loud/);
  assert.doesNotMatch(html, /default-alive/, 'the gate page must never print the password');
  assert.doesNotMatch(html, /—/, 'no em dashes');
});

test('the wrong password re-renders the gate with an error', async () => {
  const res = await middleware(post('/', 'ramen-profitable'));
  assert.ok(res);
  assert.equal(res.status, 401);
  assert.match(await res.text(), /Not it\. Ask literally anyone in your batch\./);
});

test('the right password sets a signed cookie and redirects back', async () => {
  const res = await middleware(post('/concepts/the-harness', '  Default-Alive  '));
  assert.ok(res);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/concepts/the-harness');
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /^boa_gate=v1\.\d+\.[\w-]+;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, /default-alive/i, 'the cookie must not carry the password');
});

test('a valid cookie passes through', async () => {
  const issued = await middleware(post('/', 'default-alive'));
  const cookie = issued.headers.get('set-cookie').split(';')[0];
  const res = await middleware(get('/concepts/the-harness', { cookie }));
  assert.equal(res, undefined);
});

test('a forged or tampered cookie does not pass', async () => {
  const issued = await middleware(post('/', 'default-alive'));
  const value = issued.headers.get('set-cookie').split(';')[0].split('=')[1];
  const [version, expires] = value.split('.');
  for (const forged of [
    `boa_gate=${version}.${expires}.deadbeef`,
    `boa_gate=${version}.${Number(expires) + 999}.${value.split('.')[2]}`,
    'boa_gate=v1.9999999999.',
    'boa_gate=nonsense',
  ]) {
    const res = await middleware(get('/', { cookie: forged }));
    assert.ok(res, `forged cookie should be rejected: ${forged}`);
    assert.equal(res.status, 401);
  }
});

test('an expired cookie does not pass', async () => {
  const past = String(Math.floor(Date.now() / 1000) - 10);
  const res = await middleware(get('/', { cookie: `boa_gate=v1.${past}.whatever` }));
  assert.equal(res.status, 401);
});

test('link-preview crawlers pass through so unfurls keep working', async () => {
  const res = await middleware(get('/concepts/the-harness', { 'user-agent': 'Twitterbot/1.0' }));
  assert.equal(res, undefined);
});

test('an unset password disables the gate entirely', async () => {
  const saved = process.env.WIKI_PASSWORD;
  process.env.WIKI_PASSWORD = '';
  assert.equal(await middleware(get('/')), undefined);
  process.env.WIKI_PASSWORD = saved;
});
