import { beforeEach, describe, expect, it } from 'vitest';
import { signManifest } from '../../../packages/@core/product-link/src/index.ts';
import { defineA11yTheme } from '../../../packages/@core/a11y-kit/src/index.ts';
import { __resetModulesForTests, applyManifest, installedModules, lastManifest, type ModuleLoader } from '../modules';

const keys = () => crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
const man = (ids: string[], version = '0.2.0') => ({ v: 1 as const, product: 'maaser-yashar', issuedAt: '2026-11-09T10:00:00.000Z', modules: ids.map((id) => ({ id, version, ref: 'core-v2026.11.09.2' })) });

describe('parent library modules', () => {
  beforeEach(() => __resetModulesForTests());

  it('installs lazily, removes cleanly, ignores unknown ids, keeps state on null', async () => {
    const log: string[] = [];
    const reg: Record<string, ModuleLoader> = { a11y: async () => ({ install: async () => { log.push('install'); return { remove: () => { log.push('remove'); } }; } }) };
    await applyManifest(man([]), reg); expect(log).toEqual([]);
    await applyManifest(man(['a11y', 'unknown-mod']), reg); expect([...installedModules()]).toEqual(['a11y']);
    await applyManifest(man(['a11y']), reg); expect(log).toEqual(['install']); // idempotent
    await applyManifest(null, reg); expect([...installedModules()]).toEqual(['a11y']); // offline / bad manifest: no change
    await applyManifest(man(['a11y'], '0.3.0'), reg); expect(log).toEqual(['install', 'remove', 'install']); // upgrade
    await applyManifest(man([]), reg); expect(log.at(-1)).toBe('remove'); expect(installedModules().size).toBe(0);
  });

  it('a module that fails to load or install changes nothing', async () => {
    const reg: Record<string, ModuleLoader> = { a11y: async () => { throw new Error('chunk'); } };
    await applyManifest(man(['a11y']), reg); expect(installedModules().size).toBe(0);
    const reg2: Record<string, ModuleLoader> = { a11y: async () => ({ install: async () => { throw new Error('mount'); } }) };
    await applyManifest(man(['a11y']), reg2); expect(installedModules().size).toBe(0);
  });

  it('only a verified manifest for this product is used (offline = last stored)', async () => {
    const k = await keys(), other = await keys();
    const s = await signManifest({ product: 'maaser-yashar', issuedAt: '2026-11-09T10:00:00.000Z', modules: [{ id: 'a11y', version: '0.2.0', ref: 'r' }] }, k.privateKey);
    const store = (v: unknown) => ({ get: async () => (v === undefined ? null : JSON.stringify(v)) });
    expect((await lastManifest(store(s), k.publicKey, 'maaser-yashar'))?.modules[0]?.id).toBe('a11y');
    expect(await lastManifest(store(s), other.publicKey, 'maaser-yashar')).toBeNull();
    expect(await lastManifest(store(s), k.publicKey, 'nehora')).toBeNull();
    expect(await lastManifest(store(undefined), k.publicKey, 'maaser-yashar')).toBeNull();
    expect(await lastManifest(store(s), null, 'maaser-yashar')).toBeNull();
  });

  it('the Maaser a11y theme passes the kit contrast checks', () => {
    expect(() => defineA11yTheme({ id: 'maaser-yashar', colors: { bg: '#0B1020', surface: '#151C32', fg: '#F4F6FF', fgMuted: '#B9C0DE', primary: '#8B9BFF', onPrimary: '#0B1024', focus: '#FFD88A', link: '#C4B5FD', danger: '#F0A8B8' } })).not.toThrow();
  });
});
