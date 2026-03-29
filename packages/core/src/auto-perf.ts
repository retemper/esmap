import type { PerfTracker } from '@esmap/monitor';
import type { LifecycleHooks, LifecyclePhase } from '@esmap/runtime';

/** 자동 계측 대상 라이프사이클 단계 */
const TRACKED_PHASES: readonly LifecyclePhase[] = [
  'load',
  'bootstrap',
  'mount',
  'unmount',
  'update',
];

/**
 * PerfTracker를 LifecycleHooks에 자동 연결하여 모든 라이프사이클 단계를 자동 계측한다.
 * before 훅에서 markStart, after 훅에서 markEnd를 호출한다.
 * @param hooks - 라이프사이클 훅 관리자
 * @param perf - 성능 트래커
 */
export function installAutoPerf(hooks: LifecycleHooks, perf: PerfTracker): void {
  for (const phase of TRACKED_PHASES) {
    hooks.beforeEach(phase, (ctx) => {
      perf.markStart(ctx.appName, phase);
    });
    hooks.afterEach(phase, (ctx) => {
      perf.markEnd(ctx.appName, phase);
    });
  }
}
