import type { MfeApp } from '@esmap/shared';
import type { ApplicationRef, Type, Provider } from '@angular/core';
import { signal } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { ESMAP_PROPS } from './props-token.js';

/** Angular MFE app creation options */
export interface AngularMfeAppOptions {
  /** Root Angular standalone component to bootstrap */
  readonly rootComponent: Type<unknown>;
  /** Additional providers to register at the application level */
  readonly providers?: readonly Provider[];
}

/**
 * Converts an Angular standalone component into an esmap MfeApp lifecycle.
 * Implements MfeApp directly (rather than using AdapterProtocol) because Angular
 * bootstrapping is inherently async, which doesn't fit the sync protocol contract.
 *
 * Props are delivered via the ESMAP_PROPS injection token as a Signal.
 * Requires Angular 17+ standalone component API.
 *
 * @example
 * ```ts
 * import { createAngularMfeApp } from '@esmap/angular';
 * import { AppComponent } from './app.component';
 *
 * export default createAngularMfeApp({ rootComponent: AppComponent });
 * ```
 *
 * @param options - Angular MFE app options
 * @returns MfeApp lifecycle object
 */
export function createAngularMfeApp(options: AngularMfeAppOptions): MfeApp {
  const ref: { appRef: ApplicationRef | null } = { appRef: null };

  /** Writable signal that holds the latest props from the shell */
  const propsSignal = signal<Readonly<Record<string, unknown>>>({});

  return {
    async bootstrap(): Promise<void> {
      // Angular bootstrapping happens in mount() because it requires the DOM container
    },

    async mount(container: HTMLElement): Promise<void> {
      if (ref.appRef !== null) {
        throw new Error('[angular] Cannot mount an adapter that is already mounted');
      }

      const hostElement = document.createElement(resolveSelector(options.rootComponent));
      container.appendChild(hostElement);

      const appRef = await createApplication({
        providers: [
          { provide: ESMAP_PROPS, useValue: propsSignal.asReadonly() },
          ...(options.providers ?? []),
        ],
      });

      appRef.bootstrap(options.rootComponent, hostElement);
      ref.appRef = appRef;
    },

    async unmount(container: HTMLElement): Promise<void> {
      if (ref.appRef === null) return;

      ref.appRef.destroy();
      ref.appRef = null;
      container.innerHTML = '';
    },

    async update(props: Readonly<Record<string, unknown>>): Promise<void> {
      propsSignal.set(props);
    },
  };
}

/**
 * Resolves the CSS selector for an Angular component.
 * Falls back to a kebab-case conversion of the class name.
 */
function resolveSelector(component: Type<unknown>): string {
  // Angular stores component metadata in the ɵcmp static property
  const cmpDef = (component as unknown as Record<string, unknown>)['ɵcmp'] as
    | { readonly selectors: ReadonlyArray<ReadonlyArray<string>> }
    | undefined;

  if (cmpDef?.selectors?.[0]?.[0]) {
    return cmpDef.selectors[0][0];
  }

  // Fallback: derive selector from class name (e.g., AppComponent -> app)
  const name = component.name || 'app-root';
  return name
    .replace(/Component$/, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}
