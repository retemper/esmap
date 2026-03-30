/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppRegistry } from './app-registry.js';
import type { MfeApp } from '@esmap/shared';

/** Creates a mock MfeApp for testing */
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

/** Creates an AppRegistry with a mock-mfe module URL in the import map */
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

  it('keep-alive app transitions to FROZEN on unmount', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('MOUNTED');

    await registry.unmountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('FROZEN');
  });

  it('container becomes display:none when FROZEN', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    await registry.unmountApp('app-a');

    const container = document.querySelector<HTMLElement>('#app-a');
    expect(container?.style.display).toBe('none');
  });

  it('preserves DOM content when FROZEN', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');

    const container = document.querySelector<HTMLElement>('#app-a');
    expect(container?.innerHTML).toBe('<div>mock-mfe</div>');

    await registry.unmountApp('app-a');
    // DOM is preserved (only hidden, without calling unmount)
    expect(container?.innerHTML).toBe('<div>mock-mfe</div>');
  });

  it('immediately becomes MOUNTED when remounting a FROZEN app', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    registry.setKeepAlive('app-a', true);

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    await registry.unmountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('FROZEN');

    await registry.mountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('MOUNTED');
  });

  it('container becomes visible again after thaw', async () => {
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

  it('non-keep-alive app transitions to NOT_MOUNTED as before', async () => {
    const registry = createRegistryWithApp('app-a', '#app-a');
    // setKeepAlive not called

    await registry.loadApp('app-a');
    await registry.mountApp('app-a');
    await registry.unmountApp('app-a');
    expect(registry.getApp('app-a')?.status).toBe('NOT_MOUNTED');
  });

  it('can check keep-alive status with isKeepAlive', () => {
    const registry = new AppRegistry();
    registry.registerApp({ name: 'app-a', activeWhen: '/' });

    expect(registry.isKeepAlive('app-a')).toBe(false);

    registry.setKeepAlive('app-a', true);
    expect(registry.isKeepAlive('app-a')).toBe(true);

    registry.setKeepAlive('app-a', false);
    expect(registry.isKeepAlive('app-a')).toBe(false);
  });

  it('cleans up FROZEN apps on destroy', async () => {
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
