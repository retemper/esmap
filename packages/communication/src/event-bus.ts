/** 이벤트 핸들러 함수 타입 */
type EventHandler<T = unknown> = (payload: T) => void;

/** 이벤트 맵 — 이벤트 이름을 페이로드 타입에 매핑한다 */
type EventMap = Record<string, unknown>;

/** 이벤트 발생 기록 */
interface EventRecord {
  /** 이벤트 이름 */
  readonly event: string;
  /** 이벤트 페이로드 */
  readonly payload: unknown;
  /** 발생 시각 */
  readonly timestamp: number;
}

/** 구독 옵션 */
interface SubscribeOptions {
  /** true이면 구독 시점에 이벤트 이력을 재생하여 늦은 구독자도 과거 이벤트를 받는다 */
  readonly replay?: boolean;
}

/** 이벤트 버스 생성 옵션 */
interface EventBusOptions {
  /** 보관할 최대 이벤트 이력 수 (기본값: 100) */
  maxHistory?: number;
  /** 핸들러 에러 발생 시 호출되는 콜백. 미설정 시 에러를 무시하고 다음 핸들러를 실행한다 */
  onHandlerError?: (event: string, error: unknown) => void;
  /** request-response 패턴의 기본 타임아웃(ms). 기본값: 5000 */
  defaultRequestTimeout?: number;
}

/**
 * 타입 안전한 이벤트 버스 인터페이스.
 * 제네릭 E로 이벤트 맵을 지정하면 emit/on/once에서 페이로드 타입이 강제된다.
 *
 * @example
 * ```ts
 * type AppEvents = {
 *   'user:login': { userId: string };
 *   'cart:update': { items: number };
 * };
 * const bus = createEventBus<AppEvents>();
 * bus.on('user:login', (payload) => console.log(payload.userId)); // 타입 추론됨
 * bus.emit('user:login', { userId: '123' }); // payload 타입 체크됨
 * ```
 */
interface EventBus<E extends EventMap = EventMap> {
  /** 이벤트를 발행하여 모든 리스너에게 전달한다 */
  emit: <K extends keyof E & string>(event: K, payload?: E[K]) => void;
  /** 이벤트를 구독하고, 구독 해제 함수를 반환한다. replay 옵션으로 이력 재생 가능. */
  on: <K extends keyof E & string>(
    event: K,
    handler: EventHandler<E[K]>,
    options?: SubscribeOptions,
  ) => () => void;
  /** 이벤트를 한 번만 구독한다 */
  once: <K extends keyof E & string>(event: K, handler: EventHandler<E[K]>) => () => void;
  /** 와일드카드 패턴으로 이벤트를 구독한다. 'app:*'는 'app:'로 시작하는 모든 이벤트를 수신한다. */
  onAny: (pattern: string, handler: EventHandler<unknown>) => () => void;
  /** 특정 이벤트의 모든 리스너를 제거한다 */
  off: <K extends keyof E & string>(event: K) => void;
  /** 모든 리스너를 제거한다 */
  clear: () => void;
  /** 이벤트 이력을 조회한다. event를 전달하면 해당 이벤트만 필터한다 */
  getHistory: (event?: string) => ReadonlyArray<EventRecord>;
  /** 특정 이벤트의 리스너 수를 반환한다 */
  listenerCount: <K extends keyof E & string>(event: K) => number;
  /**
   * Request-Response 패턴. 이벤트를 발행하고 응답을 기다린다.
   * 응답자는 `on(event, handler)`에서 반환값이 아닌 `${event}:response` 이벤트로 응답한다.
   * @param event - 요청 이벤트 이름
   * @param payload - 요청 페이로드
   * @param timeout - 타임아웃(ms). 기본값은 EventBusOptions.defaultRequestTimeout
   * @returns 응답 페이로드
   */
  request: <K extends keyof E & string>(
    event: K,
    payload?: E[K],
    timeout?: number,
  ) => Promise<unknown>;
}

/**
 * 앱 간 이벤트 기반 통신을 위한 타입 안전한 이벤트 버스를 생성한다.
 * 내부적으로 핸들러 에러를 격리하여 하나의 핸들러 실패가 다른 핸들러에 영향을 주지 않는다.
 * @param options - 이벤트 버스 설정
 * @returns 이벤트 버스 인스턴스
 */
function createEventBus<E extends EventMap = EventMap>(options?: EventBusOptions): EventBus<E> {
  const maxHistory = options?.maxHistory ?? 100;
  const defaultRequestTimeout = options?.defaultRequestTimeout ?? 5000;
  const onHandlerError = options?.onHandlerError;
  const listeners = new Map<string, Array<EventHandler>>();
  const wildcardListeners: Array<{ prefix: string; handler: EventHandler<unknown> }> = [];
  const history: Array<EventRecord> = [];

  /**
   * 이벤트에 해당하는 리스너 배열을 가져오거나 새로 생성한다.
   * @param event - 이벤트 이름
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
   * 이력에 이벤트 기록을 추가하고, maxHistory를 초과하면 오래된 기록을 제거한다.
   * @param event - 이벤트 이름
   * @param payload - 이벤트 페이로드
   */
  function addHistory(event: string, payload: unknown): void {
    history.push({ event, payload, timestamp: Date.now() });
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  }

  /**
   * 핸들러를 안전하게 호출한다. 에러가 발생하면 onHandlerError로 전달한다.
   * @param handler - 호출할 핸들러
   * @param payload - 전달할 페이로드
   * @param event - 이벤트 이름 (에러 보고용)
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

  // 내부 구현은 untyped (string/unknown)이지만,
  // 제네릭 인터페이스가 호출 시점에서 타입을 강제한다.
  const bus: EventBus<EventMap> = {
    emit(event: string, payload?: unknown): void {
      addHistory(event, payload);

      // exact match 리스너
      const handlers = listeners.get(event);
      if (handlers) {
        const snapshot = [...handlers];
        for (const handler of snapshot) {
          safeCall(handler, payload, event);
        }
      }

      // wildcard 리스너
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

      // replay 옵션: 이전 이력을 새 구독자에게 재생
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
          reject(new Error(`[esmap] request "${event}" 타임아웃 (${timeoutMs}ms)`));
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

  // 제네릭 E로 narrowing — 런타임 동작은 동일하나 호출 시 타입이 강제된다
  return bus as EventBus<E>;
}

export { createEventBus };
export type { EventBus, EventBusOptions, EventHandler, EventMap, EventRecord, SubscribeOptions };
