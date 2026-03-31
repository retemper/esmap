import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPrefetch } from './prefetch.js';
import type { PrefetchAppConfig } from './prefetch.js';

/** Creates an app config for testing */
function createApp(name: string, url?: string): PrefetchAppConfig {
  return { name, url: url ?? `https://cdn.example.com/${name}.js` };
}

describe('createPrefetch', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('immediate strategy', () => {
    it('immediately adds modulepreload links for all apps when start is called', () => {
      const apps = [createApp('app-a'), createApp('app-b')];
      const controller = createPrefetch({ strategy: 'immediate', apps });

      controller.start();

      const links = document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]');
      expect(links).toHaveLength(2);
      expect(links[0].href).toBe(apps[0].url);
      expect(links[1].href).toBe(apps[1].url);
    });

    it('returns the list of prefetched apps', () => {
      const apps = [createApp('app-a'), createApp('app-b')];
      const controller = createPrefetch({ strategy: 'immediate', apps });

      controller.start();

      expect(controller.getPrefetchedApps()).toStrictEqual(['app-a', 'app-b']);
    });
  });

  describe('idle strategy', () => {
    it('uses requestIdleCallback when available', () => {
      const callbacks: (() => void)[] = [];
      vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
        callbacks.push(cb);
        return callbacks.length;
      });
      vi.stubGlobal('cancelIdleCallback', vi.fn());

      const apps = [createApp('app-a')];
      const controller = createPrefetch({ strategy: 'idle', apps });

      controller.start();

      expect(controller.getPrefetchedApps()).toStrictEqual([]);

      for (const cb of callbacks) {
        cb();
      }

      expect(controller.getPrefetchedApps()).toStrictEqual(['app-a']);
    });

    it('falls back to setTimeout 200ms when requestIdleCallback is unavailable', () => {
      vi.useFakeTimers();
      const original = globalThis.requestIdleCallback;
      // @ts-expect-error -- intentionally set to undefined for testing
      globalThis.requestIdleCallback = undefined;

      const apps = [createApp('app-a')];
      const controller = createPrefetch({ strategy: 'idle', apps });

      controller.start();

      expect(controller.getPrefetchedApps()).toStrictEqual([]);

      vi.advanceTimersByTime(200);

      expect(controller.getPrefetchedApps()).toStrictEqual(['app-a']);

      globalThis.requestIdleCallback = original;
      vi.useRealTimers();
    });

    it('cancels pending callbacks when stop is called', () => {
      const cancelMock = vi.fn();
      vi.stubGlobal('requestIdleCallback', () => 42);
      vi.stubGlobal('cancelIdleCallback', cancelMock);

      const apps = [createApp('app-a')];
      const controller = createPrefetch({ strategy: 'idle', apps });

      controller.start();
      controller.stop();

      expect(cancelMock).toHaveBeenCalledWith(42);
    });
  });

  describe('deduplication', () => {
    it('adds only one link even when the same app is prefetched twice', () => {
      const app = createApp('app-a');
      const controller = createPrefetch({ strategy: 'immediate', apps: [app] });

      controller.start();
      controller.prefetchApp(app);

      const links = document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]');
      expect(links).toHaveLength(1);
    });
  });

  describe('prefetchApp', () => {
    it('can prefetch an individual app immediately', () => {
      const controller = createPrefetch({ strategy: 'idle', apps: [] });
      const app = createApp('manual-app');

      controller.prefetchApp(app);

      const links = document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]');
      expect(links).toHaveLength(1);
      expect(controller.getPrefetchedApps()).toStrictEqual(['manual-app']);
    });
  });

  describe('no apps', () => {
    it('does not throw when starting with an empty app list', () => {
      const controller = createPrefetch({ strategy: 'immediate', apps: [] });

      controller.start();

      expect(controller.getPrefetchedApps()).toStrictEqual([]);
    });
  });
});
