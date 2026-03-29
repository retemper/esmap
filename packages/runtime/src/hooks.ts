/** 라이프사이클 단계 */
export type LifecyclePhase = 'load' | 'bootstrap' | 'mount' | 'unmount' | 'update';

/** 훅 실행 시점 */
type HookTiming = 'before' | 'after';

/** 훅에 전달되는 컨텍스트 */
export interface HookContext {
  /** 대상 앱 이름 */
  readonly appName: string;
  /** 현재 라이프사이클 단계 */
  readonly phase: LifecyclePhase;
}

/** 라이프사이클 훅 함수 */
export type LifecycleHook = (ctx: HookContext) => Promise<void> | void;

/** 훅 에러 정보 */
export interface HookError {
  /** 에러를 발생시킨 훅의 컨텍스트 */
  readonly context: HookContext;
  /** 원본 에러 */
  readonly error: unknown;
}

/** 라이프사이클 훅 생성 옵션 */
export interface LifecycleHooksOptions {
  /**
   * 훅 에러 핸들러. 설정하면 개별 훅 에러를 잡고 나머지 훅을 계속 실행한다.
   * 미설정 시 첫 에러에서 즉시 throw한다.
   */
  readonly onError?: (hookError: HookError) => void;
}

/** 등록된 훅 항목 */
interface HookEntry {
  readonly phase: LifecyclePhase;
  readonly timing: HookTiming;
  readonly hook: LifecycleHook;
  /** undefined이면 글로벌 훅 */
  readonly appName?: string;
}

/** 라이프사이클 훅 관리자 */
export interface LifecycleHooks {
  /** 모든 앱의 특정 단계 전에 실행할 글로벌 훅을 등록한다 */
  beforeEach(phase: LifecyclePhase, hook: LifecycleHook): void;
  /** 모든 앱의 특정 단계 후에 실행할 글로벌 훅을 등록한다 */
  afterEach(phase: LifecyclePhase, hook: LifecycleHook): void;
  /** 특정 앱의 특정 단계 전에 실행할 훅을 등록한다 */
  before(appName: string, phase: LifecyclePhase, hook: LifecycleHook): void;
  /** 특정 앱의 특정 단계 후에 실행할 훅을 등록한다 */
  after(appName: string, phase: LifecyclePhase, hook: LifecycleHook): void;
  /** 등록된 훅을 실행한다 */
  runHooks(appName: string, phase: LifecyclePhase, timing: HookTiming): Promise<void>;
}

/**
 * 라이프사이클 훅 관리자를 생성한다.
 * 글로벌 및 앱별 before/after 훅을 등록하고 실행할 수 있다.
 * @param options - 훅 실행 옵션 (에러 핸들러 등)
 * @returns LifecycleHooks 인스턴스
 */
export function createLifecycleHooks(options?: LifecycleHooksOptions): LifecycleHooks {
  const entries: HookEntry[] = [];

  return {
    beforeEach(phase: LifecyclePhase, hook: LifecycleHook): void {
      entries.push({ phase, timing: 'before', hook });
    },

    afterEach(phase: LifecyclePhase, hook: LifecycleHook): void {
      entries.push({ phase, timing: 'after', hook });
    },

    before(appName: string, phase: LifecyclePhase, hook: LifecycleHook): void {
      entries.push({ phase, timing: 'before', hook, appName });
    },

    after(appName: string, phase: LifecyclePhase, hook: LifecycleHook): void {
      entries.push({ phase, timing: 'after', hook, appName });
    },

    async runHooks(appName: string, phase: LifecyclePhase, timing: HookTiming): Promise<void> {
      const ctx: HookContext = { appName, phase };

      const matching = entries.filter(
        (entry) =>
          entry.phase === phase &&
          entry.timing === timing &&
          (entry.appName === undefined || entry.appName === appName),
      );

      for (const entry of matching) {
        if (options?.onError) {
          try {
            await entry.hook(ctx);
          } catch (error) {
            options.onError({ context: ctx, error });
          }
        } else {
          await entry.hook(ctx);
        }
      }
    },
  };
}
