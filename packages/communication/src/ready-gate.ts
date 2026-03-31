/**
 * A gate that synchronizes readiness of shared resources.
 * Prevents dependent apps from mounting before required shared state
 * such as auth tokens or user info is ready.
 */

/** Readiness status of an individual resource */
interface ResourceStatus {
  /** Resource name */
  readonly name: string;
  /** Whether the resource is ready */
  readonly ready: boolean;
  /** Timestamp when the resource became ready. undefined if not yet ready */
  readonly readyAt: number | undefined;
}

/** ReadyGate options */
interface ReadyGateOptions {
  /** Maximum time (ms) to wait for all resources to be ready. Default: 10000 */
  readonly timeout?: number;
}

/** Shared resource readiness synchronization gate interface */
interface ReadyGate {
  /** Registers a resource to wait for. Ignores already registered resources. */
  register: (name: string) => void;
  /** Declares that a resource is ready. */
  markReady: (name: string) => void;
  /** Waits until the specified resource is ready. */
  waitFor: (name: string) => Promise<void>;
  /** Waits until all registered resources are ready. */
  waitForAll: () => Promise<void>;
  /** Waits until all resources in the specified list are ready. */
  waitForMany: (names: readonly string[]) => Promise<void>;
  /** Returns the current status of all resources. */
  getStatus: () => readonly ResourceStatus[];
  /** Immediately checks whether all resources are ready. */
  isAllReady: () => boolean;
  /** Resets the gate. Clears all registrations and pending waiters. */
  reset: () => void;
}

/**
 * Creates a shared resource readiness synchronization gate.
 *
 * @example
 * ```ts
 * // Create gate in the host app
 * const gate = createReadyGate({ timeout: 5000 });
 * gate.register('auth');
 * gate.register('config');
 *
 * // After auth app prepares the token
 * gate.markReady('auth');
 *
 * // Remote app waits for auth then mounts
 * await gate.waitFor('auth');
 * renderApp();
 * ```
 *
 * @param options - gate configuration
 * @returns ReadyGate instance
 */
function createReadyGate(options?: ReadyGateOptions): ReadyGate {
  const timeout = options?.timeout ?? 10000;

  /** Ready timestamp per resource. undefined means not yet ready */
  const resources = new Map<string, number | undefined>();
  /** Pending resolver list per resource */
  const waiters = new Map<string, Array<() => void>>();

  /**
   * Resolves all waiters for the given resource.
   * @param name - name of the ready resource
   */
  function resolveWaiters(name: string): void {
    const pending = waiters.get(name);
    if (pending) {
      for (const resolve of pending) {
        resolve();
      }
      waiters.delete(name);
    }
  }

  /**
   * Creates a timeout error.
   * @param names - names of the resources still being waited on
   */
  function createTimeoutError(names: readonly string[]): Error {
    return new Error(
      `[esmap] ReadyGate timed out (${timeout}ms): ` +
        `resources [${names.join(', ')}] are not ready.`,
    );
  }

  return {
    register(name: string): void {
      if (!resources.has(name)) {
        resources.set(name, undefined);
      }
    },

    markReady(name: string): void {
      // Unregistered resources can also be marked (implicit registration)
      resources.set(name, Date.now());
      resolveWaiters(name);
    },

    waitFor(name: string): Promise<void> {
      // Already ready resource
      if (resources.get(name) !== undefined) {
        return Promise.resolve();
      }

      // Implicitly register unregistered resources
      if (!resources.has(name)) {
        resources.set(name, undefined);
      }

      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          // Remove from the waiter list
          const pending = waiters.get(name);
          if (pending) {
            const idx = pending.indexOf(resolve);
            if (idx !== -1) {
              pending.splice(idx, 1);
            }
          }
          reject(createTimeoutError([name]));
        }, timeout);

        const wrappedResolve = (): void => {
          clearTimeout(timer);
          resolve();
        };

        const pending = waiters.get(name) ?? [];
        pending.push(wrappedResolve);
        waiters.set(name, pending);
      });
    },

    async waitForAll(): Promise<void> {
      const unreadyNames = [...resources.entries()]
        .filter(([, readyAt]) => readyAt === undefined)
        .map(([name]) => name);

      if (unreadyNames.length === 0) return;

      await Promise.all(unreadyNames.map((name) => this.waitFor(name)));
    },

    async waitForMany(names: readonly string[]): Promise<void> {
      await Promise.all(names.map((name) => this.waitFor(name)));
    },

    getStatus(): readonly ResourceStatus[] {
      return [...resources.entries()].map(([name, readyAt]) => ({
        name,
        ready: readyAt !== undefined,
        readyAt,
      }));
    },

    isAllReady(): boolean {
      for (const readyAt of resources.values()) {
        if (readyAt === undefined) return false;
      }
      return true;
    },

    reset(): void {
      // Pending Promises will naturally be rejected by their timeouts.
      // We do not reject immediately because reset is called at destroy time,
      // and we want to avoid unnecessarily triggering error handlers in apps already tearing down.
      waiters.clear();
      resources.clear();
    },
  };
}

export { createReadyGate };
export type { ReadyGate, ReadyGateOptions, ResourceStatus };
