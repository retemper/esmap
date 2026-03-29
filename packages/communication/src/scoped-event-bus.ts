import type { EventBus, EventHandler, EventMap, EventRecord, SubscribeOptions } from './event-bus.js';

/** 스코프가 지정된 이벤트 버스 인터페이스. 모든 이벤트에 자동으로 네임스페이스 prefix가 붙는다. */
interface ScopedEventBus<E extends EventMap = EventMap> {
  /** 스코프된 이벤트를 발행한다. 실제 이벤트 이름은 `${scope}:${event}`가 된다. */
  emit: <K extends keyof E & string>(event: K, payload?: E[K]) => void;
  /** 스코프된 이벤트를 구독한다. */
  on: <K extends keyof E & string>(
    event: K,
    handler: EventHandler<E[K]>,
    options?: SubscribeOptions,
  ) => () => void;
  /** 스코프된 이벤트를 한 번만 구독한다. */
  once: <K extends keyof E & string>(event: K, handler: EventHandler<E[K]>) => () => void;
  /** 스코프 내에서 와일드카드 패턴으로 구독한다. 패턴에 스코프 prefix가 자동으로 적용된다. */
  onAny: (pattern: string, handler: EventHandler<unknown>) => () => void;
  /** 스코프된 이벤트의 모든 리스너를 제거한다. */
  off: <K extends keyof E & string>(event: K) => void;
  /** 이 스코프의 이벤트 이력을 조회한다. */
  getHistory: (event?: string) => ReadonlyArray<EventRecord>;
  /**
   * 스코프 내 Request-Response. 이벤트를 발행하고 응답을 기다린다.
   * 실제로는 `${scope}:${event}` 이벤트가 발행되고, `${scope}:${event}:response`로 응답을 받는다.
   */
  request: <K extends keyof E & string>(event: K, payload?: E[K], timeout?: number) => Promise<unknown>;
  /** 이 스코프의 네임스페이스 prefix를 반환한다. */
  readonly scope: string;
}

/**
 * 기존 EventBus를 감싸서 네임스페이스 격리된 스코프 버스를 생성한다.
 * MFE 앱별로 이벤트 충돌을 방지하는 데 사용한다.
 *
 * @example
 * ```ts
 * const globalBus = createEventBus();
 * const checkoutBus = createScopedEventBus(globalBus, 'checkout');
 * checkoutBus.emit('loaded', {}); // 실제로는 'checkout:loaded' 이벤트가 발행됨
 * ```
 *
 * @param bus - 감쌀 상위 이벤트 버스
 * @param scope - 네임스페이스 prefix (예: "checkout", "app-nav")
 * @returns 스코프가 지정된 이벤트 버스
 */
function createScopedEventBus<E extends EventMap = EventMap>(
  bus: EventBus,
  scope: string,
): ScopedEventBus<E> {
  /** 이벤트 이름에 스코프 prefix를 추가한다. */
  function prefix(event: string): string {
    return `${scope}:${event}`;
  }

  // 내부 구현은 untyped (string/unknown). 제네릭 인터페이스가 호출 시점에서 타입을 강제한다.
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
      // 스코프 내 와일드카드: 'sub:*' → 상위 버스에서 'scope:sub:*' 로 변환
      return bus.onAny(`${scope}:${pattern}`, handler);
    },

    off(event: string): void {
      bus.off(prefix(event));
    },

    getHistory(event?: string): ReadonlyArray<EventRecord> {
      if (event !== undefined) {
        return bus.getHistory(prefix(event));
      }
      // 스코프에 해당하는 모든 이벤트 필터
      const scopePrefix = `${scope}:`;
      return bus.getHistory().filter((record) => record.event.startsWith(scopePrefix));
    },

    request(event: string, payload?: unknown, timeout?: number): Promise<unknown> {
      return bus.request(prefix(event), payload, timeout);
    },
  };

  // 제네릭 E로 narrowing — 런타임 동작은 동일하나 호출 시 타입이 강제된다
  return scoped as ScopedEventBus<E>;
}

export { createScopedEventBus };
export type { ScopedEventBus };
