import type { EventBus, EventHandler, EventMap, EventRecord, SubscribeOptions } from './event-bus.js';

/** Scoped event bus interface. All events are automatically prefixed with a namespace. */
interface ScopedEventBus<E extends EventMap = EventMap> {
  /** Emits a scoped event. The actual event name becomes `${scope}:${event}`. */
  emit: <K extends keyof E & string>(event: K, payload?: E[K]) => void;
  /** Subscribes to a scoped event. */
  on: <K extends keyof E & string>(
    event: K,
    handler: EventHandler<E[K]>,
    options?: SubscribeOptions,
  ) => () => void;
  /** Subscribes to a scoped event only once. */
  once: <K extends keyof E & string>(event: K, handler: EventHandler<E[K]>) => () => void;
  /** Subscribes with a wildcard pattern within the scope. The scope prefix is automatically applied to the pattern. */
  onAny: (pattern: string, handler: EventHandler<unknown>) => () => void;
  /** Removes all listeners for a scoped event. */
  off: <K extends keyof E & string>(event: K) => void;
  /** Retrieves event history for this scope. */
  getHistory: (event?: string) => ReadonlyArray<EventRecord>;
  /**
   * Request-Response within the scope. Emits an event and waits for a response.
   * Internally, `${scope}:${event}` is emitted and the response is received via `${scope}:${event}:response`.
   */
  request: <K extends keyof E & string>(event: K, payload?: E[K], timeout?: number) => Promise<unknown>;
  /** Returns the namespace prefix of this scope. */
  readonly scope: string;
}

/**
 * Wraps an existing EventBus to create a namespace-isolated scoped bus.
 * Used to prevent event collisions between MFE apps.
 *
 * @example
 * ```ts
 * const globalBus = createEventBus();
 * const checkoutBus = createScopedEventBus(globalBus, 'checkout');
 * checkoutBus.emit('loaded', {}); // actually emits a 'checkout:loaded' event
 * ```
 *
 * @param bus - the parent event bus to wrap
 * @param scope - namespace prefix (e.g., "checkout", "app-nav")
 * @returns scoped event bus
 */
function createScopedEventBus<E extends EventMap = EventMap>(
  bus: EventBus,
  scope: string,
): ScopedEventBus<E> {
  /** Adds the scope prefix to the event name. */
  function prefix(event: string): string {
    return `${scope}:${event}`;
  }

  // Internal implementation is untyped (string/unknown). The generic interface enforces types at call sites.
  const scoped: ScopedEventBus<EventMap> = {
    scope,

    emit(event: string, payload?: unknown): void {
      bus.emit(prefix(event), payload);
    },

    on(event: string, handler: EventHandler, options?: SubscribeOptions): () => void {
      return bus.on(prefix(event), handler, options);
    },

    once(event: string, handler: EventHandler): () => void {
      return bus.once(prefix(event), handler);
    },

    onAny(pattern: string, handler: EventHandler<unknown>): () => void {
      // Wildcard within scope: 'sub:*' -> converted to 'scope:sub:*' on the parent bus
      return bus.onAny(`${scope}:${pattern}`, handler);
    },

    off(event: string): void {
      bus.off(prefix(event));
    },

    getHistory(event?: string): ReadonlyArray<EventRecord> {
      if (event !== undefined) {
        return bus.getHistory(prefix(event));
      }
      // Filter all events belonging to this scope
      const scopePrefix = `${scope}:`;
      return bus.getHistory().filter((record) => record.event.startsWith(scopePrefix));
    },

    request(event: string, payload?: unknown, timeout?: number): Promise<unknown> {
      return bus.request(prefix(event), payload, timeout);
    },
  };

  // Narrowing via generic E — runtime behavior is identical but types are enforced at call sites
  return scoped as ScopedEventBus<E>;
}

export { createScopedEventBus };
export type { ScopedEventBus };
