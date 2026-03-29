import type { MfeApp } from '@esmap/shared';

/** 라이프사이클 단계 이름 */
type LifecyclePhase = 'bootstrap' | 'mount' | 'unmount' | 'update';

/** 라이프사이클 메서드 호출을 기록하는 스파이 정보 */
export interface SpyCall {
  /** 호출 시 전달된 인자 */
  readonly args: readonly unknown[];
  /** 호출 시점의 타임스탬프 */
  readonly timestamp: number;
}

/** 호출 추적 기능이 포함된 라이프사이클 스파이 함수 */
export interface LifecycleSpy {
  /** 스파이 함수 본체. 호출하면 내부적으로 호출 기록을 남긴다. */
  (...args: readonly unknown[]): Promise<void>;
  /** 누적된 호출 기록 */
  readonly calls: readonly SpyCall[];
  /** 호출 횟수 */
  readonly callCount: number;
  /** 호출 기록을 초기화한다. */
  reset(): void;
}

/** createMockApp이 반환하는 확장된 MfeApp 인터페이스 */
export interface MockMfeApp extends MfeApp {
  /** bootstrap 호출 스파이 */
  readonly bootstrapSpy: LifecycleSpy;
  /** mount 호출 스파이 */
  readonly mountSpy: LifecycleSpy;
  /** unmount 호출 스파이 */
  readonly unmountSpy: LifecycleSpy;
  /** update 호출 스파이 */
  readonly updateSpy: LifecycleSpy;
}

/** createMockApp에 전달할 수 있는 오버라이드 옵션 */
export interface MockAppOverrides {
  /** bootstrap 호출 시 실행할 커스텀 로직 */
  readonly bootstrap?: () => Promise<void>;
  /** mount 호출 시 실행할 커스텀 로직 */
  readonly mount?: (container: HTMLElement) => Promise<void>;
  /** unmount 호출 시 실행할 커스텀 로직 */
  readonly unmount?: (container: HTMLElement) => Promise<void>;
  /** update 호출 시 실행할 커스텀 로직 */
  readonly update?: (props: Readonly<Record<string, unknown>>) => Promise<void>;
}

/**
 * 호출 추적이 가능한 라이프사이클 스파이 함수를 생성한다.
 * @param implementation - 스파이 호출 시 실행할 구현 함수
 */
function createLifecycleSpy(
  implementation: (...args: readonly unknown[]) => Promise<void> = () => Promise.resolve(),
): LifecycleSpy {
  const calls: SpyCall[] = [];

  const spy = ((...args: readonly unknown[]): Promise<void> => {
    calls.push({ args, timestamp: Date.now() });
    return implementation(...args);
  }) as LifecycleSpy & { reset(): void };

  Object.defineProperty(spy, 'calls', {
    get: () => [...calls],
  });

  Object.defineProperty(spy, 'callCount', {
    get: () => calls.length,
  });

  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}

/**
 * 테스트용 mock MFE 앱을 생성한다.
 * 각 라이프사이클 메서드는 호출 추적이 가능한 스파이 함수로 구현된다.
 * @param overrides - 라이프사이클 메서드의 커스텀 구현
 */
export function createMockApp(overrides?: MockAppOverrides): MockMfeApp {
  const bootstrapSpy = createLifecycleSpy(overrides?.bootstrap);
  const mountSpy = createLifecycleSpy(
    overrides?.mount
      ? (...args: readonly unknown[]) => overrides.mount!(args[0] as HTMLElement)
      : undefined,
  );
  const unmountSpy = createLifecycleSpy(
    overrides?.unmount
      ? (...args: readonly unknown[]) => overrides.unmount!(args[0] as HTMLElement)
      : undefined,
  );
  const updateSpy = createLifecycleSpy(
    overrides?.update
      ? (...args: readonly unknown[]) =>
          overrides.update!(args[0] as Readonly<Record<string, unknown>>)
      : undefined,
  );

  return {
    bootstrap: () => bootstrapSpy(),
    mount: (container: HTMLElement) => mountSpy(container),
    unmount: (container: HTMLElement) => unmountSpy(container),
    update: (props: Readonly<Record<string, unknown>>) => updateSpy(props),
    bootstrapSpy,
    mountSpy,
    unmountSpy,
    updateSpy,
  };
}

/**
 * 특정 라이프사이클 단계에서 에러를 발생시키는 mock MFE 앱을 생성한다.
 * @param phase - 에러를 발생시킬 라이프사이클 단계
 * @param error - 발생시킬 에러 객체 (기본값: 해당 phase 이름을 포함하는 Error)
 */
export function createFailingApp(
  phase: LifecyclePhase,
  error: Error = new Error(`${phase} failed`),
): MockMfeApp {
  const failingImpl = (): Promise<void> => Promise.reject(error);

  const overrides: MockAppOverrides = {
    ...(phase === 'bootstrap' ? { bootstrap: failingImpl } : {}),
    ...(phase === 'mount' ? { mount: () => failingImpl() } : {}),
    ...(phase === 'unmount' ? { unmount: () => failingImpl() } : {}),
    ...(phase === 'update' ? { update: () => failingImpl() } : {}),
  };

  return createMockApp(overrides);
}
