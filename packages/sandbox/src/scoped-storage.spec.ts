import { describe, it, expect, beforeEach } from 'vitest';
import { createScopedStorage } from './scoped-storage.js';

/**
 * In-memory Storage implementation for testing.
 * Tests ScopedStorage without depending on localStorage.
 */
function createMockStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    key(index: number): string | null {
      const keys = [...store.keys()];
      return keys[index] ?? null;
    },
  };
}

describe('createScopedStorage', () => {
  describe('basic CRUD', () => {
    it('setItem/getItem operates with scoped keys', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'checkout', storage });

      scoped.setItem('cart', '[]');

      expect(scoped.getItem('cart')).toBe('[]');
      // The actual storage has the prefix applied
      expect(storage.getItem('checkout:cart')).toBe('[]');
    });

    it('returns null for nonexistent keys', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'app', storage });

      expect(scoped.getItem('nonexistent')).toBeNull();
    });

    it('removeItem deletes the scoped key', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'app', storage });

      scoped.setItem('key', 'value');
      scoped.removeItem('key');

      expect(scoped.getItem('key')).toBeNull();
      expect(storage.getItem('app:key')).toBeNull();
    });
  });

  describe('key isolation', () => {
    it('different scopes with the same key do not interfere with each other', () => {
      const storage = createMockStorage();
      const scopeA = createScopedStorage({ scope: 'a', storage });
      const scopeB = createScopedStorage({ scope: 'b', storage });

      scopeA.setItem('theme', 'dark');
      scopeB.setItem('theme', 'light');

      expect(scopeA.getItem('theme')).toBe('dark');
      expect(scopeB.getItem('theme')).toBe('light');
    });

    it('does not conflict with unscoped keys', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'app', storage });

      storage.setItem('theme', 'global');
      scoped.setItem('theme', 'scoped');

      expect(storage.getItem('theme')).toBe('global');
      expect(scoped.getItem('theme')).toBe('scoped');
    });
  });

  describe('keys()', () => {
    it('returns only keys belonging to this scope', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'checkout', storage });

      storage.setItem('global:key', 'v1');
      scoped.setItem('cart', '[]');
      scoped.setItem('total', '0');

      const keys = scoped.keys();

      expect(keys).toStrictEqual(['cart', 'total']);
    });

    it('returns an empty array for an empty scope', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'empty', storage });

      expect(scoped.keys()).toStrictEqual([]);
    });
  });

  describe('clear()', () => {
    it('deletes only keys in this scope and preserves other keys', () => {
      const storage = createMockStorage();
      const scopeA = createScopedStorage({ scope: 'a', storage });
      const scopeB = createScopedStorage({ scope: 'b', storage });

      scopeA.setItem('x', '1');
      scopeA.setItem('y', '2');
      scopeB.setItem('z', '3');
      storage.setItem('global', '4');

      scopeA.clear();

      expect(scopeA.keys()).toStrictEqual([]);
      expect(scopeB.getItem('z')).toBe('3');
      expect(storage.getItem('global')).toBe('4');
    });
  });

  describe('custom separator', () => {
    it('allows changing the separator', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'app', storage, separator: '/' });

      scoped.setItem('key', 'value');

      expect(storage.getItem('app/key')).toBe('value');
    });
  });

  describe('scope property', () => {
    it('returns the scope name', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'my-app', storage });

      expect(scoped.scope).toBe('my-app');
    });
  });
});
