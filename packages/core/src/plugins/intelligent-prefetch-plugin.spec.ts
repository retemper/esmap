/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { intelligentPrefetchPlugin } from './intelligent-prefetch-plugin.js';
import type { PluginContext } from '../plugin.js';
import { AppRegistry, Router, createLifecycleHooks, createPrefetch } from '@esmap/runtime';
import { PerfTracker } from '@esmap/monitor';

/** Creates a PluginContext for testing */
function createTestContext(): PluginContext {
  const registry = new AppRegistry();
  const router = new Router(registry);
  const hooks = createLifecycleHooks();
  const perf = new PerfTracker();
  const prefetch = createPrefetch({ strategy: 'idle', apps: [] });

  return { registry, router, hooks, perf, prefetch };
}

describe('intelligentPrefetchPlugin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has plugin name esmap:intelligent-prefetch', () => {
    const { plugin } = intelligentPrefetchPlugin();
    expect(plugin.name).toBe('esmap:intelligent-prefetch');
  });

  it('can access learning data through the controller', () => {
    const { controller } = intelligentPrefetchPlugin();

    controller.recordNavigation('app-home', 'app-settings');
    controller.recordNavigation('app-home', 'app-settings');

    const priorities = controller.getPriorities('app-home');
    expect(priorities).toHaveLength(1);
    expect(priorities[0].appName).toBe('app-settings');
  });

  it('returns a cleanup function after install', () => {
    const { plugin } = intelligentPrefetchPlugin();
    const ctx = createTestContext();

    const cleanup = plugin.install(ctx);

    expect(typeof cleanup).toBe('function');

    if (cleanup) cleanup();
  });

  it('persists learning data during cleanup', () => {
    const persistKey = 'esmap-test-ip-cleanup';
    const { plugin, controller } = intelligentPrefetchPlugin({ persistKey });
    const ctx = createTestContext();

    const cleanup = plugin.install(ctx);

    controller.recordNavigation('app-home', 'app-settings');

    if (cleanup) cleanup();

    expect(localStorage.getItem(persistKey)).not.toBeNull();
  });
});
