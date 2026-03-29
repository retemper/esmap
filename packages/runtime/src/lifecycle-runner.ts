import type { MfeApp, MfeAppStatus } from '@esmap/shared';

/** lifecycle 상태 변경 콜백 */
type StatusChangeCallback = (from: MfeAppStatus, to: MfeAppStatus) => void;

/** createLifecycleRunner 옵션 */
export interface LifecycleRunnerOptions {
  /** 실행 대상 MfeApp */
  readonly app: MfeApp;
  /** 마운트 대상 DOM 요소 */
  readonly container: HTMLElement;
  /** 상태 변경 시 호출되는 콜백 */
  readonly onStatusChange?: StatusChangeCallback;
}

/**
 * MfeApp의 라이프사이클을 안전하게 실행하는 러너.
 * 상태 전이 가드와 에러 처리를 캡슐화한다.
 */
export interface LifecycleRunner {
  /** 현재 라이프사이클 상태 */
  readonly status: MfeAppStatus;
  /** bootstrap을 실행한다. NOT_LOADED → BOOTSTRAPPING → NOT_MOUNTED */
  bootstrap(): Promise<void>;
  /** mount를 실행한다. NOT_MOUNTED → MOUNTED */
  mount(): Promise<void>;
  /** unmount를 실행한다. MOUNTED → UNMOUNTING → NOT_MOUNTED */
  unmount(): Promise<void>;
  /** props를 업데이트한다. MOUNTED 상태에서만 유효하다. */
  update(props: Readonly<Record<string, unknown>>): Promise<void>;
}

/**
 * MfeApp 라이프사이클 러너를 생성한다.
 * AppRegistry와 Parcel이 공유하는 상태 전이 로직을 캡슐화한다.
 *
 * @param options - 러너 옵션
 * @returns LifecycleRunner 인스턴스
 */
export function createLifecycleRunner(options: LifecycleRunnerOptions): LifecycleRunner {
  const { app, container, onStatusChange } = options;
  const state: { status: MfeAppStatus } = { status: 'NOT_LOADED' };

  /** 상태를 전이하고 콜백을 호출한다 */
  function transition(to: MfeAppStatus): void {
    const from = state.status;
    state.status = to;
    onStatusChange?.(from, to);
  }

  return {
    get status(): MfeAppStatus {
      return state.status;
    },

    async bootstrap(): Promise<void> {
      if (state.status !== 'NOT_LOADED') return;

      try {
        transition('BOOTSTRAPPING');
        await app.bootstrap();
        transition('NOT_MOUNTED');
      } catch (error) {
        transition('LOAD_ERROR');
        throw error;
      }
    },

    async mount(): Promise<void> {
      if (state.status !== 'NOT_MOUNTED') {
        throw new Error(`mount할 수 없는 상태입니다: ${state.status}`);
      }

      try {
        await app.mount(container);
        transition('MOUNTED');
      } catch (error) {
        transition('LOAD_ERROR');
        throw error;
      }
    },

    async unmount(): Promise<void> {
      if (state.status !== 'MOUNTED') {
        throw new Error(`unmount할 수 없는 상태입니다: ${state.status}`);
      }

      transition('UNMOUNTING');
      try {
        await app.unmount(container);
        transition('NOT_MOUNTED');
      } catch (error) {
        transition('LOAD_ERROR');
        throw error;
      }
    },

    async update(props: Readonly<Record<string, unknown>>): Promise<void> {
      if (state.status !== 'MOUNTED') {
        throw new Error(`update할 수 없는 상태입니다: ${state.status}`);
      }

      if (!app.update) {
        throw new Error('앱이 update 라이프사이클을 구현하지 않았습니다');
      }

      await app.update(props);
    },
  };
}
