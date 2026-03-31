import type { PerfTracker } from '@esmap/monitor';
import type { LifecycleHooks, LifecyclePhase } from '@esmap/runtime';

/** Lifecycle phases targeted for automatic instrumentation */
const TRACKED_PHASES: readonly LifecyclePhase[] = [
  'load',
  'bootstrap',
  'mount',
  'unmount',
  'update',
];

/**
 * Automatically connects PerfTracker to LifecycleHooks to instrument all lifecycle phases.
 * Calls markStart in before hooks and markEnd in after hooks.
 * @param hooks - lifecycle hooks manager
 * @param perf - performance tracker
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
