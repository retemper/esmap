/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppRegistry } from './app-registry.js';
import type { MfeApp } from '@esmap/shared';

/** 테스트용 MfeApp 목을 생성한다 */
function createMockApp(): MfeApp {
  return {
    bootstrap: vi.fn().mockResolvedValue(undefined),
    mount: vi.fn().mockImplementation(async (container: HTMLElement) => {
      container.innerHTML = '<div>mock-mfe</div>';
    }),
    unmount: vi.fn().mockImplementation(async (container: HTMLElement) => {
      container.innerHTML = '';
    }),
  };
}

/** import map에 mock-mfe 모듈 URL을 넣어 AppRegistry를 생성한다 */
function createRegistryWithApp(appName: string, container: string): AppRegistry {
  const mockApp = createMockApp();
  const mockModuleUrl = `data:text/javascript,${encodeURIComponent(
    'export const bootstrap = async () => {};' +
    'export const mount = async (c) => { c.innerHTML = "<div>mock-mfe</div>"; };' +
    'export const unmount = async (c) => { c.innerHTML = ""; };'
  )}`;

  const registry = new AppRegistry({
    importMap: {
      imports: { [appName]: mockModuleUrl },
    },
  });
  registry.registerApp({ name: appName, activeWhen: '/', container });
  return registry;
}

describe('AppRegistry keep-alive', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-a"></div><div id="app-b"></div>';
  });

  it('keep-alive 앱은 unmount 시 FROZEN 상태가 된다', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('MOUNTED');

    await registry.unmountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('FROZEN');
  });

  it('FROZEN 시 컨테이너가 display:none이 된다', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    await registry.unmountApp('app-a');

    const container = document.querySelector<HTMLElement>('#app-a');
    expect(container?.style.display).toBe('none');
  });

  it('FROZEN 시 DOM 콘텐츠가 보존된다', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');

    const container = document.querySelector<HTMLElement>('#app-a');
    expect(container?.innerHTML).toBe('<div>mock-mfe</div>');

    await registry.unmountApp('app-a');
    // DOM이 보존된다 (unmount 호출 없이 숨김만)
    expect(container?.innerHTML).toBe('<div>mock-mfe</div>');
  });

  it('FROZEN 앱을 다시 마운트하면 즉시 MOUNTED가 된다', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    await registry.unmountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('FROZEN');

    await registry.mountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('MOUNTED');
  });

  it('thaw 후 컨테이너가 다시 표시된다', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    await registry.unmountApp('app-a');

    const container = document.querySelector<HTMLElement>('#app-a');
    expect(container?.style.display).toBe('none');

    await registry.mountApp('app-a');
    expect(container?.style.display).toBe('');
  });

  it('keep-alive가 아닌 앱은 기존처럼 NOT_MOUNTED가 된다', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    // setKeepAlive 호출 안 함

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    await registry.unmountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('NOT_MOUNTED');
  });

  it('isKeepAlive로 keep-alive 상태를 확인할 수 있다', () => {
    const registry = new AppRegistry();
    registry.registerApp({ name: 'app-a', activeWhen: '/' });

    expect(registry.isKeepAlive('app-a')).toBe(false);

    registry.setKeepAlive('app-a', true);
    expect(registry.isKeepAlive('app-a')).toBe(true);

    registry.setKeepAlive('app-a', false);
    expect(registry.isKeepAlive('app-a')).toBe(false);
  });

  it('destroy 시 FROZEN 앱도 정리된다', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    await registry.unmountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('FROZEN');

    await registry.destroy();
    expect(registry.getApps()).toHaveLength(0);
  });
});
