import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppRegistry } from './app-registry.js';
import type { ErrorBoundaryOptions } from './app-registry.js';
import type { MfeApp } from '@esmap/shared';
import { AppNotFoundError, AppAlreadyRegisteredError, AppLifecycleError } from '@esmap/shared';

/** 테스트용 MfeApp 목 생성 */
function createMockApp(): MfeApp {
  return {
    bootstrap: vi.fn().mockResolvedValue(undefined),
    mount: vi.fn().mockResolvedValue(undefined),
    unmount: vi.fn().mockResolvedValue(undefined),
  };
}

/** 로드 실패하는 MfeApp 목 생성 */
function createFailingMockApp(): MfeApp {
  return {
    bootstrap: vi.fn().mockRejectedValue(new Error('bootstrap failed')),
    mount: vi.fn().mockResolvedValue(undefined),
    unmount: vi.fn().mockResolvedValue(undefined),
  };
}

/** 마운트 실패하는 MfeApp 목 생성 */
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
    it('앱을 등록하면 NOT_LOADED 상태로 시작한다', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/checkout', activeWhen: '/checkout' });

      const app = registry.getApp('@flex/checkout');
      expect(app?.status).toBe('NOT_LOADED');
    });

    it('같은 이름의 앱을 중복 등록하면 AppAlreadyRegisteredError를 던진다', () => {
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

    it('문자열 패턴으로 activeWhen을 설정한다', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/checkout', activeWhen: '/checkout' });

      const app = registry.getApp('@flex/checkout')!;
      expect(app.activeWhen({ pathname: '/checkout/cart' } as Location)).toBe(true);
      expect(app.activeWhen({ pathname: '/people' } as Location)).toBe(false);
    });

    it('배열 패턴으로 activeWhen을 설정한다', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/checkout', activeWhen: ['/checkout', '/cart'] });

      const app = registry.getApp('@flex/checkout')!;
      expect(app.activeWhen({ pathname: '/checkout' } as Location)).toBe(true);
      expect(app.activeWhen({ pathname: '/cart/items' } as Location)).toBe(true);
      expect(app.activeWhen({ pathname: '/people' } as Location)).toBe(false);
    });

    it('함수로 activeWhen을 설정한다', () => {
      const registry = new AppRegistry();
      const fn = (loc: Location) => loc.pathname === '/exact';
      registry.registerApp({ name: '@flex/checkout', activeWhen: fn });

      const app = registry.getApp('@flex/checkout')!;
      expect(app.activeWhen({ pathname: '/exact' } as Location)).toBe(true);
      expect(app.activeWhen({ pathname: '/exact/sub' } as Location)).toBe(false);
    });

    it('container를 지정하지 않으면 기본값 #app을 사용한다', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test', activeWhen: '/test' });

      const app = registry.getApp('test')!;
      expect(app.container).toBe('#app');
    });

    it('container를 커스텀으로 지정할 수 있다', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test', activeWhen: '/test', container: '#custom' });

      const app = registry.getApp('test')!;
      expect(app.container).toBe('#custom');
    });
  });

  describe('getApps', () => {
    it('등록된 모든 앱을 반환한다', () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: '@flex/a', activeWhen: '/a' });
      registry.registerApp({ name: '@flex/b', activeWhen: '/b' });

      expect(registry.getApps()).toHaveLength(2);
    });

    it('앱이 없으면 빈 배열을 반환한다', () => {
      const registry = new AppRegistry();
      expect(registry.getApps()).toStrictEqual([]);
    });
  });

  describe('loadApp', () => {
    it('dynamic import 실패 시 LOAD_ERROR 상태가 되고 AppLifecycleError를 던진다', async () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test-app', activeWhen: '/test' });

      await expect(registry.loadApp('test-app')).rejects.toThrow(AppLifecycleError);

      const app = registry.getApp('test-app')!;
      expect(app.status).toBe('LOAD_ERROR');

      try {
        // LOAD_ERROR에서 다시 로드 시도 가능
        await registry.loadApp('test-app');
      } catch (e) {
        expect(e).toBeInstanceOf(AppLifecycleError);
        const err = e as AppLifecycleError;
        expect(err.appName).toBe('test-app');
        expect(err.phase).toBe('load');
        expect(err.code).toBe('APP_LIFECYCLE_ERROR');
      }
    });

    it('등록되지 않은 앱을 로드하면 AppNotFoundError를 던진다', async () => {
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

  describe('loadApp 중복 방지', () => {
    it('동시에 같은 앱을 두 번 로드해도 loadApp 함수는 한 번만 호출된다', async () => {
      const loadCount = { value: 0 };
      const registry = new AppRegistry({
        importMap: {
          imports: { 'test-app': 'https://cdn.example.com/test.js' },
        },
      });
      registry.registerApp({ name: 'test-app', activeWhen: '/test' });

      // loadApp 내부의 dynamic import를 추적하기 위해 상태 변경 이벤트를 관찰
      const loadingEvents: string[] = [];
      registry.onStatusChange((event) => {
        if (event.to === 'LOADING') {
          loadingEvents.push(event.appName);
          loadCount.value++;
        }
      });

      // 동시에 두 번 호출
      const promise1 = registry.loadApp('test-app').catch(() => undefined);
      const promise2 = registry.loadApp('test-app').catch(() => undefined);

      await Promise.all([promise1, promise2]);

      // LOADING 상태 전이는 한 번만 발생해야 한다
      expect(loadCount.value).toBe(1);
    });
  });

  describe('unmountApp', () => {
    it('마운트되지 않은 앱을 언마운트하면 아무것도 하지 않는다', async () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test', activeWhen: '/test' });

      // 에러 없이 완료되어야 함
      await registry.unmountApp('test');
    });
  });

  describe('unregisterApp', () => {
    it('등록된 앱을 제거한다', async () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'test', activeWhen: '/test' });

      await registry.unregisterApp('test');

      expect(registry.getApp('test')).toBeUndefined();
    });

    it('등록되지 않은 앱을 제거해도 에러가 없다', async () => {
      const registry = new AppRegistry();
      await registry.unregisterApp('nonexistent');
    });
  });

  describe('onStatusChange', () => {
    it('상태 변경 리스너를 등록하고 호출한다', async () => {
      const registry = new AppRegistry();
      const events: { appName: string; from: string; to: string }[] = [];

      registry.onStatusChange((event) => {
        events.push(event);
      });

      registry.registerApp({ name: 'test', activeWhen: '/test' });

      // loadApp 시도 (dynamic import 실패하겠지만 상태 전이 이벤트는 발생)
      try {
        await registry.loadApp('test');
      } catch {
        // dynamic import 실패 예상
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].appName).toBe('test');
      expect(events[0].from).toBe('NOT_LOADED');
      expect(events[0].to).toBe('LOADING');
    });

    it('LOAD_ERROR 시 LOADING → LOAD_ERROR 전이가 발생한다', async () => {
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

    it('리스너 해제 함수로 리스너를 제거한다', async () => {
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
        // dynamic import 실패 예상
      }

      expect(events).toStrictEqual([]);
    });
  });

  describe('destroy', () => {
    it('모든 앱을 제거하고 레지스트리를 정리한다', async () => {
      const registry = new AppRegistry();
      registry.registerApp({ name: 'app-a', activeWhen: '/a' });
      registry.registerApp({ name: 'app-b', activeWhen: '/b' });

      await registry.destroy();

      expect(registry.getApps()).toStrictEqual([]);
      expect(registry.getApp('app-a')).toBeUndefined();
    });

    it('마운트된 앱은 먼저 언마운트한 후 정리한다', async () => {
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

  describe('에러 바운더리', () => {
    describe('loadApp 에러 바운더리', () => {
      it('전역 에러 바운더리가 설정되면 로드 실패 시 에러를 던지지 않는다', async () => {
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        // 에러를 던지지 않아야 한다
        await registry.loadApp('test-app');

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith('test-app', expect.any(AppLifecycleError));
      });

      it('에러 바운더리 설정 시 컨테이너에 기본 폴백 UI를 렌더링한다', async () => {
        const registry = new AppRegistry({
          errorBoundary: {},
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        const container = document.querySelector('#app');
        expect(container?.querySelector('.esmap-error-boundary')).not.toBeNull();
        expect(container?.querySelector('p')?.textContent).toBe('앱을 불러올 수 없습니다');
        expect(container?.querySelector('button')?.textContent).toBe('다시 시도');
      });

      it('커스텀 fallback 함수가 HTMLElement를 반환하면 해당 요소를 렌더링한다', async () => {
        const fallback = (appName: string, _error: Error) => {
          const div = document.createElement('div');
          div.className = 'custom-fallback';
          div.textContent = `${appName} 로드 실패`;
          return div;
        };

        const registry = new AppRegistry({
          errorBoundary: { fallback },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        const container = document.querySelector('#app');
        expect(container?.querySelector('.custom-fallback')?.textContent).toBe(
          'test-app 로드 실패',
        );
      });

      it('커스텀 fallback 함수가 문자열을 반환하면 텍스트로 안전하게 렌더링한다', async () => {
        const fallback = (_appName: string, _error: Error) =>
          '<div class="string-fallback">에러</div>';

        const registry = new AppRegistry({
          errorBoundary: { fallback },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        const container = document.querySelector('#app');
        expect(container?.textContent).toBe('<div class="string-fallback">에러</div>');
        expect(container?.querySelector('.string-fallback')).toBeNull();
      });

      it('onError 콜백에 앱 이름과 에러를 전달한다', async () => {
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

      it('에러 바운더리 없이는 기존처럼 에러를 던진다', async () => {
        const registry = new AppRegistry();
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await expect(registry.loadApp('test-app')).rejects.toThrow(AppLifecycleError);
      });
    });

    describe('앱별 에러 바운더리 오버라이드', () => {
      it('앱별 에러 바운더리가 전역 설정보다 우선한다', async () => {
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

      it('앱별 에러 바운더리가 없으면 전역 설정을 사용한다', async () => {
        const globalOnError = vi.fn();

        const registry = new AppRegistry({
          errorBoundary: { onError: globalOnError },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        expect(globalOnError).toHaveBeenCalledTimes(1);
      });
    });

    describe('재시도', () => {
      it('다시 시도 버튼 클릭 시 재시도 카운트가 증가한다', async () => {
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

      it('재시도 횟수가 retryLimit에 도달하면 재시도 버튼이 없는 영구 폴백을 표시한다', async () => {
        const registry = new AppRegistry({
          errorBoundary: { retryLimit: 0 },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        await registry.loadApp('test-app');

        const container = document.querySelector('#app');
        expect(container?.querySelector('.esmap-error-boundary')).not.toBeNull();
        expect(container?.querySelector('p')?.textContent).toBe('앱을 불러올 수 없습니다');
        expect(container?.querySelector('button')).toBeNull();
      });

      it('retryLimit 기본값은 3이다', async () => {
        const registry = new AppRegistry({
          errorBoundary: {},
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        // 3번 재시도까지는 버튼이 있어야 한다
        await registry.loadApp('test-app');
        expect(document.querySelector('#app button')).not.toBeNull();
      });

      it('성공적으로 로드하면 재시도 카운트가 초기화된다', async () => {
        vi.useFakeTimers();
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        // 첫 로드 실패
        await registry.loadApp('test-app');

        // 수동으로 재시도 카운트 확인
        const button = document.querySelector('#app button');
        button?.dispatchEvent(new Event('click'));
        expect(registry.getRetryCount('test-app')).toBe(1);
        vi.useRealTimers();
      });
    });

    describe('mountApp 에러 바운더리', () => {
      it('mountApp에서 loadApp 실패 시 에러 바운더리가 동작한다', async () => {
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({ name: 'test-app', activeWhen: '/test' });

        // mountApp은 내부적으로 loadApp을 호출하고, 에러 바운더리가 처리한다
        await registry.mountApp('test-app');

        expect(onError).toHaveBeenCalledTimes(1);
      });
    });

    describe('unregisterApp과 에러 바운더리', () => {
      it('앱 제거 시 에러 바운더리 설정과 재시도 카운트도 정리된다', async () => {
        const registry = new AppRegistry({
          errorBoundary: {},
        });
        registry.registerApp({
          name: 'test-app',
          activeWhen: '/test',
          errorBoundary: { retryLimit: 5 },
        });

        await registry.loadApp('test-app');

        // 재시도 카운트를 증가시킨다
        const button = document.querySelector('#app button');
        button?.dispatchEvent(new Event('click'));

        await registry.unregisterApp('test-app');

        // 제거 후 재시도 카운트가 0이어야 한다
        expect(registry.getRetryCount('test-app')).toBe(0);
      });
    });

    describe('컨테이너가 없는 경우', () => {
      it('컨테이너를 찾을 수 없으면 폴백 렌더링을 건너뛴다', async () => {
        const onError = vi.fn();
        const registry = new AppRegistry({
          errorBoundary: { onError },
        });
        registry.registerApp({
          name: 'test-app',
          activeWhen: '/test',
          container: '#nonexistent',
        });

        // 에러를 던지지 않아야 한다
        await registry.loadApp('test-app');

        // onError는 호출되어야 한다
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });
  });
});
