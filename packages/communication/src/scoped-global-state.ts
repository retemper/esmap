import type { GlobalState, StateListener } from './global-state.js';

/** 스코프 슬라이스 정의 — 앱이 접근 가능한 키를 타입 수준에서 제한한다 */
interface ScopedGlobalStateOptions<
  T extends Record<string, unknown>,
  K extends keyof T,
> {
  /** 상위 글로벌 상태 */
  readonly state: GlobalState<T>;
  /** 이 스코프가 접근 가능한 키 목록 */
  readonly keys: readonly K[];
  /** 읽기 전용 모드. true이면 setState를 호출할 수 없다 */
  readonly readonly?: boolean;
}

/** 스코프된 글로벌 상태 인터페이스. 허용된 키만 접근할 수 있다. */
interface ScopedGlobalState<T extends Record<string, unknown>, K extends keyof T> {
  /** 허용된 키의 현재 값을 포함하는 부분 상태를 반환한다 */
  getState: () => Readonly<Pick<T, K>>;
  /** 허용된 키의 부분 상태를 업데이트한다. readonly 모드에서는 에러를 throw한다 */
  setState: (partial: Partial<Pick<T, K>>) => void;
  /** 허용된 키 중 하나라도 변경되면 호출되는 리스너를 등록한다 */
  subscribe: (listener: StateListener<Pick<T, K>>) => () => void;
  /** 허용된 키 목록을 반환한다 */
  readonly allowedKeys: readonly K[];
}

/**
 * 글로벌 상태의 특정 키만 접근 가능한 스코프 뷰를 생성한다.
 * MFE 앱별로 접근 범위를 제한하여 의도치 않은 상태 변경을 방지한다.
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
 * themeScope.setState({ user: 'kim' }); // 타입 에러 — user는 허용 키가 아님
 * ```
 *
 * @param options - 스코프 설정
 * @returns 스코프된 글로벌 상태 인스턴스
 */
function createScopedGlobalState<
  T extends Record<string, unknown>,
  K extends keyof T,
>(options: ScopedGlobalStateOptions<T, K>): ScopedGlobalState<T, K> {
  const { state, keys, readonly: isReadonly = false } = options;
  const allowedKeySet = new Set<K>(keys);

  /**
   * 허용된 키만 포함하는 부분 상태를 추출한다.
   * @param full - 전체 상태 객체
   */
  function pickAllowedKeys(full: Readonly<T>): Readonly<Pick<T, K>> {
    const partial: Record<string, unknown> = {};
    for (const key of keys) {
      partial[key as string] = full[key];
    }
    return Object.freeze(partial) as Readonly<Pick<T, K>>;
  }

  /**
   * partial의 모든 키가 허용된 키인지 검증한다.
   * @param partial - 업데이트할 부분 상태
   */
  function validateKeys(partial: Partial<Pick<T, K>>): void {
    for (const key of Object.keys(partial)) {
      if (!allowedKeySet.has(key as K)) {
        throw new Error(
          `[esmap] 스코프 위반: 키 "${key}"는 이 스코프에서 접근할 수 없습니다. ` +
          `허용된 키: [${keys.map(String).join(', ')}]`,
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
        throw new Error('[esmap] 읽기 전용 스코프에서는 상태를 변경할 수 없습니다.');
      }
      validateKeys(partial);
      state.setState(partial as Partial<T>);
    },

    subscribe(listener: StateListener<Pick<T, K>>): () => void {
      return state.subscribe((newFull, prevFull) => {
        const newSlice = pickAllowedKeys(newFull);
        const prevSlice = pickAllowedKeys(prevFull);

        // 허용된 키 중 변경된 것이 있을 때만 알림
        const hasRelevantChange = keys.some(
          (key) => !Object.is(newFull[key], prevFull[key]),
        );

        if (hasRelevantChange) {
          listener(newSlice, prevSlice);
        }
      });
    },
  };
}

export { createScopedGlobalState };
export type { ScopedGlobalState, ScopedGlobalStateOptions };
