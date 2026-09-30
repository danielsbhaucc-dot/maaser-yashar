/**
 * T-10 PIN lock — salted hash only, never plain PIN (from dataSafety suite).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  },
}));

import {
  PIN_STORAGE_KEY,
  clearPinLock,
  hasPinLock,
  isPinFormat,
  savePinLock,
  verifyPinLock,
} from '../pinLock';

describe('T-10 PIN lock', () => {
  beforeEach(() => {
    store.clear();
  });

  it('stores only salted SHA-256 — never plain PIN', async () => {
    expect(isPinFormat('1234')).toBe(true);
    expect(isPinFormat('12')).toBe(false);
    expect(isPinFormat('1234567')).toBe(false);

    await savePinLock('135790');
    expect(await hasPinLock()).toBe(true);
    expect(await verifyPinLock('135790')).toBe(true);
    expect(await verifyPinLock('0000')).toBe(false);

    const raw = store.get(PIN_STORAGE_KEY)!;
    expect(raw).toBeTruthy();
    expect(raw.includes('135790')).toBe(false);
    const parsed = JSON.parse(raw) as { salt: string; hash: string };
    expect(parsed.salt).toMatch(/^[0-9a-f]+$/i);
    expect(parsed.hash).toMatch(/^[0-9a-f]+$/i);
    expect(parsed.hash.length).toBe(64);

    await clearPinLock();
    expect(await hasPinLock()).toBe(false);
    expect(store.has(PIN_STORAGE_KEY)).toBe(false);
  });
});
