/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { installPlugins, runCleanups } from './plugin.js';
import type { EsmapPlugin, PluginContext } from './plugin.js';
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

describe('installPlugins', () => {
  it('calls plugin install methods in order', () => {
    const order: string[] = [];
    const plugin1: EsmapPlugin = {
      name: 'first',
      install() {
        order.push('first');
      },
    };
    const plugin2: EsmapPlugin = {
      name: 'second',
      install() {
        order.push('second');
      },
    };

    const ctx = createTestContext();
    installPlugins([plugin1, plugin2], ctx);

    expect(order).toStrictEqual(['first', 'second']);
  });

  it('collects cleanup functions returned by install', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    const plugin1: EsmapPlugin = {
      name: 'p1',
      install() {
        return cleanup1;
      },
    };
    const plugin2: EsmapPlugin = {
      name: 'p2',
      install() {
        return cleanup2;
      },
    };

    const ctx = createTestContext();
    const cleanups = installPlugins([plugin1, plugin2], ctx);

    expect(cleanups).toHaveLength(2);
  });

  it('does not collect plugins that do not return a cleanup', () => {
    const plugin: EsmapPlugin = {
      name: 'no-cleanup',
      install() {
        // no cleanup
      },
    };

    const ctx = createTestContext();
    const cleanups = installPlugins([plugin], ctx);

    expect(cleanups).toHaveLength(0);
  });

  it('throws an error when installing plugins with duplicate names', () => {
    const plugin1: EsmapPlugin = {
      name: 'duplicate',
      install() {},
    };
    const plugin2: EsmapPlugin = {
      name: 'duplicate',
      install() {},
    };

    const ctx = createTestContext();
    expect(() => installPlugins([plugin1, plugin2], ctx)).toThrow(
      'Plugin "duplicate" is already installed',
    );
  });

  it('passes the correct PluginContext to install', () => {
    const ctx = createTestContext();
    const receivedCtx = { value: null as PluginContext | null };

    const plugin: EsmapPlugin = {
      name: 'ctx-test',
      install(pluginCtx) {
        receivedCtx.value = pluginCtx;
      },
    };

    installPlugins([plugin], ctx);

    expect(receivedCtx.value).not.toBeNull();
    expect(receivedCtx.value?.registry).toBe(ctx.registry);
    expect(receivedCtx.value?.router).toBe(ctx.router);
    expect(receivedCtx.value?.hooks).toBe(ctx.hooks);
    expect(receivedCtx.value?.perf).toBe(ctx.perf);
  });
});

describe('runCleanups', () => {
  it('runs cleanup functions in reverse order', async () => {
    const order: string[] = [];
    const cleanups = [
      () => {
        order.push('first');
      },
      () => {
        order.push('second');
      },
      () => {
        order.push('third');
      },
    ];

    await runCleanups(cleanups);

    expect(order).toStrictEqual(['third', 'second', 'first']);
  });

  it('handles async cleanup functions', async () => {
    const order: string[] = [];
    const cleanups = [
      async () => {
        order.push('sync');
      },
      async () => {
        await Promise.resolve();
        order.push('async');
      },
    ];

    await runCleanups(cleanups);

    expect(order).toStrictEqual(['async', 'sync']);
  });

  it('completes without error for an empty array', async () => {
    await expect(runCleanups([])).resolves.toBeUndefined();
  });
});
