/**
 * Guard that detects and prevents global pollution.
 * Monitors MFE apps adding unexpected properties to the window object.
 */

/** Global guard options */
export interface GlobalGuardOptions {
  /** List of allowed global variable names */
  readonly allowList?: readonly string[];
  /** Callback invoked on violation */
  readonly onViolation?: (violation: GlobalViolation) => void;
  /** Polling interval in ms. Default 1000. Lower values impact performance. */
  readonly interval?: number;
}

/** Global violation information */
export interface GlobalViolation {
  /** Name of the added/modified global variable */
  readonly property: string;
  /** Violation type */
  readonly type: 'add' | 'modify';
}

/** Guard disposal handle */
export interface GlobalGuardHandle {
  /** Disposes the guard and returns global variables added since the snapshot. */
  readonly dispose: () => readonly string[];
  /** Manually triggers an immediate check. */
  readonly check: () => void;
}

/**
 * Takes a snapshot of current window globals and detects subsequent changes.
 * @param options - guard options
 * @returns guard handle
 */
export function createGlobalGuard(options?: GlobalGuardOptions): GlobalGuardHandle {
  const snapshot = new Set(Object.keys(globalThis));
  const allowSet = new Set(options?.allowList ?? []);
  const addedSet = new Set<string>();
  const interval = options?.interval ?? 1000;

  /** Compares current globals against the snapshot to detect newly added variables. */
  function check(): void {
    const currentKeys = Object.keys(globalThis);
    for (const key of currentKeys) {
      if (!snapshot.has(key) && !allowSet.has(key) && !addedSet.has(key)) {
        addedSet.add(key);
        options?.onViolation?.({ property: key, type: 'add' });
      }
    }
  }

  const intervalId = setInterval(check, interval);

  return {
    dispose() {
      clearInterval(intervalId);
      return [...addedSet];
    },
    check,
  };
}

/**
 * Computes the diff of window globals once (no async polling).
 * @param before - previous set of global variable names
 * @param allowList - allow list
 * @returns list of newly added global variable names
 */
export function diffGlobals(
  before: ReadonlySet<string>,
  allowList: readonly string[] = [],
): readonly string[] {
  const allowSet = new Set(allowList);
  const currentKeys = Object.keys(globalThis);
  return currentKeys.filter((key) => !before.has(key) && !allowSet.has(key));
}

/** Creates a snapshot of current global variable names. */
export function snapshotGlobals(): ReadonlySet<string> {
  return new Set(Object.keys(globalThis));
}
