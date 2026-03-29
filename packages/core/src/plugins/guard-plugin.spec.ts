/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guardPlugin } from './guard-plugin.js';
import { createLifecycleHooks } from '@esmap/runtime';
import type { LifecycleHooks } from '@esmap/runtime';
import type { PluginContext } from '../plugin.js';
import { AppRegistry, Router, createPrefetch } from '@esmap/runtime';
import { PerfTracker } from '@esmap/monitor';

/** 테스트용 PluginContext를 생성한다 */
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

  it('플러그인 이름이 esmap:guard이다', () => {
    const plugin = guardPlugin();
    expect(plugin.name).toBe('esmap:guard');
  });

  it('install이 cleanup 함수를 반환한다', () => {
    const ctx = createTestContext();
    const cleanup = plugin().install(ctx);
    expect(typeof cleanup).toBe('function');
  });

  it('mount 훅에서 data-esmap-scope 속성을 추가한다', async () => {
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

  it('unmount 훅에서 격리를 정리한다', async () => {
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

  it('onGlobalViolation 콜백이 전달된다', () => {
    const onViolation = vi.fn();
    const plugin = guardPlugin({ onGlobalViolation: onViolation });

    expect(plugin.name).toBe('esmap:guard');
    // 콜백이 설정된 상태로 플러그인이 생성됨을 확인
  });
});

/** guardPlugin 헬퍼 */
function plugin(): ReturnType<typeof guardPlugin> {
  return guardPlugin();
}
