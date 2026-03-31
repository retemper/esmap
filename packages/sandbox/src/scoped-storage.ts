/**
 * Scoped Web Storage wrapper.
 * Automatically adds a namespace prefix to localStorage/sessionStorage keys
 * to prevent key collisions between MFE apps.
 */

/** ScopedStorage creation options */
interface ScopedStorageOptions {
  /** Scope name used as the key prefix (e.g., "checkout", "user-profile") */
  readonly scope: string;
  /** Target storage. Defaults to localStorage */
  readonly storage?: Storage;
  /** Key separator. Defaults to ":" */
  readonly separator?: string;
}

/** Namespaced Storage interface */
interface ScopedStorage {
  /** Reads a value using the scoped key */
  getItem: (key: string) => string | null;
  /** Stores a value using the scoped key */
  setItem: (key: string, value: string) => void;
  /** Deletes a scoped key */
  removeItem: (key: string) => void;
  /** Returns all keys belonging to this scope */
  keys: () => readonly string[];
  /** Deletes all entries in this scope */
  clear: () => void;
  /** Returns the scope's namespace prefix */
  readonly scope: string;
}

/**
 * Creates a namespaced Web Storage wrapper.
 * All key access is automatically prefixed with `${scope}${separator}`,
 * preventing collisions with other apps' keys.
 *
 * @example
 * ```ts
 * const storage = createScopedStorage({ scope: 'checkout' });
 * storage.setItem('cart', '[]'); // actual key: "checkout:cart"
 * storage.getItem('cart');       // localStorage.getItem("checkout:cart")
 * ```
 *
 * @param options - scoped storage configuration
 * @returns a scoped storage instance
 */
function createScopedStorage(options: ScopedStorageOptions): ScopedStorage {
  const { scope, separator = ':' } = options;
  const storage = options.storage ?? globalThis.localStorage;
  const prefix = `${scope}${separator}`;

  /** Adds the scope prefix to the original key */
  function toScopedKey(key: string): string {
    return `${prefix}${key}`;
  }

  /** Extracts the original key from a scoped key */
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
      // Collect keys first to avoid index shifting during deletion
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
