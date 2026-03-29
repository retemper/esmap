import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPrefetch } from './prefetch.js';
import type { PrefetchAppConfig } from './prefetch.js';

/** 테스트용 앱 설정을 생성한다 */
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

  describe('immediate 전략', () => {
    it('start 호출 시 모든 앱에 대해 modulepreload 링크를 즉시 추가한다', () => {
      const apps = [createApp('app-a'), createApp('app-b')];
      const controller = createPrefetch({ strategy: 'immediate', apps });

      controller.start();

      const links = document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]');
      expect(links).toHaveLength(2);
      expect(links[0].href).toBe(apps[0].url);
      expect(links[1].href).toBe(apps[1].url);
    });

    it('프리페치된 앱 목록을 반환한다', () => {
      const apps = [createApp('app-a'), createApp('app-b')];
      const controller = createPrefetch({ strategy: 'immediate', apps });

      controller.start();

      expect(controller.getPrefetchedApps()).toStrictEqual(['app-a', 'app-b']);
    });
  });

  describe('idle 전략', () => {
    it('requestIdleCallback이 있으면 이를 사용한다', () => {
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

    it('requestIdleCallback이 없으면 setTimeout 200ms를 폴백으로 사용한다', () => {
      vi.useFakeTimers();
      const original = globalThis.requestIdleCallback;
      // @ts-expect-error -- 테스트를 위해 의도적으로 undefined로 설정
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

    it('stop 호출 시 대기 중인 콜백을 취소한다', () => {
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

  describe('중복 방지', () => {
    it('같은 앱을 두 번 프리페치해도 링크가 하나만 추가된다', () => {
      const app = createApp('app-a');
      const controller = createPrefetch({ strategy: 'immediate', apps: [app] });

      controller.start();
      controller.prefetchApp(app);

      const links = document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]');
      expect(links).toHaveLength(1);
    });
  });

  describe('prefetchApp', () => {
    it('개별 앱을 즉시 프리페치할 수 있다', () => {
      const controller = createPrefetch({ strategy: 'idle', apps: [] });
      const app = createApp('manual-app');

      controller.prefetchApp(app);

      const links = document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]');
      expect(links).toHaveLength(1);
      expect(controller.getPrefetchedApps()).toStrictEqual(['manual-app']);
    });
  });

  describe('앱이 없는 경우', () => {
    it('빈 앱 목록으로 start해도 에러가 발생하지 않는다', () => {
      const controller = createPrefetch({ strategy: 'immediate', apps: [] });

      controller.start();

      expect(controller.getPrefetchedApps()).toStrictEqual([]);
    });
  });
});
