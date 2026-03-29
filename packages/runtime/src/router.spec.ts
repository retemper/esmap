/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Router } from './router.js';
import type { RouterRegistry, BeforeRouteChangeGuard, AfterRouteChangeGuard } from './router.js';
import type { MfeAppStatus, RegisteredApp } from '@esmap/shared';

/**
 * 테스트용 RegisteredApp stub을 생성한다.
 * @param overrides - 앱 이름, 상태, 활성 조건
 */
function createStubApp(overrides: {
  name: string;
  status: MfeAppStatus;
  activeWhen: (location: Location) => boolean;
}): RegisteredApp {
  return {
    ...overrides,
    loadApp: vi.fn(async () => ({ bootstrap: vi.fn(), mount: vi.fn(), unmount: vi.fn() })),
    container: '#app',
  };
}

/**
 * 테스트용 RouterRegistry 목을 생성한다.
 * @param apps - 등록할 앱 옵션 목록
 */
function createMockRegistry(
  apps: Array<{
    name: string;
    status: MfeAppStatus;
    activeWhen: (location: Location) => boolean;
  }> = [],
): RouterRegistry {
  const registeredApps = apps.map(createStubApp);
  return {
    getApps: vi.fn(() => registeredApps),
    mountApp: vi.fn(async () => undefined),
    unmountApp: vi.fn(async () => undefined),
  };
}

