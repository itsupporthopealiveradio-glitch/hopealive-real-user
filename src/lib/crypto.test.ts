import { describe, it, expect, beforeEach } from 'vitest';
import { secureStorage } from './crypto';

describe('secureStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('can set and get an item', async () => {
    await secureStorage.setItem('test-key', 'test-value');
    const value = await secureStorage.getItem('test-key');
    expect(value).toBe('test-value');
  });

  it('returns null for nonexistent keys', async () => {
    const value = await secureStorage.getItem('nonexistent-key');
    expect(value).toBeNull();
  });

  it('can remove an item', async () => {
    await secureStorage.setItem('test-key', 'to-be-removed');
    secureStorage.removeItem('test-key');
    const value = await secureStorage.getItem('test-key');
    expect(value).toBeNull();
  });
});
