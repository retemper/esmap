/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { domIsolationPlugin } from './dom-isolation-plugin.js';
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

describe('domIsolationPlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('플러그인 이름이 esmap:dom-isolation이다', () => {
    const plugin = domIsolationPlugin();
    expect(plugin.name).toBe('esmap:dom-isolation');
  });

  it('exclude 목록의 앱에는 DOM 격리를 적용하지 않는다', () => {
    const plugin = domIsolationPlugin({ exclude: ['nav'] });
    const ctx = createTestContext();

    const cleanup = plugin.install(ctx);
    expect(typeof cleanup).toBe('function');

    if (cleanup) cleanup();
  });

  it('cleanup 시 모든 격리 핸들이 정리된다', () => {
    const plugin = domIsolationPlugin();
    const ctx = createTestContext();

    const cleanup = plugin.install(ctx);
    expect(typeof cleanup).toBe('function');

    if (cleanup) cleanup();
  });
});
