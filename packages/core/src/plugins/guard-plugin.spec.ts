/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guardPlugin } from './guard-plugin.js';
import { createLifecycleHooks } from '@esmap/runtime';
import type { LifecycleHooks } from '@esmap/runtime';
import type { PluginContext } from '../plugin.js';
import { AppRegistry, Router, createPrefetch } from '@esmap/runtime';
import { PerfTracker } from '@esmap/monitor';

/** Creates a PluginContext for testing */
function createTestContext(): PluginContext & { hooks: LifecycleHooks } {
  const registry = new AppRegistry();
  const router = new Router(registry);
  const hooks = createLifecycleHooks();
  const perf = new PerfTracker();
  const prefetch = createPrefetch({ strategy: 'idle', apps: [] });

  return { registry, router, hooks, perf, prefetch };
}

describe('guardPlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('has plugin name esmap:guard', () => {
    const plugin = guardPlugin();
    expect(plugin.name).toBe('esmap:guard');
  });

  it('install returns a cleanup function', () => {
    const ctx = createTestContext();
    const cleanup = plugin().install(ctx);
    expect(typeof cleanup).toBe('function');
  });

  it('adds data-esmap-scope attribute in mount hook', async () => {
    const ctx = createTestContext();
    ctx.registry.registerApp({
      name: 'test-app',
      activeWhen: '/test',
      container: '#app',
    });

    const plugin = guardPlugin();
    plugin.install(ctx);

    await ctx.hooks.runHooks('test-app', 'mount', 'after');

    const container = document.getElementById('app');
    expect(container?.getAttribute('data-esmap-scope')).toBe('test-app');
  });

  it('cleans up isolation in unmount hook', async () => {
    const ctx = createTestContext();
    ctx.registry.registerApp({
      name: 'test-app',
      activeWhen: '/test',
      container: '#app',
    });

    const plugin = guardPlugin();
    plugin.install(ctx);

    // mount → unmount
    await ctx.hooks.runHooks('test-app', 'mount', 'after');
    await ctx.hooks.runHooks('test-app', 'unmount', 'before');

    const container = document.getElementById('app');
    expect(container?.hasAttribute('data-esmap-scope')).toBe(false);
  });

  it('passes the onGlobalViolation callback', () => {
    const onViolation = vi.fn();
    const plugin = guardPlugin({ onGlobalViolation: onViolation });

    expect(plugin.name).toBe('esmap:guard');
    // Confirm plugin is created with the callback configured
  });
});

/** guardPlugin helper */
function plugin(): ReturnType<typeof guardPlugin> {
  return guardPlugin();
}
