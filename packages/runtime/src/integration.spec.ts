import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppRegistry } from './app-registry.js';
import { loadImportMap } from './loader.js';
import type { MfeApp, ImportMap } from '@esmap/shared';

/**
 * Integration tests combining AppRegistry and loadImportMap.
 * Verifies behavior close to real browser scenarios.
 */
describe('runtime integration tests', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<div id="nav"></div><div id="main"></div>';
    vi.restoreAllMocks();
  });

  it('full flow: import map load -> app registration -> status tracking', async () => {
    const importMap: ImportMap = {
      imports: {
        'app-nav': 'https://cdn.example.com/app-nav.js',
        'app-home': 'https://cdn.example.com/app-home.js',
      },
    };

    // 1. Load import map
    const result = await loadImportMap({ inlineImportMap: importMap });
    expect(result).toStrictEqual(importMap);

    // Verify import map was injected into DOM
    const scriptTag = document.querySelector('script[type="importmap"]');
    expect(scriptTag).not.toBeNull();
    expect(JSON.parse(scriptTag!.textContent!)).toStrictEqual(importMap);

    // 2. Verify modulepreload hints were injected
    const preloads = document.querySelectorAll('link[rel="modulepreload"]');
    expect(preloads).toHaveLength(2);

    // 3. Register apps
    const registry = new AppRegistry();
    const statusLog: string[] = [];

    registry.onStatusChange((event) => {
      statusLog.push(`${event.appName}:${event.from}→${event.to}`);
    });

    registry.registerApp({
      name: 'app-nav',
      activeWhen: () => true,
      container: '#nav',
    });

    registry.registerApp({
      name: 'app-home',
      activeWhen: '/',
      container: '#main',
    });

    expect(registry.getApps()).toHaveLength(2);
    expect(registry.getApp('app-nav')!.status).toBe('NOT_LOADED');
  });

  it('mount/unmount cycle for multiple apps', async () => {
    const registry = new AppRegistry();
    const events: string[] = [];

    registry.onStatusChange((event) => {
      events.push(`${event.appName}:${event.to}`);
    });

    // Register apps
    registry.registerApp({ name: 'app-a', activeWhen: '/a', container: '#main' });
    registry.registerApp({ name: 'app-b', activeWhen: '/b', container: '#main' });

    // Dynamic import fails in jsdom, so only verify up to LOAD_ERROR
    try {
      await registry.loadApp('app-a');
    } catch {
      // expected in jsdom
    }

    expect(events).toContain('app-a:LOADING');
    expect(events).toContain('app-a:LOAD_ERROR');

    // Unregister app
    await registry.unregisterApp('app-a');
    expect(registry.getApp('app-a')).toBeUndefined();
    expect(registry.getApps()).toHaveLength(1);
  });

  it('prevents duplicate import map injection', async () => {
    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    // First load
    await loadImportMap({ inlineImportMap: importMap });

    // Second load skips injection since import map already exists
    await loadImportMap({
      inlineImportMap: { imports: { vue: 'https://cdn.example.com/vue.js' } },
    });

    const scripts = document.querySelectorAll('script[type="importmap"]');
    expect(scripts).toHaveLength(1);
    // Only the first import map is retained
    expect(JSON.parse(scripts[0].textContent!)).toStrictEqual(importMap);
  });
});
