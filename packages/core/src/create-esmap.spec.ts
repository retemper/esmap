/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEsmap } from './create-esmap.js';
import type { EsmapOptions } from './types.js';

/** 테스트용 기본 옵션을 생성한다 */
function createDefaultOptions(overrides?: Partial<EsmapOptions>): EsmapOptions {
  return {
    config: {
      apps: {
        '@test/app-a': {
          path: '/app-a',
          activeWhen: '/app-a',
          container: '#app-a',
        },
        '@test/app-b': {
          path: '/app-b',
          activeWhen: ['/app-b', '/app-b-alt'],
          container: '#app-b',
        },
      },
      shared: {},
    },
    disableDevtools: true,
    ...overrides,
  };
}

describe('createEsmap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('기본 인스턴스 생성 — registry, router, hooks, perf가 모두 존재한다', () => {
    const instance = createEsmap(createDefaultOptions());

    expect(instance.registry).toBeDefined();
    expect(instance.router).toBeDefined();
    expect(instance.hooks).toBeDefined();
    expect(instance.perf).toBeDefined();
    expect(instance.prefetch).toBeDefined();
    expect(typeof instance.start).toBe('function');
    expect(typeof instance.destroy).toBe('function');
  });

  it('config.apps의 앱들이 자동으로 레지스트리에 등록된다', () => {
    const instance = createEsmap(createDefaultOptions());

    const apps = instance.registry.getApps();
    const appNames = apps.map((app) => app.name);

    expect(appNames).toContain('@test/app-a');
    expect(appNames).toContain('@test/app-b');
    expect(apps).toHaveLength(2);
  });

  it('start()가 라우터를 시작한다', async () => {
    const instance = createEsmap(createDefaultOptions());

    await instance.start();

    // start()를 두 번 호출해도 안전하다 (Router 내부에서 중복 시작 방지)
    await instance.start();

    await instance.destroy();
  });

  it('destroy()가 모든 리소스를 정리한다', async () => {
    const instance = createEsmap(createDefaultOptions());

    await instance.start();
    await instance.destroy();

    // destroy 후 registry에 앱이 없어야 한다
    expect(instance.registry.getApps()).toHaveLength(0);
    // destroy 후 perf 측정값이 비워져야 한다
    expect(instance.perf.getMeasurements()).toHaveLength(0);
  });

  it('성능 자동 계측 — 앱 라이프사이클 시 PerfTracker에 측정값이 기록된다', async () => {
    const instance = createEsmap(createDefaultOptions());

    // hooks를 통해 수동으로 라이프사이클 실행하여 자동 계측을 검증한다
    await instance.hooks.runHooks('@test/app-a', 'mount', 'before');
    await instance.hooks.runHooks('@test/app-a', 'mount', 'after');

    const measurements = instance.perf.getMeasurements();
    expect(measurements).toHaveLength(1);
    expect(measurements[0]!.appName).toBe('@test/app-a');
    expect(measurements[0]!.phase).toBe('mount');

    await instance.destroy();
  });

  it('disablePerf: true이면 자동 계측이 비활성화된다', async () => {
    const instance = createEsmap(createDefaultOptions({ disablePerf: true }));

    await instance.hooks.runHooks('@test/app-a', 'mount', 'before');
    await instance.hooks.runHooks('@test/app-a', 'mount', 'after');

    const measurements = instance.perf.getMeasurements();
    expect(measurements).toHaveLength(0);

    await instance.destroy();
  });
});