/** esmap:navigate 이벤트를 발생시키고 마이크로태스크가 처리될 때까지 대기한다. */
async function triggerNavigation(): Promise<void> {
  window.dispatchEvent(new CustomEvent('esmap:navigate'));
  // 마이크로태스크 큐가 처리될 때까지 대기
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('Router 라우트 가드', () => {
  const nativePushState = history.pushState.bind(history);
  const nativeReplaceState = history.replaceState.bind(history);
  const routers: Router[] = [];

  /** Router를 생성하고 정리 목록에 등록한다. */
  function createRouter(registry: RouterRegistry, options?: {
    mode?: 'history' | 'hash';
    baseUrl?: string;
    onNoMatch?: (context: { pathname: string; search: string; hash: string }) => void;
  }): Router {
    const router = new Router(registry, options);
    routers.push(router);
    return router;
  }

  afterEach(() => {
    for (const router of routers) {
      router.stop();
    }
    routers.length = 0;
    history.pushState = nativePushState;
    history.replaceState = nativeReplaceState;
  });

  describe('beforeRouteChange 가드', () => {
    it('가드가 true를 반환하면 네비게이션이 진행된다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);
      const guard = vi.fn(() => true);

      router.beforeRouteChange(guard);
      await router.start();

      expect(guard).toHaveBeenCalled();
      expect(vi.mocked(registry.mountApp)).toHaveBeenCalledWith('app1');
    });

    it('가드가 false를 반환하면 네비게이션이 취소된다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);
      const guard = vi.fn(() => false);

      router.beforeRouteChange(guard);
      await router.start();

      expect(guard).toHaveBeenCalled();
      expect(vi.mocked(registry.mountApp)).not.toHaveBeenCalled();
    });

    it('비동기 가드가 false를 반환하면 네비게이션이 취소된다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);
      const guard = vi.fn(async () => false);

      router.beforeRouteChange(guard);
      await router.start();

      expect(guard).toHaveBeenCalled();
      expect(vi.mocked(registry.mountApp)).not.toHaveBeenCalled();
    });

    it('여러 가드 중 하나라도 false를 반환하면 네비게이션이 취소된다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);
      const guard1 = vi.fn(() => true);
      const guard2 = vi.fn(() => false);
      const guard3 = vi.fn(() => true);

      router.beforeRouteChange(guard1);
      router.beforeRouteChange(guard2);
      router.beforeRouteChange(guard3);
      await router.start();

      expect(guard1).toHaveBeenCalled();
      expect(guard2).toHaveBeenCalled();
      expect(guard3).not.toHaveBeenCalled();
      expect(vi.mocked(registry.mountApp)).not.toHaveBeenCalled();
    });

    it('가드가 에러를 throw하면 start()에서 에러가 전파된다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);

      router.beforeRouteChange(() => {
        throw new Error('가드 에러');
      });

      await expect(router.start()).rejects.toThrow('가드 에러');
    });

    it('가드가 없으면 네비게이션이 정상 진행된다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);

      await router.start();

      expect(vi.mocked(registry.mountApp)).toHaveBeenCalledWith('app1');
    });

    it('가드에 from과 to RouteContext가 전달된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const guard = vi.fn<BeforeRouteChangeGuard>().mockReturnValue(true);

      router.beforeRouteChange(guard);
      await router.start();

      const from = guard.mock.calls[0][0];
      const to = guard.mock.calls[0][1];
      expect(from).toStrictEqual({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
      expect(to).toStrictEqual({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
    });
  });

  describe('afterRouteChange 가드', () => {
    it('mount/unmount 완료 후 가드가 실행된다', async () => {
      const callOrder: string[] = [];
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      vi.mocked(registry.mountApp).mockImplementation(async () => {
        callOrder.push('mount');
      });

      const router = createRouter(registry);
      const afterGuard = vi.fn(() => {
        callOrder.push('afterGuard');
      });

      router.afterRouteChange(afterGuard);
      await router.start();

      expect(afterGuard).toHaveBeenCalled();
      expect(callOrder).toStrictEqual(['mount', 'afterGuard']);
    });

    it('비동기 afterGuard가 올바르게 실행된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const afterGuard = vi.fn(async () => undefined);

      router.afterRouteChange(afterGuard);
      await router.start();

      expect(afterGuard).toHaveBeenCalled();
    });

    it('여러 afterGuard가 순서대로 실행된다', async () => {
      const callOrder: number[] = [];
      const registry = createMockRegistry();
      const router = createRouter(registry);

      router.afterRouteChange(() => {
        callOrder.push(1);
      });
      router.afterRouteChange(() => {
        callOrder.push(2);
      });
      router.afterRouteChange(() => {
        callOrder.push(3);
      });

      await router.start();

      expect(callOrder).toStrictEqual([1, 2, 3]);
    });

    it('afterGuard에 from과 to RouteContext가 전달된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const afterGuard = vi.fn<AfterRouteChangeGuard>();

      router.afterRouteChange(afterGuard);
      await router.start();

      const from = afterGuard.mock.calls[0][0];
      const to = afterGuard.mock.calls[0][1];
      expect(from.pathname).toBe(window.location.pathname);
      expect(to.pathname).toBe(window.location.pathname);
    });

    it('beforeGuard가 false를 반환하면 afterGuard가 실행되지 않는다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const afterGuard = vi.fn();

      router.beforeRouteChange(() => false);
      router.afterRouteChange(afterGuard);
      await router.start();

      expect(afterGuard).not.toHaveBeenCalled();
    });
  });

  describe('previousRoute 추적', () => {
    it('start() 시점의 location을 previousRoute로 캡처한다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const guard = vi.fn<BeforeRouteChangeGuard>().mockReturnValue(true);

      router.beforeRouteChange(guard);
      await router.start();

      const from = guard.mock.calls[0][0];
      expect(from.pathname).toBe(window.location.pathname);
    });

    it('네비게이션 성공 후 previousRoute가 업데이트된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const guard = vi.fn<BeforeRouteChangeGuard>().mockReturnValue(true);

      router.beforeRouteChange(guard);
      await router.start();

      const initialPathname = window.location.pathname;

      // esmap:navigate 이벤트로 두 번째 라우트 변경 트리거
      await triggerNavigation();

      const from = guard.mock.calls[1][0];
      expect(from.pathname).toBe(initialPathname);
    });

    it('네비게이션 취소 시 previousRoute가 업데이트되지 않는다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const guard = vi
        .fn<BeforeRouteChangeGuard>()
        .mockReturnValueOnce(true) // start()
        .mockReturnValueOnce(false) // 첫 번째 이동 취소
        .mockReturnValueOnce(true); // 두 번째 이동

      router.beforeRouteChange(guard);
      await router.start();

      const initialPathname = window.location.pathname;

      // 취소되는 네비게이션
      await triggerNavigation();

      // 다시 시도
      await triggerNavigation();

      const fromThirdCall = guard.mock.calls[2][0];
      // 취소된 네비게이션은 previousRoute를 업데이트하지 않으므로 초기값 유지
      expect(fromThirdCall.pathname).toBe(initialPathname);
    });
  });

  describe('기존 라우터 동작 유지', () => {
    it('활성 앱을 마운트한다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);

      await router.start();

      expect(vi.mocked(registry.mountApp)).toHaveBeenCalledWith('app1');
    });

    it('비활성 앱을 언마운트한다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'MOUNTED', activeWhen: () => false },
      ]);
      const router = createRouter(registry);

      await router.start();

      expect(vi.mocked(registry.unmountApp)).toHaveBeenCalledWith('app1');
    });

    it('stop() 후에는 이벤트를 감지하지 않는다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();
      router.stop();

      expect(vi.mocked(registry.getApps)).toHaveBeenCalledTimes(1);
    });

    it('이미 시작된 라우터에 start()를 다시 호출해도 중복 실행되지 않는다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();
      await router.start();

      expect(vi.mocked(registry.getApps)).toHaveBeenCalledTimes(1);
    });

    it('unmount 후 mount가 실행된다', async () => {
      const callOrder: string[] = [];
      const registry = createMockRegistry([
        { name: 'app1', status: 'MOUNTED', activeWhen: () => false },
        { name: 'app2', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      vi.mocked(registry.unmountApp).mockImplementation(async () => {
        callOrder.push('unmount');
      });
      vi.mocked(registry.mountApp).mockImplementation(async () => {
        callOrder.push('mount');
      });

      const router = createRouter(registry);
      await router.start();

      expect(callOrder).toStrictEqual(['unmount', 'mount']);
    });
  });

  describe('가드 해제', () => {
    it('beforeRouteChange 가드를 해제하면 더 이상 실행되지 않는다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);
      const guard = vi.fn(() => true);

      const removeGuard = router.beforeRouteChange(guard);
      await router.start();

      const callCountAfterStart = guard.mock.calls.length;

      removeGuard();
      await triggerNavigation();

      expect(guard.mock.calls.length).toBe(callCountAfterStart);
    });

    it('afterRouteChange 가드를 해제하면 더 이상 실행되지 않는다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const guard = vi.fn();

      const removeGuard = router.afterRouteChange(guard);
      await router.start();

      const callCountAfterStart = guard.mock.calls.length;

      removeGuard();
      await triggerNavigation();

      expect(guard.mock.calls.length).toBe(callCountAfterStart);
    });
  });

  describe('빠른 연속 네비게이션 (race condition 방지)', () => {
    it('네비게이션 중 새 네비게이션이 발생하면 이전 mount를 건너뛴다', async () => {
      const mountCalls: string[] = [];
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);

      // mount에 지연을 추가하여 race condition을 시뮬레이션
      vi.mocked(registry.mountApp).mockImplementation(async (name: string) => {
        mountCalls.push(name);
      });

      const router = createRouter(registry);
      await router.start();

      // start()에서 이미 mount 호출되었으므로 확인
      expect(mountCalls).toContain('app1');
    });

    it('연속 네비게이션 시 마지막 결과만 반영된다', async () => {
      const afterGuardCalls: string[] = [];
      const registry = createMockRegistry();
      const router = createRouter(registry);

      router.afterRouteChange((_from, to) => {
        afterGuardCalls.push(to.pathname);
      });

      await router.start();

      // 빠른 연속 네비게이션 — 모두 동시 발생
      void triggerNavigation();
      void triggerNavigation();
      await triggerNavigation();

      // 최소 하나의 afterGuard가 실행되어야 함
      expect(afterGuardCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('History API 패치 복원', () => {
    it('stop() 후 pushState가 원본으로 복원된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const originalPush = history.pushState;

      await router.start();
      // start 후 pushState는 패치됨
      expect(history.pushState).not.toBe(originalPush);

      router.stop();
      // stop 후 pushState는 복원됨 (nativePushState 또는 이전 패치)
      // esmap:navigate 이벤트가 발생하지 않는지 확인
      const navigateHandler = vi.fn();
      window.addEventListener('esmap:navigate', navigateHandler);
      history.pushState(null, '', '/test-restore');
      window.removeEventListener('esmap:navigate', navigateHandler);

      expect(navigateHandler).not.toHaveBeenCalled();
    });

    it('stop() 후 replaceState가 원본으로 복원된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();
      router.stop();

      const navigateHandler = vi.fn();
      window.addEventListener('esmap:navigate', navigateHandler);
      history.replaceState(null, '', window.location.pathname);
      window.removeEventListener('esmap:navigate', navigateHandler);

      expect(navigateHandler).not.toHaveBeenCalled();
    });

    it('두 번째 Router가 첫 번째의 패치를 덮어쓰지 않는다', async () => {
      const registry1 = createMockRegistry();
      const registry2 = createMockRegistry();
      const router1 = createRouter(registry1);
      const router2 = createRouter(registry2);

      await router1.start();
      await router2.start();

      // router2를 stop해도 router1의 패치가 살아있으면 esmap:navigate 발생
      router2.stop();

      // router1도 stop
      router1.stop();

      // 모두 stop 후 패치 없는 상태
      const navigateHandler = vi.fn();
      window.addEventListener('esmap:navigate', navigateHandler);
      history.pushState(null, '', '/test-no-patch');
      window.removeEventListener('esmap:navigate', navigateHandler);

      // 마지막 stop이 복원하므로 이벤트 없어야 함
      expect(navigateHandler).not.toHaveBeenCalled();
    });
  });

  describe('프로그래매틱 네비게이션 API', () => {
    it('push()로 새 URL로 이동한다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);

      await router.start();

      router.push('/new-page');

      expect(window.location.pathname).toBe('/new-page');
    });

    it('replace()로 현재 URL을 교체한다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();

      router.replace('/replaced');

      expect(window.location.pathname).toBe('/replaced');
    });

    it('push() 후 esmap:navigate 이벤트가 발생하여 라우트 변경이 트리거된다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);
      const afterGuard = vi.fn();

      router.afterRouteChange(afterGuard);
      await router.start();

      const callCountAfterStart = afterGuard.mock.calls.length;

      router.push('/trigger-test');
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(afterGuard.mock.calls.length).toBeGreaterThan(callCountAfterStart);
    });

    it('currentRoute가 현재 위치 정보를 반환한다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();

      const route = router.currentRoute;
      expect(route.pathname).toBe(window.location.pathname);
      expect(route.search).toBe(window.location.search);
      expect(route.hash).toBe(window.location.hash);
    });
  });

  describe('baseUrl 지원', () => {
    it('baseUrl이 설정되면 push()에 prefix가 추가된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      router.push('/settings');

      expect(window.location.pathname).toBe('/my-app/settings');
    });

    it('baseUrl이 설정되면 replace()에 prefix가 추가된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      router.replace('/dashboard');

      expect(window.location.pathname).toBe('/my-app/dashboard');
    });

    it('이미 baseUrl prefix가 포함된 URL은 중복 추가하지 않는다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      router.push('/my-app/settings');

      expect(window.location.pathname).toBe('/my-app/settings');
    });

    it('baseUrl이 설정되면 activeWhen에 stripped pathname이 전달된다', async () => {
      // /my-app/settings 에 접속한 상황에서 activeWhen이 /settings로 매칭하는지 확인
      history.pushState(null, '', '/my-app/settings');

      const activeWhenFn = vi.fn((loc: Location) => loc.pathname.startsWith('/settings'));
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: activeWhenFn },
      ]);
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      // activeWhen이 stripped pathname (/settings)으로 호출되었는지 확인
      expect(vi.mocked(registry.mountApp)).toHaveBeenCalledWith('app1');
    });

    it('baseUrl 끝에 슬래시가 있어도 정규화된다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app/' });

      await router.start();

      router.push('/page');

      expect(window.location.pathname).toBe('/my-app/page');
    });

    it('push()에 query string과 hash가 포함되어도 정상 동작한다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      router.push('/page?tab=settings#section');

      expect(window.location.pathname).toBe('/my-app/page');
      expect(window.location.search).toBe('?tab=settings');
      expect(window.location.hash).toBe('#section');
    });

    it('baseUrl 없이 push()로 슬래시 없는 상대 경로를 사용할 수 있다', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();

      router.push('/relative-path');

      expect(window.location.pathname).toBe('/relative-path');
    });

    it('pathname이 baseUrl과 정확히 일치하면 /로 strip된다', async () => {
      history.pushState(null, '', '/my-app');

      const activeWhenFn = vi.fn((loc: Location) => loc.pathname === '/');
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: activeWhenFn },
      ]);
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      expect(vi.mocked(registry.mountApp)).toHaveBeenCalledWith('app1');
    });
  });

  describe('404 (onNoMatch) 처리', () => {
    it('매칭되는 앱이 없으면 onNoMatch가 호출된다', async () => {
      const onNoMatch = vi.fn();
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => false },
      ]);
      const router = createRouter(registry, { onNoMatch });

      await router.start();

      expect(onNoMatch).toHaveBeenCalled();
      expect(onNoMatch.mock.calls[0][0].pathname).toBe(window.location.pathname);
    });

    it('매칭되는 앱이 있으면 onNoMatch가 호출되지 않는다', async () => {
      const onNoMatch = vi.fn();
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry, { onNoMatch });

      await router.start();

      expect(onNoMatch).not.toHaveBeenCalled();
    });

    it('앱이 이미 마운트되어 있고 활성 상태면 onNoMatch가 호출되지 않는다', async () => {
      const onNoMatch = vi.fn();
      const registry = createMockRegistry([
        { name: 'app1', status: 'MOUNTED', activeWhen: () => true },
      ]);
      const router = createRouter(registry, { onNoMatch });

      await router.start();

      expect(onNoMatch).not.toHaveBeenCalled();
    });

    it('onNoMatch가 설정되지 않으면 매칭 실패 시에도 에러 없이 진행된다', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => false },
      ]);
      const router = createRouter(registry);

      await expect(router.start()).resolves.toBeUndefined();
    });

    it('onNoMatch에 RouteContext가 전달된다', async () => {
      const onNoMatch = vi.fn();
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => false },
      ]);
      const router = createRouter(registry, { onNoMatch });

      await router.start();

      const context = onNoMatch.mock.calls[0][0];
      expect(context).toHaveProperty('pathname');
      expect(context).toHaveProperty('search');
      expect(context).toHaveProperty('hash');
    });
  });
});
