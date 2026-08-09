import { describe, it, expect } from 'vitest';
import { mintShareToken, verifyShareToken } from './share';

const SECRET = 'test-secret-32-bytes-loooooooong';
const NOW = 1_800_000_000;

describe('expiring share tokens', () => {
  it('round-trips a payload', async () => {
    const t = await mintShareToken({ p: '/perspectives/obedience-is-everything', exp: NOW + 86400 }, SECRET);
    expect(await verifyShareToken(t, SECRET, NOW))
      .toEqual({ p: '/perspectives/obedience-is-everything', exp: NOW + 86400 });
  });

  it('rejects an expired token', async () => {
    const t = await mintShareToken({ p: '/letters/x', exp: NOW - 1 }, SECRET);
    expect(await verifyShareToken(t, SECRET, NOW)).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const t = await mintShareToken({ p: '/letters/x', exp: NOW + 86400 }, SECRET);
    const [body, sig] = t.split('.');
    const forgedBody = body.slice(0, -2) + (body.endsWith('AA') ? 'BB' : 'AA');
    expect(await verifyShareToken(`${forgedBody}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const t = await mintShareToken({ p: '/letters/x', exp: NOW + 86400 }, 'other-secret');
    expect(await verifyShareToken(t, SECRET, NOW)).toBeNull();
  });

  it('fails closed with an empty secret on both mint and verify', async () => {
    await expect(mintShareToken({ p: '/letters/x', exp: NOW + 86400 }, '')).rejects.toThrow();
    const t = await mintShareToken({ p: '/letters/x', exp: NOW + 86400 }, SECRET);
    expect(await verifyShareToken(t, '', NOW)).toBeNull();
  });

  it('refuses to mint or accept a non-site-absolute path', async () => {
    await expect(mintShareToken({ p: 'https://evil.example', exp: NOW + 86400 }, SECRET)).rejects.toThrow();
  });
});
