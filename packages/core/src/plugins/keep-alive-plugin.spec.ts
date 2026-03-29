/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { keepAlivePlugin } from './keep-alive-plugin.js';
import type { PluginContext } from '../plugin.js';
import { AppRegistry, Router, createLifecycleHooks, createPrefetch } from '@esmap/runtime';
import { PerfTracker } from '@esmap/monitor';

/** 테스트용 PluginContext를 생성한다 */
function createTestContext(): PluginContext & { registry: AppRegistry } {
  const registry = new AppRegistry();
  const router = new Router(registry);
  const hooks = createLifecycleHooks();
  const perf = new PerfTracker();
  const prefetch = createPrefetch({ strategy: 'idle', apps: [] });

  return { registry, router, hooks, perf, prefetch };
}

describe('keepAlivePlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-a"></div><div id="app-b"></div><div id="app-c"></div>';
  });

  it('플러그인 이름이 esmap:keep-alive이다', () => {
    const plugin = keepAlivePlugin({ apps: [] });
    expect(plugin.name).toBe('esmap:keep-alive');
  });

  it('지정된 앱에 keep-alive를 설정한다', () => {
    const ctx = createTestContext();
    ctx.registry.registerApp({ name: 'app-a', activeWhen: '/', container: '#app-a' });

    const plugin = keepAlivePlugin({ apps: ['app-a'] });
    plugin.install(ctx);

    expect(ctx.registry.isKeepAlive('app-a')).toBe(true);
  });

  it('cleanup 시 keep-alive 설정이 해제된다', () => {
    const ctx = createTestContext();
    ctx.registry.registerApp({ name: 'app-a', activeWhen: '/', container: '#app-a' });

    const plugin = keepAlivePlugin({ apps: ['app-a'] });
    const cleanup = plugin.install(ctx);

    expect(ctx.registry.isKeepAlive('app-a')).toBe(true);

    if (cleanup) cleanup();

    expect(ctx.registry.isKeepAlive('app-a')).toBe(false);
  });
});
