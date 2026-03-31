import type { GlobalState, StateListener } from './global-state.js';

/** Scope slice definition — restricts accessible keys at the type level for each app */
interface ScopedGlobalStateOptions<T extends Record<string, unknown>, K extends keyof T> {
  /** Parent global state */
  readonly state: GlobalState<T>;
  /** List of keys this scope can access */
  readonly keys: readonly K[];
  /** Read-only mode. If true, setState cannot be called */
  readonly readonly?: boolean;
}

/** Scoped global state interface. Only allowed keys are accessible. */
interface ScopedGlobalState<T extends Record<string, unknown>, K extends keyof T> {
  /** Returns a partial state containing the current values of allowed keys */
  getState: () => Readonly<Pick<T, K>>;
  /** Updates the partial state for allowed keys. Throws an error in readonly mode */
  setState: (partial: Partial<Pick<T, K>>) => void;
  /** Registers a listener that is called when any of the allowed keys change */
  subscribe: (listener: StateListener<Pick<T, K>>) => () => void;
  /** Returns the list of allowed keys */
  readonly allowedKeys: readonly K[];
}

/**
 * Creates a scoped view that can only access specific keys of the global state.
 * Restricts access per MFE app to prevent unintended state mutations.
 *
 * @example
 * ```ts
 * const global = createGlobalState({ theme: 'dark', locale: 'ko', user: null });
 * const themeScope = createScopedGlobalState({
 *   state: global,
 *   keys: ['theme', 'locale'],
 *   readonly: false,
 * });
 * themeScope.getState(); // { theme: 'dark', locale: 'ko' }
 * themeScope.setState({ theme: 'light' }); // OK
 * themeScope.setState({ user: 'kim' }); // type error — user is not an allowed key
 * ```
 *
 * @param options - scope configuration
 * @returns scoped global state instance
 */
function createScopedGlobalState<T extends Record<string, unknown>, K extends keyof T>(
  options: ScopedGlobalStateOptions<T, K>,
): ScopedGlobalState<T, K> {
  const { state, keys, readonly: isReadonly = false } = options;
  const allowedKeySet = new Set<K>(keys);

  /**
   * Extracts a partial state containing only the allowed keys.
   * @param full - the full state object
   */
  function pickAllowedKeys(full: Readonly<T>): Readonly<Pick<T, K>> {
    const partial: Record<string, unknown> = {};
    for (const key of keys) {
      partial[key as string] = full[key];
    }
    return Object.freeze(partial) as Readonly<Pick<T, K>>;
  }

  /**
   * Validates that all keys in partial are allowed keys.
   * @param partial - the partial state to update
   */
  function validateKeys(partial: Partial<Pick<T, K>>): void {
    for (const key of Object.keys(partial)) {
      if (!allowedKeySet.has(key as K)) {
        throw new Error(
          `[esmap] Scope violation: key "${key}" is not accessible in this scope. ` +
            `Allowed keys: [${keys.map(String).join(', ')}]`,
        );
      }
    }
  }

  return {
    allowedKeys: keys,

    getState(): Readonly<Pick<T, K>> {
      return pickAllowedKeys(state.getState());
    },

    setState(partial: Partial<Pick<T, K>>): void {
      if (isReadonly) {
        throw new Error('[esmap] Cannot modify state in a read-only scope.');
      }
      validateKeys(partial);
      state.setState(partial as Partial<T>);
    },

    subscribe(listener: StateListener<Pick<T, K>>): () => void {
      return state.subscribe((newFull, prevFull) => {
        const newSlice = pickAllowedKeys(newFull);
        const prevSlice = pickAllowedKeys(prevFull);

        // Only notify when at least one allowed key has changed
        const hasRelevantChange = keys.some((key) => !Object.is(newFull[key], prevFull[key]));

        if (hasRelevantChange) {
          listener(newSlice, prevSlice);
        }
      });
    },
  };
}

export { createScopedGlobalState };
export type { ScopedGlobalState, ScopedGlobalStateOptions };
