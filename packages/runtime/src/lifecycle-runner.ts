import type { MfeApp, MfeAppStatus } from '@esmap/shared';

/** Lifecycle status change callback */
type StatusChangeCallback = (from: MfeAppStatus, to: MfeAppStatus) => void;

/** createLifecycleRunner options */
export interface LifecycleRunnerOptions {
  /** Target MfeApp to execute */
  readonly app: MfeApp;
  /** Target DOM element for mounting */
  readonly container: HTMLElement;
  /** Callback invoked on status changes */
  readonly onStatusChange?: StatusChangeCallback;
}

/**
 * Runner that safely executes MfeApp lifecycle.
 * Encapsulates state transition guards and error handling.
 */
export interface LifecycleRunner {
  /** Current lifecycle status */
  readonly status: MfeAppStatus;
  /** Executes bootstrap. NOT_LOADED -> BOOTSTRAPPING -> NOT_MOUNTED */
  bootstrap(): Promise<void>;
  /** Executes mount. NOT_MOUNTED -> MOUNTED */
  mount(): Promise<void>;
  /** Executes unmount. MOUNTED -> UNMOUNTING -> NOT_MOUNTED */
  unmount(): Promise<void>;
  /** Updates props. Only valid in MOUNTED state. */
  update(props: Readonly<Record<string, unknown>>): Promise<void>;
}

/**
 * Creates an MfeApp lifecycle runner.
 * Encapsulates state transition logic shared by AppRegistry and Parcel.
 *
 * @param options - runner options
 * @returns LifecycleRunner instance
 */
export function createLifecycleRunner(options: LifecycleRunnerOptions): LifecycleRunner {
  const { app, container, onStatusChange } = options;
  const state: { status: MfeAppStatus } = { status: 'NOT_LOADED' };

  /** Transitions state and invokes callback */
  function transition(to: MfeAppStatus): void {
    const from = state.status;
    state.status = to;
    onStatusChange?.(from, to);
  }

  return {
    get status(): MfeAppStatus {
      return state.status;
    },

    async bootstrap(): Promise<void> {
      if (state.status !== 'NOT_LOADED') return;

      try {
        transition('BOOTSTRAPPING');
        await app.bootstrap();
        transition('NOT_MOUNTED');
      } catch (error) {
        transition('LOAD_ERROR');
        throw error;
      }
    },

    async mount(): Promise<void> {
      if (state.status !== 'NOT_MOUNTED') {
        throw new Error(`Cannot mount in current state: ${state.status}`);
      }

      try {
        await app.mount(container);
        transition('MOUNTED');
      } catch (error) {
        transition('LOAD_ERROR');
        throw error;
      }
    },

    async unmount(): Promise<void> {
      if (state.status !== 'MOUNTED') {
        throw new Error(`Cannot unmount in current state: ${state.status}`);
      }

      transition('UNMOUNTING');
      try {
        await app.unmount(container);
        transition('NOT_MOUNTED');
      } catch (error) {
        transition('LOAD_ERROR');
        throw error;
      }
    },

    async update(props: Readonly<Record<string, unknown>>): Promise<void> {
      if (state.status !== 'MOUNTED') {
        throw new Error(`Cannot update in current state: ${state.status}`);
      }

      if (!app.update) {
        throw new Error('App does not implement the update lifecycle');
      }

      await app.update(props);
    },
  };
}
