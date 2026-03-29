/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { installPlugins, runCleanups } from './plugin.js';
import type { EsmapPlugin, PluginContext } from './plugin.js';
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

describe('installPlugins', () => {
  it('플러그인의 install을 순서대로 호출한다', () => {
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

  it('install이 반환한 cleanup 함수를 수집한다', () => {
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

  it('cleanup을 반환하지 않는 플러그인은 수집하지 않는다', () => {
    const plugin: EsmapPlugin = {
      name: 'no-cleanup',
      install() {
        // cleanup 없음
      },
    };

    const ctx = createTestContext();
    const cleanups = installPlugins([plugin], ctx);

    expect(cleanups).toHaveLength(0);
  });

  it('같은 이름의 플러그인을 중복 설치하면 에러를 던진다', () => {
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
      '플러그인 "duplicate"이(가) 이미 설치되었습니다',
    );
  });

  it('install에 올바른 PluginContext를 전달한다', () => {
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
  it('cleanup 함수를 역순으로 실행한다', async () => {
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

  it('비동기 cleanup 함수도 처리한다', async () => {
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

  it('빈 배열이면 에러 없이 완료한다', async () => {
    await expect(runCleanups([])).resolves.toBeUndefined();
  });
});
