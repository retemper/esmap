/** App property change listener */
type PropsListener<T> = (newProps: T, prevProps: T) => void;

/** App property management interface */
interface AppProps<T extends Record<string, unknown>> {
  /** Returns a frozen copy of the current properties */
  getProps: () => Readonly<T>;
  /** Merges partial properties and notifies subscribers */
  setProps: (partial: Partial<T>) => void;
  /** Subscribes to property changes and returns an unsubscribe function */
  onPropsChange: (listener: PropsListener<T>) => () => void;
}

/**
 * Manages properties passed from shell to remote apps.
 * @param initial - initial property object
 * @returns app property instance
 */
function createAppProps<T extends Record<string, unknown>>(initial: T): AppProps<T> {
  const props: { current: T } = { current: { ...initial } };
  const listeners: Array<PropsListener<T>> = [];

  /**
   * Creates a frozen copy of the current properties.
   */
  function frozenCopy(): Readonly<T> {
    return Object.freeze({ ...props.current });
  }

  return {
    getProps(): Readonly<T> {
      return frozenCopy();
    },

    setProps(partial: Partial<T>): void {
      const prev = frozenCopy();
      props.current = { ...props.current, ...partial };
      const next = frozenCopy();
      for (const listener of [...listeners]) {
        listener(next, prev);
      }
    },

    onPropsChange(listener: PropsListener<T>): () => void {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      };
    },
  };
}

export { createAppProps };
export type { AppProps, PropsListener };
