/** State change subscription listener */
type StateListener<T> = (newState: T, prevState: T) => void;

/** Global state management interface */
interface GlobalState<T extends Record<string, unknown>> {
  /** Returns a frozen copy of the current state */
  getState: () => Readonly<T>;
  /** Shallow merges partial state and notifies subscribers */
  setState: (partial: Partial<T>) => void;
  /** Subscribes to state changes and returns an unsubscribe function */
  subscribe: (listener: StateListener<T>) => () => void;
  /** Restores to the initial state */
  reset: () => void;
  /** Calls the listener only when the value of a specific key changes */
  select: <K extends keyof T>(
    key: K,
    listener: (newValue: T[K], prevValue: T[K]) => void,
  ) => () => void;
}

/**
 * Creates a global state that can be shared between apps.
 * @param initial - initial state object
 * @returns global state instance
 */
function createGlobalState<T extends Record<string, unknown>>(initial: T): GlobalState<T> {
  const initialSnapshot = Object.freeze({ ...initial });
  const state: { current: T } = { current: { ...initial } };
  const listeners: Array<StateListener<T>> = [];

  /**
   * Creates a frozen copy of the current state.
   */
  function frozenCopy(): Readonly<T> {
    return Object.freeze({ ...state.current });
  }

  /**
   * Notifies all subscribers of state changes.
   * @param prev - state before the change
   */
  function notifyAll(prev: T): void {
    const next = frozenCopy();
    for (const listener of [...listeners]) {
      listener(next, prev);
    }
  }

  return {
    getState(): Readonly<T> {
      return frozenCopy();
    },

    setState(partial: Partial<T>): void {
      // Skip unnecessary notifications if no keys have changed
      const keys = Object.keys(partial) as Array<keyof T>;
      const hasChange = keys.some((key) => !Object.is(state.current[key], partial[key]));
      if (!hasChange) return;

      const prev = frozenCopy();
      state.current = { ...state.current, ...partial };
      notifyAll(prev);
    },

    subscribe(listener: StateListener<T>): () => void {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      };
    },

    reset(): void {
      const prev = frozenCopy();
      state.current = { ...initialSnapshot };
      notifyAll(prev);
    },

    select<K extends keyof T>(
      key: K,
      listener: (newValue: T[K], prevValue: T[K]) => void,
    ): () => void {
      const wrappedListener: StateListener<T> = (newState, prevState) => {
        if (newState[key] !== prevState[key]) {
          listener(newState[key], prevState[key]);
        }
      };
      listeners.push(wrappedListener);
      return () => {
        const idx = listeners.indexOf(wrappedListener);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      };
    },
  };
}

export { createGlobalState };
export type { GlobalState, StateListener };
