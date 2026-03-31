/**
 * Lifecycle status of an MFE app.
 * Transition from NOT_MOUNTED to MOUNTED is possible (on route re-entry).
 * FROZEN is a keep-alive state where the DOM is preserved but deactivated.
 */
export type MfeAppStatus =
  | 'NOT_LOADED'
  | 'LOADING'
  | 'BOOTSTRAPPING'
  | 'NOT_MOUNTED'
  | 'MOUNTED'
  | 'UNMOUNTING'
  | 'FROZEN'
  | 'LOAD_ERROR';

/**
 * Lifecycle interface that an MFE app must implement.
 * Each MFE's entry module default-exports or named-exports this interface.
 */
export interface MfeApp {
  /** Initial app setup. Called only once. */
  bootstrap(): Promise<void>;
  /** Mounts the app into the DOM container. May be called on each route entry. */
  mount(container: HTMLElement): Promise<void>;
  /** Unmounts the app from the DOM container. */
  unmount(container: HTMLElement): Promise<void>;
  /** Called when props change while mounted (optional). */
  update?(props: Readonly<Record<string, unknown>>): Promise<void>;
}

/**
 * MFE app registration info managed at runtime.
 */
export interface RegisteredApp {
  /** App name (import map specifier, e.g., "@flex/checkout") */
  readonly name: string;
  /** Active route matching function */
  readonly activeWhen: (location: Location) => boolean;
  /** Function that loads the app module */
  readonly loadApp: () => Promise<MfeApp>;
  /** DOM selector for the mount target */
  readonly container: string;
  /** Current status (mutable only at runtime) */
  status: MfeAppStatus;
  /** Loaded app instance (after loading) */
  app?: MfeApp;
}
