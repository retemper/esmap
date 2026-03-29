/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { intelligentPrefetchPlugin } from './intelligent-prefetch-plugin.js';
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

describe('intelligentPrefetchPlugin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('플러그인 이름이 esmap:intelligent-prefetch이다', () => {
    const { plugin } = intelligentPrefetchPlugin();
    expect(plugin.name).toBe('esmap:intelligent-prefetch');
  });

  it('controller를 통해 학습 데이터에 접근할 수 있다', () => {
    const { controller } = intelligentPrefetchPlugin();

    controller.recordNavigation('app-home', 'app-settings');
    controller.recordNavigation('app-home', 'app-settings');

    const priorities = controller.getPriorities('app-home');
    expect(priorities).toHaveLength(1);
    expect(priorities[0].appName).toBe('app-settings');
  });

  it('install 후 cleanup이 함수를 반환한다', () => {
    const { plugin } = intelligentPrefetchPlugin();
    const ctx = createTestContext();

    const cleanup = plugin.install(ctx);

    expect(typeof cleanup).toBe('function');

    if (cleanup) cleanup();
  });

  it('cleanup 시 학습 데이터를 persist한다', () => {
    const persistKey = 'esmap-test-ip-cleanup';
    const { plugin, controller } = intelligentPrefetchPlugin({ persistKey });
    const ctx = createTestContext();

    const cleanup = plugin.install(ctx);

    controller.recordNavigation('app-home', 'app-settings');

    if (cleanup) cleanup();

    expect(localStorage.getItem(persistKey)).not.toBeNull();
  });
});
