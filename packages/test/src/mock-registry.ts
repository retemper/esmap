import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import { AppRegistry } from '@esmap/runtime';
import { createMockApp } from './mock-app.js';
import type { MockAppOverrides, MockMfeApp } from './mock-app.js';

/** 인라인 앱 정의. dynamic import 없이 직접 MfeApp 인스턴스를 주입한다. */
export interface InlineAppDefinition {
  /** 앱 이름 */
  readonly name: string;
  /** 활성 라우트 매칭 함수 또는 경로 prefix */
  readonly activeWhen: string | readonly string[] | ((location: Location) => boolean);
  /** 마운트 대상 DOM 셀렉터 (기본값: '#app') */
  readonly container?: string;
  /** 직접 주입할 MfeApp 인스턴스 */
  readonly app: MfeApp;
}

/** createTestRegistry에 전달할 옵션 */
export interface TestRegistryOptions {
  /** 초기에 등록할 인라인 앱 목록 */
  readonly apps?: readonly InlineAppDefinition[];
}

/** 테스트 전용 AppRegistry 래퍼. mock 앱을 손쉽게 등록할 수 있다. */
export interface TestRegistry {
  /** 내부 AppRegistry 인스턴스 */
  readonly registry: AppRegistry;
  /**
   * mock 앱을 이름과 오버라이드만으로 간편히 등록한다.
   * @param name - 앱 이름
   * @param overrides - 라이프사이클 메서드 오버라이드
   * @returns 등록된 MockMfeApp 인스턴스
   */
  registerMockApp(
    name: string,
    overrides?: MockAppOverrides & { activeWhen?: string; container?: string },
  ): MockMfeApp;
}

/**
 * 테스트에 적합하도록 사전 구성된 AppRegistry를 생성한다.
 * 인라인 앱 정의를 받아 dynamic import 없이 직접 MfeApp을 주입한다.
 * @param options - 초기 앱 정의 등 옵션
 */
export function createTestRegistry(options?: TestRegistryOptions): TestRegistry {
  const registry = new AppRegistry();

  /** 인라인 앱을 레지스트리에 등록하고 즉시 로드된 상태로 설정한다. */
  const injectApp = (definition: InlineAppDefinition): void => {
    registry.registerApp({
      name: definition.name,
      activeWhen: definition.activeWhen,
      container: definition.container,
    });

    const registered = registry.getApp(definition.name);
    if (registered) {
      /**
       * 테스트 환경에서는 dynamic import를 우회하기 위해
       * RegisteredApp의 mutable 필드를 직접 설정한다.
       */
      (registered as { status: MfeAppStatus }).status = 'NOT_MOUNTED';
      (registered as { app?: MfeApp }).app = definition.app;
    }
  };

  const initialApps = options?.apps ?? [];
  for (const appDef of initialApps) {
    injectApp(appDef);
  }

  const registerMockApp = (
    name: string,
    overrides?: MockAppOverrides & { activeWhen?: string; container?: string },
  ): MockMfeApp => {
    const mockApp = createMockApp(overrides);
    injectApp({
      name,
      activeWhen: overrides?.activeWhen ?? `/${name}`,
      container: overrides?.container,
      app: mockApp,
    });
    return mockApp;
  };

  return {
    registry,
    registerMockApp,
  };
}
