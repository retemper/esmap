import { describe, it, expect, beforeEach } from 'vitest';
import { createScopedStorage } from './scoped-storage.js';

/**
 * 테스트용 인메모리 Storage 구현.
 * localStorage 의존 없이 ScopedStorage를 테스트한다.
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
  describe('기본 CRUD', () => {
    it('setItem/getItem이 스코프된 키로 동작한다', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'checkout', storage });

      scoped.setItem('cart', '[]');

      expect(scoped.getItem('cart')).toBe('[]');
      // 실제 스토리지에는 prefix가 붙어 있다
      expect(storage.getItem('checkout:cart')).toBe('[]');
    });

    it('존재하지 않는 키에 대해 null을 반환한다', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'app', storage });

      expect(scoped.getItem('nonexistent')).toBeNull();
    });

    it('removeItem이 스코프된 키를 삭제한다', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'app', storage });

      scoped.setItem('key', 'value');
      scoped.removeItem('key');

      expect(scoped.getItem('key')).toBeNull();
      expect(storage.getItem('app:key')).toBeNull();
    });
  });

  describe('키 격리', () => {
    it('같은 키를 가진 다른 스코프가 서로 간섭하지 않는다', () => {
      const storage = createMockStorage();
      const scopeA = createScopedStorage({ scope: 'a', storage });
      const scopeB = createScopedStorage({ scope: 'b', storage });

      scopeA.setItem('theme', 'dark');
      scopeB.setItem('theme', 'light');

      expect(scopeA.getItem('theme')).toBe('dark');
      expect(scopeB.getItem('theme')).toBe('light');
    });

    it('스코프 없는 키와도 충돌하지 않는다', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'app', storage });

      storage.setItem('theme', 'global');
      scoped.setItem('theme', 'scoped');

      expect(storage.getItem('theme')).toBe('global');
      expect(scoped.getItem('theme')).toBe('scoped');
    });
  });

  describe('keys()', () => {
    it('이 스코프에 속하는 키만 반환한다', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'checkout', storage });

      storage.setItem('global:key', 'v1');
      scoped.setItem('cart', '[]');
      scoped.setItem('total', '0');

      const keys = scoped.keys();

      expect(keys).toStrictEqual(['cart', 'total']);
    });

    it('빈 스코프면 빈 배열을 반환한다', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'empty', storage });

      expect(scoped.keys()).toStrictEqual([]);
    });
  });

  describe('clear()', () => {
    it('이 스코프의 키만 삭제하고 다른 키는 유지한다', () => {
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

  describe('커스텀 구분자', () => {
    it('separator를 변경할 수 있다', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'app', storage, separator: '/' });

      scoped.setItem('key', 'value');

      expect(storage.getItem('app/key')).toBe('value');
    });
  });

  describe('scope 속성', () => {
    it('scope 이름을 반환한다', () => {
      const storage = createMockStorage();
      const scoped = createScopedStorage({ scope: 'my-app', storage });

      expect(scoped.scope).toBe('my-app');
    });
  });
});
