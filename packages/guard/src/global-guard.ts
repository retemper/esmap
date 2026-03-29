/**
 * 글로벌 오염을 감지하고 방지하는 가드.
 * MFE 앱이 window 객체에 예기치 않은 속성을 추가하는 것을 모니터링한다.
 */

/** 글로벌 가드 옵션 */
export interface GlobalGuardOptions {
  /** 허용된 전역 변수 이름 목록 */
  readonly allowList?: readonly string[];
  /** 위반 시 호출되는 콜백 */
  readonly onViolation?: (violation: GlobalViolation) => void;
  /** 폴링 간격(ms). 기본값 1000. 낮은 값은 성능에 영향을 준다. */
  readonly interval?: number;
}

/** 글로벌 위반 정보 */
export interface GlobalViolation {
  /** 추가/변경된 전역 변수 이름 */
  readonly property: string;
  /** 위반 유형 */
  readonly type: 'add' | 'modify';
}

/** 가드 해제 함수 */
export interface GlobalGuardHandle {
  /** 가드를 해제하고 스냅샷 이후 추가된 전역 변수를 반환한다. */
  readonly dispose: () => readonly string[];
  /** 수동으로 즉시 검사를 트리거한다. */
  readonly check: () => void;
}

/**
 * 현재 window 전역 변수의 스냅샷을 찍고, 이후 변경을 감지한다.
 * @param options - 가드 옵션
 * @returns 가드 핸들
 */
export function createGlobalGuard(options?: GlobalGuardOptions): GlobalGuardHandle {
  const snapshot = new Set(Object.keys(globalThis));
  const allowSet = new Set(options?.allowList ?? []);
  const addedSet = new Set<string>();
  const interval = options?.interval ?? 1000;

  /** 현재 전역 변수를 스냅샷과 비교하여 새로 추가된 변수를 감지한다. */
  function check(): void {
    const currentKeys = Object.keys(globalThis);
    for (const key of currentKeys) {
      if (!snapshot.has(key) && !allowSet.has(key) && !addedSet.has(key)) {
        addedSet.add(key);
        options?.onViolation?.({ property: key, type: 'add' });
      }
    }
  }

  const intervalId = setInterval(check, interval);

  return {
    dispose() {
      clearInterval(intervalId);
      return [...addedSet];
    },
    check,
  };
}

/**
 * window 전역 변수의 차이를 한 번만 계산한다 (비동기 폴링 없음).
 * @param before - 이전 전역 변수 이름 Set
 * @param allowList - 허용 목록
 * @returns 새로 추가된 전역 변수 이름 목록
 */
export function diffGlobals(
  before: ReadonlySet<string>,
  allowList: readonly string[] = [],
): readonly string[] {
  const allowSet = new Set(allowList);
  const currentKeys = Object.keys(globalThis);
  return currentKeys.filter((key) => !before.has(key) && !allowSet.has(key));
}

/** 현재 전역 변수 이름의 스냅샷을 생성한다. */
export function snapshotGlobals(): ReadonlySet<string> {
  return new Set(Object.keys(globalThis));
}
