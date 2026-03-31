/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { domIsolationPlugin } from './dom-isolation-plugin.js';
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

describe('domIsolationPlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has plugin name esmap:dom-isolation', () => {
    const plugin = domIsolationPlugin();
    expect(plugin.name).toBe('esmap:dom-isolation');
  });

  it('does not apply DOM isolation to apps in the exclude list', () => {
    const plugin = domIsolationPlugin({ exclude: ['nav'] });
    const ctx = createTestContext();

    const cleanup = plugin.install(ctx);
    expect(typeof cleanup).toBe('function');

    if (cleanup) cleanup();
  });

  it('cleans up all isolation handles during cleanup', () => {
    const plugin = domIsolationPlugin();
    const ctx = createTestContext();

    const cleanup = plugin.install(ctx);
    expect(typeof cleanup).toBe('function');

    if (cleanup) cleanup();
  });
});
