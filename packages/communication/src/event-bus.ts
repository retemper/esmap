/** Event handler function type */
type EventHandler<T = unknown> = (payload: T) => void;

/** Event map — maps event names to payload types */
type EventMap = Record<string, unknown>;

/** Event occurrence record */
interface EventRecord {
  /** Event name */
  readonly event: string;
  /** Event payload */
  readonly payload: unknown;
  /** Timestamp of occurrence */
  readonly timestamp: number;
}

/** Subscription options */
interface SubscribeOptions {
  /** If true, replays event history at subscription time so late subscribers receive past events */
  readonly replay?: boolean;
}

/** Event bus creation options */
interface EventBusOptions {
  /** Maximum number of event history entries to retain (default: 100) */
  maxHistory?: number;
  /** Callback invoked on handler errors. If not set, errors are silently ignored and the next handler is executed */
  onHandlerError?: (event: string, error: unknown) => void;
  /** Default timeout (ms) for request-response pattern. Default: 5000 */
  defaultRequestTimeout?: number;
}

/**
 * Type-safe event bus interface.
 * When an event map is specified via generic E, payload types are enforced in emit/on/once.
 *
 * @example
 * ```ts
 * type AppEvents = {
 *   'user:login': { userId: string };
 *   'cart:update': { items: number };
 * };
 * const bus = createEventBus<AppEvents>();
 * bus.on('user:login', (payload) => console.log(payload.userId)); // type inferred
 * bus.emit('user:login', { userId: '123' }); // payload type checked
 * ```
 */
interface EventBus<E extends EventMap = EventMap> {
  /** Emits an event to all listeners */
  emit: <K extends keyof E & string>(event: K, payload?: E[K]) => void;
  /** Subscribes to an event and returns an unsubscribe function. Supports history replay via replay option. */
  on: <K extends keyof E & string>(
    event: K,
    handler: EventHandler<E[K]>,
    options?: SubscribeOptions,
  ) => () => void;
  /** Subscribes to an event only once */
  once: <K extends keyof E & string>(event: K, handler: EventHandler<E[K]>) => () => void;
  /** Subscribes to events with a wildcard pattern. 'app:*' receives all events starting with 'app:'. */
  onAny: (pattern: string, handler: EventHandler<unknown>) => () => void;
  /** Removes all listeners for a specific event */
  off: <K extends keyof E & string>(event: K) => void;
  /** Removes all listeners */
  clear: () => void;
  /** Retrieves event history. Filters to the specified event if provided */
  getHistory: (event?: string) => ReadonlyArray<EventRecord>;
  /** Returns the number of listeners for a specific event */
  listenerCount: <K extends keyof E & string>(event: K) => number;
  /**
   * Request-Response pattern. Emits an event and waits for a response.
   * Responders reply via `${event}:response` event, not the return value of `on(event, handler)`.
   * @param event - request event name
   * @param payload - request payload
   * @param timeout - timeout (ms). Defaults to EventBusOptions.defaultRequestTimeout
   * @returns response payload
   */
  request: <K extends keyof E & string>(
    event: K,
    payload?: E[K],
    timeout?: number,
  ) => Promise<unknown>;
}

/**
 * Creates a type-safe event bus for inter-app event-based communication.
 * Internally isolates handler errors so that one handler failure does not affect others.
 * @param options - event bus configuration
 * @returns event bus instance
 */
