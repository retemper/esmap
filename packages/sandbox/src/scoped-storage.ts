/**
 * 스코프가 지정된 Web Storage 래퍼.
 * localStorage/sessionStorage 키에 자동으로 네임스페이스 prefix를 추가하여
 * MFE 앱 간 키 충돌을 방지한다.
 */

/** ScopedStorage 생성 옵션 */
interface ScopedStorageOptions {
  /** 키 prefix로 사용할 스코프 이름 (예: "checkout", "user-profile") */
  readonly scope: string;
  /** 대상 스토리지. 기본값은 localStorage */
  readonly storage?: Storage;
  /** 키 구분자. 기본값은 ":" */
  readonly separator?: string;
}

/** 네임스페이스가 적용된 Storage 인터페이스 */
interface ScopedStorage {
  /** 스코프된 키로 값을 읽는다 */
  getItem: (key: string) => string | null;
  /** 스코프된 키로 값을 저장한다 */
  setItem: (key: string, value: string) => void;
  /** 스코프된 키를 삭제한다 */
  removeItem: (key: string) => void;
  /** 이 스코프에 속하는 모든 키를 반환한다 */
  keys: () => readonly string[];
  /** 이 스코프의 모든 항목을 삭제한다 */
  clear: () => void;
  /** 스코프의 네임스페이스 prefix를 반환한다 */
  readonly scope: string;
}

/**
 * 네임스페이스가 적용된 Web Storage 래퍼를 생성한다.
 * 모든 키 접근에 `${scope}${separator}` prefix가 자동으로 붙어
 * 다른 앱의 키와 충돌하지 않는다.
 *
 * @example
 * ```ts
 * const storage = createScopedStorage({ scope: 'checkout' });
 * storage.setItem('cart', '[]'); // 실제 키: "checkout:cart"
 * storage.getItem('cart');       // localStorage.getItem("checkout:cart")
 * ```
 *
 * @param options - 스코프 스토리지 설정
 * @returns 스코프가 적용된 스토리지 인스턴스
 */
function createScopedStorage(options: ScopedStorageOptions): ScopedStorage {
  const { scope, separator = ':' } = options;
  const storage = options.storage ?? globalThis.localStorage;
  const prefix = `${scope}${separator}`;

  /** 원본 키에 스코프 prefix를 추가한다 */
  function toScopedKey(key: string): string {
    return `${prefix}${key}`;
  }

  /** 스코프된 키에서 원본 키를 추출한다 */
  function fromScopedKey(scopedKey: string): string {
    return scopedKey.slice(prefix.length);
  }

  return {
    scope,

    getItem(key: string): string | null {
      return storage.getItem(toScopedKey(key));
    },

    setItem(key: string, value: string): void {
      storage.setItem(toScopedKey(key), value);
    },

    removeItem(key: string): void {
      storage.removeItem(toScopedKey(key));
    },

    keys(): readonly string[] {
      const result: string[] = [];
      for (const idx of Array.from({ length: storage.length }, (_, i) => i)) {
        const fullKey = storage.key(idx);
        if (fullKey !== null && fullKey.startsWith(prefix)) {
          result.push(fromScopedKey(fullKey));
        }
      }
      return result;
    },

    clear(): void {
      // 역순 삭제로 인덱스 시프트 방지
      const toRemove: string[] = [];
      for (const idx of Array.from({ length: storage.length }, (_, i) => i)) {
        const fullKey = storage.key(idx);
        if (fullKey !== null && fullKey.startsWith(prefix)) {
          toRemove.push(fullKey);
        }
      }
      for (const key of toRemove) {
        storage.removeItem(key);
      }
    },
  };
}

export { createScopedStorage };
export type { ScopedStorage, ScopedStorageOptions };
