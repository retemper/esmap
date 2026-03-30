/** Lifecycle phase */
export type LifecyclePhase = 'load' | 'bootstrap' | 'mount' | 'unmount' | 'update';

/** Hook execution timing */
type HookTiming = 'before' | 'after';

/** Context passed to hooks */
export interface HookContext {
  /** Target app name */
  readonly appName: string;
  /** Current lifecycle phase */
  readonly phase: LifecyclePhase;
}

/** Lifecycle hook function */
export type LifecycleHook = (ctx: HookContext) => Promise<void> | void;

/** Hook error information */
export interface HookError {
  /** Context of the hook that threw the error */
  readonly context: HookContext;
  /** Original error */
  readonly error: unknown;
}

/** Lifecycle hooks creation options */
export interface LifecycleHooksOptions {
  /**
   * Hook error handler. When set, catches individual hook errors and continues executing remaining hooks.
   * When not set, throws immediately on the first error.
   */
  readonly onError?: (hookError: HookError) => void;
}

/** Registered hook entry */
interface HookEntry {
  readonly phase: LifecyclePhase;
  readonly timing: HookTiming;
  readonly hook: LifecycleHook;
  /** Global hook if undefined */
  readonly appName?: string;
}

/** Lifecycle hooks manager */
export interface LifecycleHooks {
  /** Registers a global hook to run before a specific phase for all apps */
  beforeEach(phase: LifecyclePhase, hook: LifecycleHook): void;
  /** Registers a global hook to run after a specific phase for all apps */
  afterEach(phase: LifecyclePhase, hook: LifecycleHook): void;
  /** Registers a hook to run before a specific phase for a specific app */
  before(appName: string, phase: LifecyclePhase, hook: LifecycleHook): void;
  /** Registers a hook to run after a specific phase for a specific app */
  after(appName: string, phase: LifecyclePhase, hook: LifecycleHook): void;
  /** Executes registered hooks */
  runHooks(appName: string, phase: LifecyclePhase, timing: HookTiming): Promise<void>;
}

/**
 * Creates a lifecycle hooks manager.
 * Allows registering and executing global and per-app before/after hooks.
 * @param options - hook execution options (error handler, etc.)
 * @returns LifecycleHooks instance
 */
export function createLifecycleHooks(options?: LifecycleHooksOptions): LifecycleHooks {
  const entries: HookEntry[] = [];

  return {
    beforeEach(phase: LifecyclePhase, hook: LifecycleHook): void {
      entries.push({ phase, timing: 'before', hook });
    },

    afterEach(phase: LifecyclePhase, hook: LifecycleHook): void {
      entries.push({ phase, timing: 'after', hook });
    },

    before(appName: string, phase: LifecyclePhase, hook: LifecycleHook): void {
      entries.push({ phase, timing: 'before', hook, appName });
    },

    after(appName: string, phase: LifecyclePhase, hook: LifecycleHook): void {
      entries.push({ phase, timing: 'after', hook, appName });
    },

    async runHooks(appName: string, phase: LifecyclePhase, timing: HookTiming): Promise<void> {
      const ctx: HookContext = { appName, phase };

      const matching = entries.filter(
        (entry) =>
          entry.phase === phase &&
          entry.timing === timing &&
          (entry.appName === undefined || entry.appName === appName),
      );

      for (const entry of matching) {
        if (options?.onError) {
          try {
            await entry.hook(ctx);
          } catch (error) {
            options.onError({ context: ctx, error });
          }
        } else {
          await entry.hook(ctx);
        }
      }
    },
  };
}