function createEventBus<E extends EventMap = EventMap>(options?: EventBusOptions): EventBus<E> {
  const maxHistory = options?.maxHistory ?? 100;
  const defaultRequestTimeout = options?.defaultRequestTimeout ?? 5000;
  const onHandlerError = options?.onHandlerError;
  const listeners = new Map<string, Array<EventHandler>>();
  const wildcardListeners: Array<{ prefix: string; handler: EventHandler<unknown> }> = [];
  const history: Array<EventRecord> = [];

  /**
   * Gets or creates the listener array for the given event.
   * @param event - event name
   */
  function getOrCreateHandlers(event: string): Array<EventHandler> {
    const existing = listeners.get(event);
    if (existing) {
      return existing;
    }
    const handlers: Array<EventHandler> = [];
    listeners.set(event, handlers);
    return handlers;
  }

  /**
   * Adds an event record to history and removes old records when maxHistory is exceeded.
   * @param event - event name
   * @param payload - event payload
   */
  function addHistory(event: string, payload: unknown): void {
    history.push({ event, payload, timestamp: Date.now() });
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  }

  /**
   * Safely invokes a handler. Forwards errors to onHandlerError if they occur.
   * @param handler - handler to invoke
   * @param payload - payload to pass
   * @param event - event name (for error reporting)
   */
  function safeCall(handler: EventHandler, payload: unknown, event: string): void {
    try {
      handler(payload);
    } catch (error) {
      if (onHandlerError) {
        onHandlerError(event, error);
      }
    }
  }

  // Internal implementation is untyped (string/unknown),
  // but the generic interface enforces types at call sites.
  const bus: EventBus<EventMap> = {
    emit(event: string, payload?: unknown): void {
      addHistory(event, payload);

      // exact match listeners
      const handlers = listeners.get(event);
      if (handlers) {
        const snapshot = [...handlers];
        for (const handler of snapshot) {
          safeCall(handler, payload, event);
        }
      }

      // wildcard listeners
      const wildcardSnapshot = [...wildcardListeners];
      for (const entry of wildcardSnapshot) {
        if (event.startsWith(entry.prefix)) {
          safeCall(entry.handler, payload, event);
        }
      }
    },

    on(event: string, handler: EventHandler, subscribeOptions?: SubscribeOptions): () => void {
      const handlers = getOrCreateHandlers(event);
      handlers.push(handler);

      // replay option: replays previous history for new subscriber
      if (subscribeOptions?.replay) {
        const past = history.filter((record) => record.event === event);
        for (const record of past) {
          safeCall(handler, record.payload, event);
        }
      }

      return () => {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) {
          handlers.splice(idx, 1);
        }
      };
    },

    once(event: string, handler: EventHandler): () => void {
      const wrappedHandler: EventHandler = (payload) => {
        unsubscribe();
        handler(payload);
      };
      const handlers = getOrCreateHandlers(event);
      handlers.push(wrappedHandler);
      const unsubscribe = (): void => {
        const idx = handlers.indexOf(wrappedHandler);
        if (idx !== -1) {
          handlers.splice(idx, 1);
        }
      };
      return unsubscribe;
    },

    onAny(pattern: string, handler: EventHandler<unknown>): () => void {
      // 'app:*' → prefix = 'app:'
      const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
      const entry = { prefix, handler };
      wildcardListeners.push(entry);
      return () => {
        const idx = wildcardListeners.indexOf(entry);
        if (idx !== -1) {
          wildcardListeners.splice(idx, 1);
        }
      };
    },

    off(event: string): void {
      listeners.delete(event);
    },

    clear(): void {
      listeners.clear();
      wildcardListeners.length = 0;
    },

    getHistory(event?: string): ReadonlyArray<EventRecord> {
      if (event === undefined) {
        return [...history];
      }
      return history.filter((record) => record.event === event);
    },

    listenerCount(event: string): number {
      return listeners.get(event)?.length ?? 0;
    },

    request(event: string, payload?: unknown, timeout?: number): Promise<unknown> {
      const timeoutMs = timeout ?? defaultRequestTimeout;
      const responseEvent = `${event}:response`;

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          unsubscribe();
          reject(new Error(`[esmap] request "${event}" timed out (${timeoutMs}ms)`));
        }, timeoutMs);

        const unsubscribe = bus.on(responseEvent, (response: unknown) => {
          clearTimeout(timer);
          unsubscribe();
          resolve(response);
        });

        bus.emit(event, payload);
      });
    },
  };

  // Narrowing via generic E — runtime behavior is identical but types are enforced at call sites
  return bus as EventBus<E>;
}

export { createEventBus };
export type { EventBus, EventBusOptions, EventHandler, EventMap, EventRecord, SubscribeOptions };
