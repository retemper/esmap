/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { communicationPlugin } from './communication-plugin.js';
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

describe('communicationPlugin', () => {
  it('has plugin name esmap:communication', () => {
    const { plugin } = communicationPlugin();
    expect(plugin.name).toBe('esmap:communication');
  });

  it('provides EventBus and GlobalState resources', () => {
    const { resources } = communicationPlugin();
    expect(resources.eventBus).toBeDefined();
    expect(resources.globalState).toBeDefined();
  });

  it('can set initial state', () => {
    const { resources } = communicationPlugin({
      initialState: { user: 'test' },
    });

    expect(resources.globalState.getState()).toStrictEqual({ user: 'test' });
  });

  it('can emit and receive events via the event bus', () => {
    const { resources } = communicationPlugin();
    const received: unknown[] = [];

    resources.eventBus.on('test', (payload) => {
      received.push(payload);
    });
    resources.eventBus.emit('test', { data: 1 });

    expect(received).toHaveLength(1);
  });

  it('cleanup resets the event bus and state', () => {
    const { plugin, resources } = communicationPlugin({
      initialState: { count: 0 },
    });

    resources.globalState.setState({ count: 42 });
    resources.eventBus.on('test', () => {});

    const ctx = createTestContext();
    const cleanup = plugin.install(ctx);
    expect(typeof cleanup).toBe('function');

    // Execute cleanup
    if (cleanup) cleanup();

    expect(resources.globalState.getState()).toStrictEqual({ count: 0 });
    expect(resources.eventBus.listenerCount('test')).toBe(0);
  });
});
