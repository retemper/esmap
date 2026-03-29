/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import type { LifecycleHooks, LifecyclePhase, LifecycleHook } from '@esmap/runtime';
import type { PerfTracker } from '@esmap/monitor';
import { installAutoPerf } from './auto-perf.js';

/** 테스트용 LifecycleHooks 모의 객체를 생성한다 */
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

/** 테스트용 PerfTracker 모의 객체를 생성한다 */
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

  it('모든 라이프사이클 단계에 대해 before/after 훅이 등록된다', () => {
    const hooks = createMockHooks();
    const { tracker } = createMockPerfTracker();

    installAutoPerf(hooks, tracker);

    const beforePhases = hooks.registeredBefore.map((entry) => entry.phase);
    const afterPhases = hooks.registeredAfter.map((entry) => entry.phase);

    expect(beforePhases).toStrictEqual([...EXPECTED_PHASES]);
    expect(afterPhases).toStrictEqual([...EXPECTED_PHASES]);
  });

  it('before 훅이 markStart를 호출한다', () => {
    const hooks = createMockHooks();
    const { tracker, markStart } = createMockPerfTracker();

    installAutoPerf(hooks, tracker);

    const mountBeforeHook = hooks.registeredBefore.find((entry) => entry.phase === 'mount');
    mountBeforeHook!.hook({ appName: 'test-app', phase: 'mount' });

    expect(markStart).toHaveBeenCalledWith('test-app', 'mount');
  });

  it('after 훅이 markEnd를 호출한다', () => {
    const hooks = createMockHooks();
    const { tracker, markEnd } = createMockPerfTracker();

    installAutoPerf(hooks, tracker);

    const mountAfterHook = hooks.registeredAfter.find((entry) => entry.phase === 'mount');
    mountAfterHook!.hook({ appName: 'test-app', phase: 'mount' });

    expect(markEnd).toHaveBeenCalledWith('test-app', 'mount');
  });
});
