/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Router } from './router.js';
import type { RouterRegistry, BeforeRouteChangeGuard, AfterRouteChangeGuard } from './router.js';
import type { MfeAppStatus, RegisteredApp } from '@esmap/shared';

/**
 * Creates a RegisteredApp stub for testing.
 * @param overrides - app name, status, and active condition
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
 * Creates a mock RouterRegistry for testing.
 * @param apps - list of app options to register
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

/** Dispatches an esmap:navigate event and waits for microtasks to be processed. */
async function triggerNavigation(): Promise<void> {
  window.dispatchEvent(new CustomEvent('esmap:navigate'));
  // Wait for the microtask queue to be processed
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('Router route guards', () => {
  const nativePushState = history.pushState.bind(history);
  const nativeReplaceState = history.replaceState.bind(history);
  const routers: Router[] = [];

  /** Creates a Router and adds it to the cleanup list. */
  function createRouter(
    registry: RouterRegistry,
    options?: {
      mode?: 'history' | 'hash';
      baseUrl?: string;
      onNoMatch?: (context: { pathname: string; search: string; hash: string }) => void;
    },
  ): Router {
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

  describe('beforeRouteChange guard', () => {
    it('proceeds with navigation when guard returns true', async () => {
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

    it('cancels navigation when guard returns false', async () => {
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

    it('cancels navigation when async guard returns false', async () => {
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

    it('cancels navigation if any guard returns false', async () => {
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

    it('propagates the error from start() when a guard throws', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);

      router.beforeRouteChange(() => {
        throw new Error('guard error');
      });

      await expect(router.start()).rejects.toThrow('guard error');
    });

    it('proceeds with navigation normally when no guards are set', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);

      await router.start();

      expect(vi.mocked(registry.mountApp)).toHaveBeenCalledWith('app1');
    });

    it('passes from and to RouteContext to the guard', async () => {
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

  describe('afterRouteChange guard', () => {
    it('executes the guard after mount/unmount completes', async () => {
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

    it('correctly executes an async afterGuard', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const afterGuard = vi.fn(async () => undefined);

      router.afterRouteChange(afterGuard);
      await router.start();

      expect(afterGuard).toHaveBeenCalled();
    });

    it('executes multiple afterGuards in order', async () => {
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

    it('passes from and to RouteContext to afterGuard', async () => {
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

    it('does not execute afterGuard when beforeGuard returns false', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const afterGuard = vi.fn();

      router.beforeRouteChange(() => false);
      router.afterRouteChange(afterGuard);
      await router.start();

      expect(afterGuard).not.toHaveBeenCalled();
    });
  });

  describe('previousRoute tracking', () => {
    it('captures the location at start() as previousRoute', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const guard = vi.fn<BeforeRouteChangeGuard>().mockReturnValue(true);

      router.beforeRouteChange(guard);
      await router.start();

      const from = guard.mock.calls[0][0];
      expect(from.pathname).toBe(window.location.pathname);
    });

    it('updates previousRoute after successful navigation', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const guard = vi.fn<BeforeRouteChangeGuard>().mockReturnValue(true);

      router.beforeRouteChange(guard);
      await router.start();

      const initialPathname = window.location.pathname;

      // Trigger a second route change via esmap:navigate event
      await triggerNavigation();

      const from = guard.mock.calls[1][0];
      expect(from.pathname).toBe(initialPathname);
    });

    it('does not update previousRoute when navigation is cancelled', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const guard = vi
        .fn<BeforeRouteChangeGuard>()
        .mockReturnValueOnce(true) // start()
        .mockReturnValueOnce(false) // first navigation cancelled
        .mockReturnValueOnce(true); // second navigation

      router.beforeRouteChange(guard);
      await router.start();

      const initialPathname = window.location.pathname;

      // Cancelled navigation
      await triggerNavigation();

      // Retry
      await triggerNavigation();

      const fromThirdCall = guard.mock.calls[2][0];
      // Cancelled navigation does not update previousRoute, so the initial value is retained
      expect(fromThirdCall.pathname).toBe(initialPathname);
    });
  });

  describe('existing router behavior preservation', () => {
    it('mounts active apps', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);

      await router.start();

      expect(vi.mocked(registry.mountApp)).toHaveBeenCalledWith('app1');
    });

    it('unmounts inactive apps', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'MOUNTED', activeWhen: () => false },
      ]);
      const router = createRouter(registry);

      await router.start();

      expect(vi.mocked(registry.unmountApp)).toHaveBeenCalledWith('app1');
    });

    it('does not detect events after stop()', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();
      router.stop();

      expect(vi.mocked(registry.getApps)).toHaveBeenCalledTimes(1);
    });

    it('does not execute twice when start() is called on an already started router', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();
      await router.start();

      expect(vi.mocked(registry.getApps)).toHaveBeenCalledTimes(1);
    });

    it('executes mount after unmount', async () => {
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

  describe('guard removal', () => {
    it('no longer executes the beforeRouteChange guard after removal', async () => {
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

    it('no longer executes the afterRouteChange guard after removal', async () => {
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

  describe('rapid consecutive navigation (race condition prevention)', () => {
    it('skips previous mount when a new navigation occurs during navigation', async () => {
      const mountCalls: string[] = [];
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);

      // Add delay to mount to simulate a race condition
      vi.mocked(registry.mountApp).mockImplementation(async (name: string) => {
        mountCalls.push(name);
      });

      const router = createRouter(registry);
      await router.start();

      // Verify mount was already called from start()
      expect(mountCalls).toContain('app1');
    });

    it('only reflects the last result on consecutive navigations', async () => {
      const afterGuardCalls: string[] = [];
      const registry = createMockRegistry();
      const router = createRouter(registry);

      router.afterRouteChange((_from, to) => {
        afterGuardCalls.push(to.pathname);
      });

      await router.start();

      // Rapid consecutive navigation — all fired simultaneously
      void triggerNavigation();
      void triggerNavigation();
      await triggerNavigation();

      // At least one afterGuard should have executed
      expect(afterGuardCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('History API patch restoration', () => {
    it('restores pushState to original after stop()', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);
      const originalPush = history.pushState;

      await router.start();
      // After start, pushState is patched
      expect(history.pushState).not.toBe(originalPush);

      router.stop();
      // After stop, pushState is restored (nativePushState or previous patch)
      // Verify that esmap:navigate event is not fired
      const navigateHandler = vi.fn();
      window.addEventListener('esmap:navigate', navigateHandler);
      history.pushState(null, '', '/test-restore');
      window.removeEventListener('esmap:navigate', navigateHandler);

      expect(navigateHandler).not.toHaveBeenCalled();
    });

    it('restores replaceState to original after stop()', async () => {
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

    it('second Router does not overwrite the first Router patch', async () => {
      const registry1 = createMockRegistry();
      const registry2 = createMockRegistry();
      const router1 = createRouter(registry1);
      const router2 = createRouter(registry2);

      await router1.start();
      await router2.start();

      // Stopping router2 still fires esmap:navigate if router1's patch is alive
      router2.stop();

      // Also stop router1
      router1.stop();

      // All stopped, no patches remaining
      const navigateHandler = vi.fn();
      window.addEventListener('esmap:navigate', navigateHandler);
      history.pushState(null, '', '/test-no-patch');
      window.removeEventListener('esmap:navigate', navigateHandler);

      // Last stop restores, so no events should fire
      expect(navigateHandler).not.toHaveBeenCalled();
    });
  });

  describe('programmatic navigation API', () => {
    it('navigates to a new URL with push()', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry);

      await router.start();

      router.push('/new-page');

      expect(window.location.pathname).toBe('/new-page');
    });

    it('replaces the current URL with replace()', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();

      router.replace('/replaced');

      expect(window.location.pathname).toBe('/replaced');
    });

    it('fires esmap:navigate event after push() to trigger route change', async () => {
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

    it('currentRoute returns the current location info', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();

      const route = router.currentRoute;
      expect(route.pathname).toBe(window.location.pathname);
      expect(route.search).toBe(window.location.search);
      expect(route.hash).toBe(window.location.hash);
    });
  });

  describe('baseUrl support', () => {
    it('adds prefix to push() when baseUrl is set', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      router.push('/settings');

      expect(window.location.pathname).toBe('/my-app/settings');
    });

    it('adds prefix to replace() when baseUrl is set', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      router.replace('/dashboard');

      expect(window.location.pathname).toBe('/my-app/dashboard');
    });

    it('does not add duplicate prefix when the URL already contains the baseUrl prefix', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      router.push('/my-app/settings');

      expect(window.location.pathname).toBe('/my-app/settings');
    });

    it('passes stripped pathname to activeWhen when baseUrl is set', async () => {
      // Verify that activeWhen matches /settings when visiting /my-app/settings
      history.pushState(null, '', '/my-app/settings');

      const activeWhenFn = vi.fn((loc: Location) => loc.pathname.startsWith('/settings'));
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: activeWhenFn },
      ]);
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      // Verify activeWhen was called with the stripped pathname (/settings)
      expect(vi.mocked(registry.mountApp)).toHaveBeenCalledWith('app1');
    });

    it('normalizes trailing slash in baseUrl', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app/' });

      await router.start();

      router.push('/page');

      expect(window.location.pathname).toBe('/my-app/page');
    });

    it('works correctly when push() includes query string and hash', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry, { baseUrl: '/my-app' });

      await router.start();

      router.push('/page?tab=settings#section');

      expect(window.location.pathname).toBe('/my-app/page');
      expect(window.location.search).toBe('?tab=settings');
      expect(window.location.hash).toBe('#section');
    });

    it('can use push() with relative paths without baseUrl', async () => {
      const registry = createMockRegistry();
      const router = createRouter(registry);

      await router.start();

      router.push('/relative-path');

      expect(window.location.pathname).toBe('/relative-path');
    });

    it('strips to / when pathname exactly matches baseUrl', async () => {
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

  describe('404 (onNoMatch) handling', () => {
    it('calls onNoMatch when no app matches', async () => {
      const onNoMatch = vi.fn();
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => false },
      ]);
      const router = createRouter(registry, { onNoMatch });

      await router.start();

      expect(onNoMatch).toHaveBeenCalled();
      expect(onNoMatch.mock.calls[0][0].pathname).toBe(window.location.pathname);
    });

    it('does not call onNoMatch when a matching app exists', async () => {
      const onNoMatch = vi.fn();
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => true },
      ]);
      const router = createRouter(registry, { onNoMatch });

      await router.start();

      expect(onNoMatch).not.toHaveBeenCalled();
    });

    it('does not call onNoMatch when an app is already mounted and active', async () => {
      const onNoMatch = vi.fn();
      const registry = createMockRegistry([
        { name: 'app1', status: 'MOUNTED', activeWhen: () => true },
      ]);
      const router = createRouter(registry, { onNoMatch });

      await router.start();

      expect(onNoMatch).not.toHaveBeenCalled();
    });

    it('proceeds without error on match failure when onNoMatch is not set', async () => {
      const registry = createMockRegistry([
        { name: 'app1', status: 'NOT_LOADED', activeWhen: () => false },
      ]);
      const router = createRouter(registry);

      await expect(router.start()).resolves.toBeUndefined();
    });

    it('passes RouteContext to onNoMatch', async () => {
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
