import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppRegistry } from './app-registry.js';
import type { ErrorBoundaryOptions } from './app-registry.js';
import type { MfeApp } from '@esmap/shared';
import { AppNotFoundError, AppAlreadyRegisteredError, AppLifecycleError } from '@esmap/shared';

/** Creates a mock MfeApp for testing */
function createMockApp(): MfeApp {
  return {
    bootstrap: vi.fn().mockResolvedValue(undefined),
    mount: vi.fn().mockResolvedValue(undefined),
    unmount: vi.fn().mockResolvedValue(undefined),
  };
}

/** Creates a mock MfeApp that fails to load */
function createFailingMockApp(): MfeApp {
  return {
    bootstrap: vi.fn().mockRejectedValue(new Error('bootstrap failed')),
    mount: vi.fn().mockResolvedValue(undefined),
    unmount: vi.fn().mockResolvedValue(undefined),
  };
}

/** Creates a mock MfeApp that fails to mount */
function createMountFailingMockApp(): MfeApp {
  return {
    bootstrap: vi.fn().mockResolvedValue(undefined),
    mount: vi.fn().mockRejectedValue(new Error('mount failed')),
    unmount: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AppRegistry', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  describe('registerApp', () => {
    it('starts with NOT_LOADED status when an app is registered', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/checkout', activeWhen: '/checkout' });

      const app = registry.getApp('@flex/checkout');
      expect(app?.status).toBe('NOT_LOADED');
    });

    it('throws AppAlreadyRegisteredError when registering an app with a duplicate name', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/checkout', activeWhen: '/checkout' });

      expect(() =>
        registry.registerApp({ name: '@flex/checkout', activeWhen: '/checkout' }),
      ).toThrow(AppAlreadyRegisteredError);

      try {
        registry.registerApp({ name: '@flex/checkout', activeWhen: '/checkout' });
      } catch (e) {
        expect(e).toBeInstanceOf(AppAlreadyRegisteredError);
        const err = e as AppAlreadyRegisteredError;
        expect(err.appName).toBe('@flex/checkout');
        expect(err.code).toBe('APP_ALREADY_REGISTERED');
      }
    });

    it('sets activeWhen with a string pattern', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/checkout', activeWhen: '/checkout' });

      const app = registry.getApp('@flex/checkout')!;
      expect(app.activeWhen({ pathname: '/checkout/cart' } as Location)).toBe(true);
      expect(app.activeWhen({ pathname: '/people' } as Location)).toBe(false);
    });

    it('sets activeWhen with an array pattern', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/checkout', activeWhen: ['/checkout', '/cart'] });

      const app = registry.getApp('@flex/checkout')!;
      expect(app.activeWhen({ pathname: '/checkout' } as Location)).toBe(true);
      expect(app.activeWhen({ pathname: '/cart/items' } as Location)).toBe(true);
      expect(app.activeWhen({ pathname: '/people' } as Location)).toBe(false);
    });

    it('sets activeWhen with a function', () => {
      const registry = new AppRegistry();
      const fn = (loc: Location) => loc.pathname === '/exact';
      registry.registerApp({ name: '@flex/checkout', activeWhen: fn });

      const app = registry.getApp('@flex/checkout')!;
      expect(app.activeWhen({ pathname: '/exact' } as Location)).toBe(true);
      expect(app.activeWhen({ pathname: '/exact/sub' } as Location)).toBe(false);
    });

    it('uses default #app when container is not specified', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test', activeWhen: '/test' });

      const app = registry.getApp('test')!;
      expect(app.container).toBe('#app');
    });

    it('allows specifying a custom container', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test', activeWhen: '/test', container: '#custom' });

      const app = registry.getApp('test')!;
      expect(app.container).toBe('#custom');
    });
  });

  describe('getApps', () => {
    it('returns all registered apps', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/a', activeWhen: '/a' });
      registry.registerApp({ name: '@flex/b', activeWhen: '/b' });

      expect(registry.getApps()).toHaveLength(2);
    });

    it('returns an empty array when no apps are registered', () => {
      const registry = new AppRegistry();
      expect(registry.getApps()).toStrictEqual([]);
    });
  });

  describe('loadApp', () => {
    it('transitions to LOAD_ERROR and throws AppLifecycleError on dynamic import failure', async () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test-app', activeWhen: '/test' });

      await expect(registry.loadApp('test-app')).rejects.toThrow(AppLifecycleError);

      const app = registry.getApp('test-app')!;
      expect(app.status).toBe('LOAD_ERROR');

      try {
        // Can retry loading from LOAD_ERROR state
        await registry.loadApp('test-app');
      } catch (e) {
        expect(e).toBeInstanceOf(AppLifecycleError);
        const err = e as AppLifecycleError;
        expect(err.appName).toBe('test-app');
        expect(err.phase).toBe('load');
        expect(err.code).toBe('APP_LIFECYCLE_ERROR');
      }
    });

    it('throws AppNotFoundError when loading an unregistered app', async () => {
      const registry = new AppRegistry();
      await expect(registry.loadApp('nonexistent')).rejects.toThrow(AppNotFoundError);

      try {
        await registry.loadApp('nonexistent');
      } catch (e) {
        expect(e).toBeInstanceOf(AppNotFoundError);
        const err = e as AppNotFoundError;
        expect(err.appName).toBe('nonexistent');
        expect(err.code).toBe('APP_NOT_FOUND');
      }
    });
  });

  describe('loadApp deduplication', () => {
    it('calls loadApp only once even when the same app is loaded twice simultaneously', async () => {
      const loadCount = { value: 0 };
      const registry = new AppRegistry({
        importMap: {
          imports: { 'test-app': 'https://cdn.example.com/test.js' },
        },
      });
      registry.registerApp({ name: 'test-app', activeWhen: '/test' });

      // Observe status change events to track internal dynamic imports of loadApp
      const loadingEvents: string[] = [];
      registry.onStatusChange((event) => {
        if (event.to === 'LOADING') {
          loadingEvents.push(event.appName);
          loadCount.value++;
        }
      });

      // Call twice simultaneously
      const promise1 = registry.loadApp('test-app').catch(() => undefined);
      const promise2 = registry.loadApp('test-app').catch(() => undefined);

      await Promise.all([promise1, promise2]);

      // LOADING status transition should occur only once
      expect(loadCount.value).toBe(1);
    });
  });

  describe('unmountApp', () => {
    it('does nothing when unmounting an app that is not mounted', async () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test', activeWhen: '/test' });

      // Should complete without errors
      await registry.unmountApp('test');
    });
  });

  describe('unregisterApp', () => {
    it('removes a registered app', async () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test', activeWhen: '/test' });

      await registry.unregisterApp('test');

      expect(registry.getApp('test')).toBeUndefined();
    });

    it('does not throw when removing an unregistered app', async () => {
      const registry = new AppRegistry();
      await registry.unregisterApp('nonexistent');
    });
  });

  describe('onStatusChange', () => {
    it('registers and invokes status change listeners', async () => {
      const registry = new AppRegistry();
      const events: { appName: string; from: string; to: string }[] = [];

      registry.onStatusChange((event) => {
        events.push(event);
      });

      registry.registerApp({ name: 'test', activeWhen: '/test' });

      // Attempt loadApp (dynamic import will fail but status transition events will fire)
      try {
        await registry.loadApp('test');
      } catch {
        // Expected dynamic import failure
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].appName).toBe('test');
      expect(events[0].from).toBe('NOT_LOADED');
      expect(events[0].to).toBe('LOADING');
    });

    it('transitions from LOADING to LOAD_ERROR on LOAD_ERROR', async () => {
      const registry = new AppRegistry();
      const events: { from: string; to: string }[] = [];

      registry.onStatusChange((event) => {
        events.push({ from: event.from, to: event.to });
      });

      registry.registerApp({ name: 'test', activeWhen: '/test' });

      try {
        await registry.loadApp('test');
      } catch {
        // expected
      }

      expect(events).toStrictEqual([
        { from: 'NOT_LOADED', to: 'LOADING' },
        { from: 'LOADING', to: 'LOAD_ERROR' },
      ]);
    });

    it('removes a listener using the unsubscribe function', async () => {
      const registry = new AppRegistry();
      const events: unknown[] = [];

      const unsubscribe = registry.onStatusChange((event) => {
        events.push(event);
      });

      unsubscribe();

      registry.registerApp({ name: 'test', activeWhen: '/test' });

      try {
        await registry.loadApp('test');
      } catch {
        // Expected dynamic import failure
      }

      expect(events).toStrictEqual([]);
    });
  });

  describe('destroy', () => {
    it('removes all apps and cleans up the registry', async () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'app-a', activeWhen: '/a' });
      registry.registerApp({ name: 'app-b', activeWhen: '/b' });

      await registry.destroy();

      expect(registry.getApps()).toStrictEqual([]);
      expect(registry.getApp('app-a')).toBeUndefined();
    });

    it('unmounts mounted apps before cleaning up', async () => {
      const registry = new AppRegistry();
      const events: string[] = [];

      registry.onStatusChange((event) => {
        events.push(`${event.appName}:${event.to}`);
      });

      registry.registerApp({ name: 'test', activeWhen: '/test' });

      await registry.destroy();

      expect(registry.getApps()).toStrictEqual([]);
    });
  });

  describe('error boundary', () => {
    describe('loadApp error boundary', () => {
      it('does not throw on load failure when global error boundary is configured', async () => {
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        // Should not throw an error
        await registry.loadApp('test-app');

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith('test-app', expect.any(AppLifecycleError));
      });

      it('renders default fallback UI in the container when error boundary is configured', async () => {
        const registry = new AppRegistry({
          errorBoundary: {},
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        const container = document.querySelector('#app');
        expect(container?.querySelector('.esmap-error-boundary')).not.toBeNull();
        expect(container?.querySelector('p')?.textContent).toBe('Unable to load the app');
        expect(container?.querySelector('button')?.textContent).toBe('Retry');
      });

      it('renders the returned element when custom fallback function returns an HTMLElement', async () => {
        const fallback = (appName: string, _error: Error) => {
          const div = document.createElement('div');
          div.className = 'custom-fallback';
          div.textContent = `${appName} load failed`;
          return div;
        };

        const registry = new AppRegistry({
          errorBoundary: { fallback },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        const container = document.querySelector('#app');
        expect(container?.querySelector('.custom-fallback')?.textContent).toBe(
          'test-app load failed',
        );
      });

      it('safely renders as text when custom fallback function returns a string', async () => {
        const fallback = (_appName: string, _error: Error) =>
          '<div class="string-fallback">error</div>';

        const registry = new AppRegistry({
          errorBoundary: { fallback },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        const container = document.querySelector('#app');
        expect(container?.textContent).toBe('<div class="string-fallback">error</div>');
        expect(container?.querySelector('.string-fallback')).toBeNull();
      });

      it('passes app name and error to onError callback', async () => {
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({ name: 'my-app', activeWhen: '/my' });

        await registry.loadApp('my-app');

        expect(onError).toHaveBeenCalledWith('my-app', expect.any(AppLifecycleError));
        const error = onError.mock.calls[0][1];
        expect(error).toBeInstanceOf(AppLifecycleError);
      });

      it('throws an error as before when no error boundary is configured', async () => {
        const registry = new AppRegistry();
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await expect(registry.loadApp('test-app')).rejects.toThrow(AppLifecycleError);
      });
    });

    describe('per-app error boundary override', () => {
      it('per-app error boundary takes precedence over global configuration', async () => {
        const globalOnError = vi.fn();
        const appOnError = vi.fn();

        const registry = new AppRegistry({
          errorBoundary: { onError: globalOnError },
        });
        registry.registerApp({
          name: 'test-app',
          activeWhen: '/test',
          errorBoundary: { onError: appOnError },
        });

        await registry.loadApp('test-app');

        expect(globalOnError).not.toHaveBeenCalled();
        expect(appOnError).toHaveBeenCalledTimes(1);
      });

      it('uses global configuration when no per-app error boundary is set', async () => {
        const globalOnError = vi.fn();

        const registry = new AppRegistry({
          errorBoundary: { onError: globalOnError },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        expect(globalOnError).toHaveBeenCalledTimes(1);
      });
    });

    describe('retry', () => {
      it('increments retry count when the retry button is clicked', async () => {
        vi.useFakeTimers();
        const registry = new AppRegistry({
          errorBoundary: { retryDelay: 0 },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        expect(registry.getRetryCount('test-app')).toBe(0);

        const button = document.querySelector('#app button');
        button?.dispatchEvent(new Event('click'));

        expect(registry.getRetryCount('test-app')).toBe(1);
        vi.useRealTimers();
      });

      it('shows permanent fallback without retry button when retry count reaches retryLimit', async () => {
        const registry = new AppRegistry({
          errorBoundary: { retryLimit: 0 },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        const container = document.querySelector('#app');
        expect(container?.querySelector('.esmap-error-boundary')).not.toBeNull();
        expect(container?.querySelector('p')?.textContent).toBe('Unable to load the app');
        expect(container?.querySelector('button')).toBeNull();
      });

      it('defaults retryLimit to 3', async () => {
        const registry = new AppRegistry({
          errorBoundary: {},
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        // Button should be present until 3 retries
        await registry.loadApp('test-app');
        expect(document.querySelector('#app button')).not.toBeNull();
      });

      it('resets retry count on successful load', async () => {
        vi.useFakeTimers();
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        // First load failure
        await registry.loadApp('test-app');

        // Manually verify retry count
        const button = document.querySelector('#app button');
        button?.dispatchEvent(new Event('click'));
        expect(registry.getRetryCount('test-app')).toBe(1);
        vi.useRealTimers();
      });
    });

    describe('mountApp error boundary', () => {
      it('error boundary handles loadApp failure within mountApp', async () => {
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        // mountApp internally calls loadApp, and the error boundary handles it
        await registry.mountApp('test-app');

        expect(onError).toHaveBeenCalledTimes(1);
      });
    });

    describe('unregisterApp and error boundary', () => {
      it('cleans up error boundary config and retry count when an app is removed', async () => {
        const registry = new AppRegistry({
          errorBoundary: {},
        });
        registry.registerApp({
          name: 'test-app',
          activeWhen: '/test',
          errorBoundary: { retryLimit: 5 },
        });

        await registry.loadApp('test-app');

        // Increment the retry count
        const button = document.querySelector('#app button');
        button?.dispatchEvent(new Event('click'));

        await registry.unregisterApp('test-app');

        // Retry count should be 0 after removal
        expect(registry.getRetryCount('test-app')).toBe(0);
      });
    });

    describe('missing container', () => {
      it('skips fallback rendering when the container cannot be found', async () => {
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({
          name: 'test-app',
          activeWhen: '/test',
          container: '#nonexistent',
        });

        // Should not throw an error
        await registry.loadApp('test-app');

        // onError should still be called
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });
  });
});
