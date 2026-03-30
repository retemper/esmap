/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import type { LifecycleHooks, LifecyclePhase, LifecycleHook } from '@esmap/runtime';
import type { PerfTracker } from '@esmap/monitor';
import { installAutoPerf } from './auto-perf.js';

/** Creates a mock LifecycleHooks object for testing */
function createMockHooks(): LifecycleHooks & {
  readonly registeredBefore: Array<{ readonly phase: LifecyclePhase; readonly hook: LifecycleHook }>;
  readonly registeredAfter: Array<{ readonly phase: LifecyclePhase; readonly hook: LifecycleHook }>;
} {
  const registeredBefore: Array<{ phase: LifecyclePhase; hook: LifecycleHook }> = [];
  const registeredAfter: Array<{ phase: LifecyclePhase; hook: LifecycleHook }> = [];

  return {
    registeredBefore,
    registeredAfter,
    beforeEach(phase: LifecyclePhase, hook: LifecycleHook): void {
      registeredBefore.push({ phase, hook });
    },
    afterEach(phase: LifecyclePhase, hook: LifecycleHook): void {
      registeredAfter.push({ phase, hook });
    },
    before: vi.fn(),
    after: vi.fn(),
    runHooks: vi.fn(),
  };
}

/** Creates a mock PerfTracker object for testing */
function createMockPerfTracker(): {
  readonly tracker: PerfTracker;
  readonly markStart: ReturnType<typeof vi.fn>;
  readonly markEnd: ReturnType<typeof vi.fn>;
} {
  const markStart = vi.fn();
  const markEnd = vi.fn();

  return {
    tracker: { markStart, markEnd } as unknown as PerfTracker,
    markStart,
    markEnd,
  };
}

describe('installAutoPerf', () => {
  const EXPECTED_PHASES: readonly LifecyclePhase[] = [
    'load',
    'bootstrap',
    'mount',
    'unmount',
    'update',
  ];

  it('registers before/after hooks for all lifecycle phases', () => {
    const hooks = createMockHooks();
    const { tracker } = createMockPerfTracker();

    installAutoPerf(hooks, tracker);

    const beforePhases = hooks.registeredBefore.map((entry) => entry.phase);
    const afterPhases = hooks.registeredAfter.map((entry) => entry.phase);

    expect(beforePhases).toStrictEqual([...EXPECTED_PHASES]);
    expect(afterPhases).toStrictEqual([...EXPECTED_PHASES]);
  });

  it('before hook calls markStart', () => {
    const hooks = createMockHooks();
    const { tracker, markStart } = createMockPerfTracker();

    installAutoPerf(hooks, tracker);

    const mountBeforeHook = hooks.registeredBefore.find((entry) => entry.phase === 'mount');
    mountBeforeHook!.hook({ appName: 'test-app', phase: 'mount' });

    expect(markStart).toHaveBeenCalledWith('test-app', 'mount');
  });

  it('after hook calls markEnd', () => {
    const hooks = createMockHooks();
    const { tracker, markEnd } = createMockPerfTracker();

    installAutoPerf(hooks, tracker);

    const mountAfterHook = hooks.registeredAfter.find((entry) => entry.phase === 'mount');
    mountAfterHook!.hook({ appName: 'test-app', phase: 'mount' });

    expect(markEnd).toHaveBeenCalledWith('test-app', 'mount');
  });
});
