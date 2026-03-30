import type { MfeApp } from '@esmap/shared';

/** Lifecycle phase name */
type LifecyclePhase = 'bootstrap' | 'mount' | 'unmount' | 'update';

/** Spy information that records lifecycle method calls */
export interface SpyCall {
  /** Arguments passed at invocation */
  readonly args: readonly unknown[];
  /** Timestamp at invocation */
  readonly timestamp: number;
}

/** Lifecycle spy function with call tracking capability */
export interface LifecycleSpy {
  /** Spy function body. Internally records calls when invoked. */
  (...args: readonly unknown[]): Promise<void>;
  /** Accumulated call records */
  readonly calls: readonly SpyCall[];
  /** Number of calls */
  readonly callCount: number;
  /** Resets the call records. */
  reset(): void;
}

/** Extended MfeApp interface returned by createMockApp */
export interface MockMfeApp extends MfeApp {
  /** bootstrap call spy */
  readonly bootstrapSpy: LifecycleSpy;
  /** mount call spy */
  readonly mountSpy: LifecycleSpy;
  /** unmount call spy */
  readonly unmountSpy: LifecycleSpy;
  /** update call spy */
  readonly updateSpy: LifecycleSpy;
}

/** Override options that can be passed to createMockApp */
export interface MockAppOverrides {
  /** Custom logic to execute on bootstrap call */
  readonly bootstrap?: () => Promise<void>;
  /** Custom logic to execute on mount call */
  readonly mount?: (container: HTMLElement) => Promise<void>;
  /** Custom logic to execute on unmount call */
  readonly unmount?: (container: HTMLElement) => Promise<void>;
  /** Custom logic to execute on update call */
  readonly update?: (props: Readonly<Record<string, unknown>>) => Promise<void>;
}

/**
 * Creates a lifecycle spy function with call tracking.
 * @param implementation - implementation function to execute when the spy is called
 */
function createLifecycleSpy(
  implementation: (...args: readonly unknown[]) => Promise<void> = () => Promise.resolve(),
): LifecycleSpy {
  const calls: SpyCall[] = [];

  const spy = ((...args: readonly unknown[]): Promise<void> => {
    calls.push({ args, timestamp: Date.now() });
    return implementation(...args);
  }) as LifecycleSpy & { reset(): void };

  Object.defineProperty(spy, 'calls', {
    get: () => [...calls],
  });

  Object.defineProperty(spy, 'callCount', {
    get: () => calls.length,
  });

  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}

/**
 * Creates a mock MFE app for testing.
 * Each lifecycle method is implemented as a spy function with call tracking.
 * @param overrides - custom implementations for lifecycle methods
 */
export function createMockApp(overrides?: MockAppOverrides): MockMfeApp {
  const bootstrapSpy = createLifecycleSpy(overrides?.bootstrap);
  const mountSpy = createLifecycleSpy(
    overrides?.mount
      ? (...args: readonly unknown[]) => overrides.mount!(args[0] as HTMLElement)
      : undefined,
  );
  const unmountSpy = createLifecycleSpy(
    overrides?.unmount
      ? (...args: readonly unknown[]) => overrides.unmount!(args[0] as HTMLElement)
      : undefined,
  );
  const updateSpy = createLifecycleSpy(
    overrides?.update
      ? (...args: readonly unknown[]) =>
          overrides.update!(args[0] as Readonly<Record<string, unknown>>)
      : undefined,
  );

  return {
    bootstrap: () => bootstrapSpy(),
    mount: (container: HTMLElement) => mountSpy(container),
    unmount: (container: HTMLElement) => unmountSpy(container),
    update: (props: Readonly<Record<string, unknown>>) => updateSpy(props),
    bootstrapSpy,
    mountSpy,
    unmountSpy,
    updateSpy,
  };
}

/**
 * Creates a mock MFE app that throws an error at a specific lifecycle phase.
 * @param phase - lifecycle phase at which to throw the error
 * @param error - error object to throw (default: an Error containing the phase name)
 */
export function createFailingApp(
  phase: LifecyclePhase,
  error: Error = new Error(`${phase} failed`),
): MockMfeApp {
  const failingImpl = (): Promise<void> => Promise.reject(error);

  const overrides: MockAppOverrides = {
    ...(phase === 'bootstrap' ? { bootstrap: failingImpl } : {}),
    ...(phase === 'mount' ? { mount: () => failingImpl() } : {}),
    ...(phase === 'unmount' ? { unmount: () => failingImpl() } : {}),
    ...(phase === 'update' ? { update: () => failingImpl() } : {}),
  };

  return createMockApp(overrides);
}
