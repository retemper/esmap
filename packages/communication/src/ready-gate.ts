/**
 * 공유 자원의 준비 상태를 동기화하는 게이트.
 * 인증 토큰, 사용자 정보 등 필수 공유 상태가 준비되기 전에
 * 의존하는 앱이 마운트되는 것을 방지한다.
 */

/** 개별 자원의 준비 상태 */
interface ResourceStatus {
  /** 자원 이름 */
  readonly name: string;
  /** 준비 완료 여부 */
  readonly ready: boolean;
  /** 준비 완료 시각. 미완료면 undefined */
  readonly readyAt: number | undefined;
}

/** ReadyGate 옵션 */
interface ReadyGateOptions {
  /** 모든 자원 준비를 기다리는 최대 시간(ms). 기본값: 10000 */
  readonly timeout?: number;
}

/** 공유 자원 준비 동기화 게이트 인터페이스 */
interface ReadyGate {
  /** 대기할 자원을 등록한다. 이미 등록된 자원은 무시한다. */
  register: (name: string) => void;
  /** 자원이 준비되었음을 선언한다. */
  markReady: (name: string) => void;
  /** 특정 자원이 준비될 때까지 기다린다. */
  waitFor: (name: string) => Promise<void>;
  /** 등록된 모든 자원이 준비될 때까지 기다린다. */
  waitForAll: () => Promise<void>;
  /** 특정 자원 목록이 모두 준비될 때까지 기다린다. */
  waitForMany: (names: readonly string[]) => Promise<void>;
  /** 모든 자원의 현재 상태를 조회한다. */
  getStatus: () => readonly ResourceStatus[];
  /** 모든 자원이 준비되었는지 즉시 확인한다. */
  isAllReady: () => boolean;
  /** 게이트를 초기화한다. 모든 등록과 대기를 리셋한다. */
  reset: () => void;
}

/**
 * 공유 자원 준비 동기화 게이트를 생성한다.
 *
 * @example
 * ```ts
 * // 호스트 앱에서 게이트 생성
 * const gate = createReadyGate({ timeout: 5000 });
 * gate.register('auth');
 * gate.register('config');
 *
 * // 인증 앱에서 토큰 준비 후
 * gate.markReady('auth');
 *
 * // 리모트 앱에서 인증 대기 후 마운트
 * await gate.waitFor('auth');
 * renderApp();
 * ```
 *
 * @param options - 게이트 설정
 * @returns ReadyGate 인스턴스
 */
function createReadyGate(options?: ReadyGateOptions): ReadyGate {
  const timeout = options?.timeout ?? 10000;

  /** 자원별 준비 시각. undefined면 미준비 */
  const resources = new Map<string, number | undefined>();
  /** 자원별 대기 중인 resolver 목록 */
  const waiters = new Map<string, Array<() => void>>();

  /**
   * 특정 자원의 대기자들을 모두 해소한다.
   * @param name - 준비된 자원 이름
   */
  function resolveWaiters(name: string): void {
    const pending = waiters.get(name);
    if (pending) {
      for (const resolve of pending) {
        resolve();
      }
      waiters.delete(name);
    }
  }

  /**
   * 타임아웃 에러를 생성한다.
   * @param names - 대기 중인 자원 이름들
   */
  function createTimeoutError(names: readonly string[]): Error {
    return new Error(
      `[esmap] ReadyGate 타임아웃 (${timeout}ms): ` +
      `대기 중인 자원 [${names.join(', ')}]이(가) 준비되지 않았습니다.`,
    );
  }

  return {
    register(name: string): void {
      if (!resources.has(name)) {
        resources.set(name, undefined);
      }
    },

    markReady(name: string): void {
      // 미등록 자원도 mark 가능 (암시적 등록)
      resources.set(name, Date.now());
      resolveWaiters(name);
    },

    waitFor(name: string): Promise<void> {
      // 이미 준비된 자원
      if (resources.get(name) !== undefined) {
        return Promise.resolve();
      }

      // 미등록 자원은 암시적으로 등록
      if (!resources.has(name)) {
        resources.set(name, undefined);
      }

      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          // 대기자 목록에서 제거
          const pending = waiters.get(name);
          if (pending) {
            const idx = pending.indexOf(resolve);
            if (idx !== -1) {
              pending.splice(idx, 1);
            }
          }
          reject(createTimeoutError([name]));
        }, timeout);

        const wrappedResolve = (): void => {
          clearTimeout(timer);
          resolve();
        };

        const pending = waiters.get(name) ?? [];
        pending.push(wrappedResolve);
        waiters.set(name, pending);
      });
    },

    async waitForAll(): Promise<void> {
      const unreadyNames = [...resources.entries()]
        .filter(([, readyAt]) => readyAt === undefined)
        .map(([name]) => name);

      if (unreadyNames.length === 0) return;

      await Promise.all(unreadyNames.map((name) => this.waitFor(name)));
    },

    async waitForMany(names: readonly string[]): Promise<void> {
      await Promise.all(names.map((name) => this.waitFor(name)));
    },

    getStatus(): readonly ResourceStatus[] {
      return [...resources.entries()].map(([name, readyAt]) => ({
        name,
        ready: readyAt !== undefined,
        readyAt,
      }));
    },

    isAllReady(): boolean {
      for (const readyAt of resources.values()) {
        if (readyAt === undefined) return false;
      }
      return true;
    },

    reset(): void {
      // 대기 중인 Promise는 타임아웃에 의해 자연스럽게 reject된다.
      // 즉시 reject하지 않는 이유: reset은 destroy 시점에 호출되며,
      // 이미 teardown 중인 앱의 에러 핸들러가 불필요하게 트리거되는 것을 방지한다.
      waiters.clear();
      resources.clear();
    },
  };
}

export { createReadyGate };
export type { ReadyGate, ReadyGateOptions, ResourceStatus };
