import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import { createLifecycleRunner } from './lifecycle-runner.js';

/** Parcel creation options */
export interface ParcelOptions {
  /** MfeApp to mount, or an async loader function */
  readonly app: MfeApp | (() => Promise<MfeApp>);
  /** Target DOM element for mounting */
  readonly domElement: HTMLElement;
  /** Initial props to pass to the app */
  readonly props?: Readonly<Record<string, unknown>>;
}

/** Parcel instance that controls an app independently of routing */
export interface Parcel {
  /** Current status */
  readonly status: MfeAppStatus;
  /** Updates props */
  update(props: Readonly<Record<string, unknown>>): Promise<void>;
  /** Unmounts the app */
  unmount(): Promise<void>;
}

/**
 * Mounts an app to a DOM element independently of routing, creating a Parcel.
 * Similar to single-spa's mountRootParcel pattern.
 * Uses LifecycleRunner internally to manage state transitions.
 *
 * @param options - parcel creation options
 * @returns mounted Parcel instance
 */
export async function mountParcel(options: ParcelOptions): Promise<Parcel> {
  const resolvedApp = typeof options.app === 'function' ? await options.app() : options.app;

  const runner = createLifecycleRunner({
    app: resolvedApp,
    container: options.domElement,
  });

  await runner.bootstrap();
  await runner.mount();

  if (options.props && resolvedApp.update) {
    await runner.update(options.props);
  }

  return {
    get status(): MfeAppStatus {
      return runner.status;
    },
    update: (props) => runner.update(props),
    unmount: () => runner.unmount(),
  };
}
