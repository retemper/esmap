/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEsmap } from './create-esmap.js';
import type { EsmapOptions } from './types.js';

/** Creates default options for testing */
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

  it('creates a default instance with registry, router, hooks, and perf', () => {
    const instance = createEsmap(createDefaultOptions());

    expect(instance.registry).toBeDefined();
    expect(instance.router).toBeDefined();
    expect(instance.hooks).toBeDefined();
    expect(instance.perf).toBeDefined();
    expect(instance.prefetch).toBeDefined();
    expect(typeof instance.start).toBe('function');
    expect(typeof instance.destroy).toBe('function');
  });

  it('automatically registers apps from config.apps into the registry', () => {
    const instance = createEsmap(createDefaultOptions());

    const apps = instance.registry.getApps();
    const appNames = apps.map((app) => app.name);

    expect(appNames).toContain('@test/app-a');
    expect(appNames).toContain('@test/app-b');
    expect(apps).toHaveLength(2);
  });

  it('start() starts the router', async () => {
    const instance = createEsmap(createDefaultOptions());

    await instance.start();

    // Calling start() twice is safe (Router prevents duplicate starts internally)
    await instance.start();

    await instance.destroy();
  });

  it('destroy() cleans up all resources', async () => {
    const instance = createEsmap(createDefaultOptions());

    await instance.start();
    await instance.destroy();

    // After destroy, registry should have no apps
    expect(instance.registry.getApps()).toHaveLength(0);
    // After destroy, perf measurements should be cleared
    expect(instance.perf.getMeasurements()).toHaveLength(0);
  });

  it('auto instrumentation records measurements in PerfTracker during app lifecycle', async () => {
    const instance = createEsmap(createDefaultOptions());

    // Manually run lifecycle via hooks to verify auto instrumentation
    await instance.hooks.runHooks('@test/app-a', 'mount', 'before');
    await instance.hooks.runHooks('@test/app-a', 'mount', 'after');

    const measurements = instance.perf.getMeasurements();
    expect(measurements).toHaveLength(1);
    expect(measurements[0]!.appName).toBe('@test/app-a');
    expect(measurements[0]!.phase).toBe('mount');

    await instance.destroy();
  });

  it('disables auto instrumentation when disablePerf is true', async () => {
    const instance = createEsmap(createDefaultOptions({ disablePerf: true }));

    await instance.hooks.runHooks('@test/app-a', 'mount', 'before');
    await instance.hooks.runHooks('@test/app-a', 'mount', 'after');

    const measurements = instance.perf.getMeasurements();
    expect(measurements).toHaveLength(0);

    await instance.destroy();
  });
});
