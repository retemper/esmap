/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { communicationPlugin } from './communication-plugin.js';
import type { PluginContext } from '../plugin.js';
import { AppRegistry, Router, createLifecycleHooks, createPrefetch } from '@esmap/runtime';
import { PerfTracker } from '@esmap/monitor';

/** 테스트용 PluginContext를 생성한다 */
function createTestContext(): PluginContext {
  const registry = new AppRegistry();
  const router = new Router(registry);
  const hooks = createLifecycleHooks();
  const perf = new PerfTracker();
  const prefetch = createPrefetch({ strategy: 'idle', apps: [] });

  return { registry, router, hooks, perf, prefetch };
}

describe('communicationPlugin', () => {
  it('플러그인 이름이 esmap:communication이다', () => {
    const { plugin } = communicationPlugin();
    expect(plugin.name).toBe('esmap:communication');
  });

  it('EventBus와 GlobalState 리소스를 제공한다', () => {
    const { resources } = communicationPlugin();
    expect(resources.eventBus).toBeDefined();
    expect(resources.globalState).toBeDefined();
  });

  it('초기 상태를 설정할 수 있다', () => {
    const { resources } = communicationPlugin({
      initialState: { user: 'test' },
    });

    expect(resources.globalState.getState()).toStrictEqual({ user: 'test' });
  });

  it('이벤트 버스로 이벤트를 발행하고 수신할 수 있다', () => {
    const { resources } = communicationPlugin();
    const received: unknown[] = [];

    resources.eventBus.on('test', (payload) => {
      received.push(payload);
    });
    resources.eventBus.emit('test', { data: 1 });

    expect(received).toHaveLength(1);
  });

  it('cleanup이 이벤트 버스와 상태를 초기화한다', () => {
    const { plugin, resources } = communicationPlugin({
      initialState: { count: 0 },
    });

    resources.globalState.setState({ count: 42 });
    resources.eventBus.on('test', () => {});

    const ctx = createTestContext();
    const cleanup = plugin.install(ctx);
    expect(typeof cleanup).toBe('function');

    // cleanup 실행
    if (cleanup) cleanup();

    expect(resources.globalState.getState()).toStrictEqual({ count: 0 });
    expect(resources.eventBus.listenerCount('test')).toBe(0);
  });
});
