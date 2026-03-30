/**
 * Guard that detects and prevents namespace conflicts on global resources.
 * Tracks ownership of shared modules, events, state keys, etc. accessed by
 * multiple MFE apps to block unintended overwrites.
 */

/** Namespace guard conflict action type */
type ConflictAction = 'warn' | 'error' | 'skip';

/** Namespace guard options */
interface NamespaceGuardOptions {
  /** Action on conflict detection. Defaults to 'warn'. */
  readonly onConflict?: ConflictAction;
  /** List of allowed shared keys. These keys do not trigger conflicts even when registered by multiple apps. */
  readonly allowedSharedKeys?: ReadonlyArray<string>;
}

/** Key ownership record */
interface OwnershipRecord {
  /** Name of the app that first registered the key */
  readonly owner: string;
  /** Registration timestamp */
  readonly registeredAt: number;
}

/** Namespace guard interface */
interface NamespaceGuard {
  /** Attempts to register a key. Behaves according to the conflict policy if already owned by another app. */
  claim: (key: string, owner: string) => boolean;
  /** Releases key ownership. */
  release: (key: string, owner: string) => void;
  /** Releases all keys owned by a specific app. */
  releaseAll: (owner: string) => void;
  /** Returns the current owner of a key. */
  getOwner: (key: string) => string | undefined;
  /** Returns all key-owner mappings. */
  getAll: () => ReadonlyMap<string, OwnershipRecord>;
  /** Returns the list of keys owned by a specific app. */
  getOwnedBy: (owner: string) => readonly string[];
}

/**
 * Creates a namespace conflict guard for global resources.
 *
 * @example
 * ```ts
 * const guard = createNamespaceGuard({ onConflict: 'error' });
 * guard.claim('theme', 'app-a');     // true — registration succeeded
 * guard.claim('theme', 'app-b');     // throws — conflict
 * guard.claim('theme', 'app-a');     // true — re-registration by the same owner is allowed
 * ```
 *
 * @param options - guard configuration
 * @returns namespace guard instance
 */
function createNamespaceGuard(options?: NamespaceGuardOptions): NamespaceGuard {
  const onConflict = options?.onConflict ?? 'warn';
  const allowedSharedKeys = new Set(options?.allowedSharedKeys ?? []);
  const registry = new Map<string, OwnershipRecord>();

  /**
   * Handles conflicts according to the configured policy.
   * @param key - the conflicting key
   * @param existingOwner - the existing owner
   * @param newOwner - the new registration attempt owner
   * @returns whether the claim succeeded
   */
  function handleConflict(key: string, existingOwner: string, newOwner: string): boolean {
    const message =
      `[esmap] Namespace conflict: key "${key}" is owned by "${existingOwner}". ` +
      `"${newOwner}" attempted to register.`;

    switch (onConflict) {
      case 'error':
        throw new Error(message);
      case 'skip':
        return false;
      case 'warn':
        console.warn(message);
        return false;
      default: {
        const _exhaustive: never = onConflict;
        return _exhaustive;
      }
    }
  }

  return {
    claim(key: string, owner: string): boolean {
      // Allowed shared keys always succeed
      if (allowedSharedKeys.has(key)) {
        if (!registry.has(key)) {
          registry.set(key, { owner, registeredAt: Date.now() });
        }
        return true;
      }

      const existing = registry.get(key);

      // Unregistered key
      if (existing === undefined) {
        registry.set(key, { owner, registeredAt: Date.now() });
        return true;
      }

      // Re-registration by the same owner
      if (existing.owner === owner) {
        return true;
      }

      // Conflict with a different owner
      return handleConflict(key, existing.owner, owner);
    },

    release(key: string, owner: string): void {
      const existing = registry.get(key);
      if (existing !== undefined && existing.owner === owner) {
        registry.delete(key);
      }
    },

    releaseAll(owner: string): void {
      for (const [key, record] of registry) {
        if (record.owner === owner) {
          registry.delete(key);
        }
      }
    },

    getOwner(key: string): string | undefined {
      return registry.get(key)?.owner;
    },

    getAll(): ReadonlyMap<string, OwnershipRecord> {
      return registry;
    },

    getOwnedBy(owner: string): readonly string[] {
      const keys: string[] = [];
      for (const [key, record] of registry) {
        if (record.owner === owner) {
          keys.push(key);
        }
      }
      return keys;
    },
  };
}

export { createNamespaceGuard };
export type { NamespaceGuard, NamespaceGuardOptions, OwnershipRecord, ConflictAction };
