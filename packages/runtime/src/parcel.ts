import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import { createLifecycleRunner } from './lifecycle-runner.js';

/** Parcel 생성 옵션 */
export interface ParcelOptions {
  /** 마운트할 MfeApp 또는 비동기 로더 함수 */
  readonly app: MfeApp | (() => Promise<MfeApp>);
  /** 마운트 대상 DOM 요소 */
  readonly domElement: HTMLElement;
  /** 앱에 전달할 초기 props */
  readonly props?: Readonly<Record<string, unknown>>;
}

/** 라우트 독립적으로 앱을 제어하는 Parcel 인스턴스 */
export interface Parcel {
  /** 현재 상태 */
  readonly status: MfeAppStatus;
  /** props를 업데이트한다 */
  update(props: Readonly<Record<string, unknown>>): Promise<void>;
  /** 앱을 언마운트한다 */
  unmount(): Promise<void>;
}

/**
 * 라우트와 무관하게 앱을 DOM 요소에 마운트하여 Parcel을 생성한다.
 * single-spa의 mountRootParcel과 유사한 패턴.
 * 내부적으로 LifecycleRunner를 사용하여 상태 전이를 관리한다.
 *
 * @param options - Parcel 생성 옵션
 * @returns 마운트된 Parcel 인스턴스
 */
export async function mountParcel(options: ParcelOptions): Promise<Parcel> {
  const resolvedApp = typeof options.app === 'function' ? await options.app() : options.app;

  const runner = createLifecycleRunner({
    app: resolvedApp,
    container: options.domElement,
  });

  await runner.bootstrap();
  await runner.mount();

  if (options.props && resolvedApp.update) {
    await runner.update(options.props);
  }

  return {
    get status(): MfeAppStatus {
      return runner.status;
    },
    update: (props) => runner.update(props),
    unmount: () => runner.unmount(),
  };
}
