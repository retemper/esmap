/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { keepAlivePlugin } from './keep-alive-plugin.js';
import type { PluginContext } from '../plugin.js';
import { AppRegistry, Router, createLifecycleHooks, createPrefetch } from '@esmap/runtime';
import { PerfTracker } from '@esmap/monitor';

/** Creates a PluginContext for testing */
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

  it('has plugin name esmap:keep-alive', () => {
    const plugin = keepAlivePlugin({ apps: [] });
    expect(plugin.name).toBe('esmap:keep-alive');
  });

  it('sets keep-alive on specified apps', () => {
    const ctx = createTestContext();
    ctx.registry.registerApp({ name: 'app-a', activeWhen: '/', container: '#app-a' });

    const plugin = keepAlivePlugin({ apps: ['app-a'] });
    plugin.install(ctx);

    expect(ctx.registry.isKeepAlive('app-a')).toBe(true);
  });

  it('removes keep-alive settings during cleanup', () => {
    const ctx = createTestContext();
    ctx.registry.registerApp({ name: 'app-a', activeWhen: '/', container: '#app-a' });

    const plugin = keepAlivePlugin({ apps: ['app-a'] });
    const cleanup = plugin.install(ctx);

    expect(ctx.registry.isKeepAlive('app-a')).toBe(true);

    if (cleanup) cleanup();

    expect(ctx.registry.isKeepAlive('app-a')).toBe(false);
  });
});
