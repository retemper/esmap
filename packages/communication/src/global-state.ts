/** 상태 변경 구독 리스너 */
type StateListener<T> = (newState: T, prevState: T) => void;

/** 글로벌 상태 관리 인터페이스 */
interface GlobalState<T extends Record<string, unknown>> {
  /** 현재 상태의 동결된 복사본을 반환한다 */
  getState: () => Readonly<T>;
  /** 부분 상태를 얕은 병합하고, 구독자에게 알린다 */
  setState: (partial: Partial<T>) => void;
  /** 상태 변경을 구독하고, 구독 해제 함수를 반환한다 */
  subscribe: (listener: StateListener<T>) => () => void;
  /** 초기 상태로 복원한다 */
  reset: () => void;
  /** 특정 키의 값이 변경될 때만 리스너를 호출한다 */
  select: <K extends keyof T>(
    key: K,
    listener: (newValue: T[K], prevValue: T[K]) => void,
  ) => () => void;
}

/**
 * 앱 간 공유 가능한 글로벌 상태를 생성한다.
 * @param initial - 초기 상태 객체
 * @returns 글로벌 상태 인스턴스
 */
function createGlobalState<T extends Record<string, unknown>>(initial: T): GlobalState<T> {
  const initialSnapshot = Object.freeze({ ...initial });
  const state: { current: T } = { current: { ...initial } };
  const listeners: Array<StateListener<T>> = [];

  /**
   * 현재 상태의 동결된 복사본을 만든다.
   */
  function frozenCopy(): Readonly<T> {
    return Object.freeze({ ...state.current });
  }

  /**
   * 모든 구독자에게 상태 변경을 통지한다.
   * @param prev - 변경 전 상태
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
      // 변경된 키가 없으면 불필요한 알림을 건너뛴다
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
