import type { RegisteredApp } from '@esmap/shared';
import { Router } from '@esmap/runtime';
import type { RouterOptions } from '@esmap/runtime';
import { createTestRegistry } from './mock-registry.js';
import type { InlineAppDefinition, TestRegistry } from './mock-registry.js';

/** createTestHarness에 전달할 옵션 */
export interface TestHarnessOptions {
  /** 초기에 등록할 인라인 앱 목록 */
  readonly apps?: readonly InlineAppDefinition[];
  /** 라우터 옵션 */
  readonly routerOptions?: RouterOptions;
  /** DOM 컨테이너 셀렉터 (기본값: '#app') */
  readonly containerSelector?: string;
}

/** MFE 통합 테스트를 위한 전체 환경 하네스 */
export interface TestHarness {
  /** 테스트 레지스트리 */
  readonly testRegistry: TestRegistry;
  /** 라우터 인스턴스 */
  readonly router: Router;
  /** DOM 컨테이너 엘리먼트 */
  readonly container: HTMLElement;
  /**
   * 지정한 경로로 프로그래매틱 내비게이션을 수행한다.
   * @param path - 이동할 URL 경로
   */
  navigate(path: string): Promise<void>;
  /** 현재 MOUNTED 상태인 앱 목록을 반환한다. */
  getActiveApps(): readonly RegisteredApp[];
  /** DOM 컨테이너, 라우터, 레지스트리를 정리한다. */
  cleanup(): Promise<void>;
}

/**
 * MFE 통합 테스트에 필요한 DOM 컨테이너, 레지스트리, 라우터를 셋업한다.
 * cleanup()을 호출하면 모든 리소스가 정리된다.
 * @param options - 테스트 하네스 구성 옵션
 */
export async function createTestHarness(options?: TestHarnessOptions): Promise<TestHarness> {
  const containerSelector = options?.containerSelector ?? '#app';
  const selectorId = containerSelector.startsWith('#')
    ? containerSelector.slice(1)
    : containerSelector;

  const existingContainer = document.querySelector(containerSelector);
  if (existingContainer) {
    existingContainer.remove();
  }

  const container = document.createElement('div');
  container.id = selectorId;
  document.body.appendChild(container);

  const testRegistry = createTestRegistry({ apps: options?.apps });
  const router = new Router(testRegistry.registry, options?.routerOptions);

  await router.start();

  const navigate = async (path: string): Promise<void> => {
    history.pushState(null, '', path);
    /**
     * Router는 pushState를 패치하여 esmap:navigate 이벤트를 발생시킨다.
     * 이벤트 핸들링이 비동기이므로 microtask를 한 번 양보한다.
     */
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  };

  const getActiveApps = (): readonly RegisteredApp[] =>
    testRegistry.registry.getApps().filter((app) => app.status === 'MOUNTED');

  const cleanup = async (): Promise<void> => {
    router.stop();

    const apps = testRegistry.registry.getApps();
    for (const app of apps) {
      if (app.status === 'MOUNTED') {
        await testRegistry.registry.unmountApp(app.name);
      }
    }

    container.remove();
  };

  return {
    testRegistry,
    router,
    container,
    navigate,
    getActiveApps,
    cleanup,
  };
}
