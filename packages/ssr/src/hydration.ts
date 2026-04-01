import type { MfeApp } from '@esmap/shared';
import { defineAdapter } from '@esmap/shared';
import type { ComponentType } from 'react';
import { createElement } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';

/** Options for creating a hydration-aware React MFE app */
export interface ReactHydrationAppOptions<
  P extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Root React component (same as createReactMfeApp) */
  readonly rootComponent: ComponentType<P>;
  /** Wrapper component (same as createReactMfeApp) */
  readonly wrapWith?: ComponentType<{ children: React.ReactNode }>;
}

/**
 * Creates a React MFE app that hydrates server-rendered HTML on first mount.
 * Subsequent mounts (after unmount) use createRoot instead of hydrateRoot.
 * Drop-in replacement for createReactMfeApp when SSR is used.
 *
 * @param options - same options as createReactMfeApp
 * @returns MfeApp lifecycle object that hydrates on first mount
 */
export function createReactHydrationApp<
  P extends Record<string, unknown> = Record<string, unknown>,
>(options: ReactHydrationAppOptions<P>): MfeApp {
  const propsRef: { current: Readonly<Record<string, unknown>> } = { current: {} };
  const state = { hydrated: false };

  /** Builds the React element tree */
  function buildElement(): React.ReactElement {
    const componentElement = createElement(options.rootComponent, propsRef.current as Readonly<P>);
    return options.wrapWith
      ? createElement(options.wrapWith, null, componentElement)
      : componentElement;
  }

  /** Re-renders on the given root */
  function renderToRoot(root: Root): void {
    flushSync(() => {
      root.render(buildElement());
    });
  }

  return defineAdapter<Root>({
    name: 'react-hydration',
    protocol: {
      mount(container) {
        if (!state.hydrated && container.innerHTML.trim() !== '') {
          state.hydrated = true;
          return hydrateRoot(container, buildElement());
        }

        const root = createRoot(container);
        renderToRoot(root);
        return root;
      },
      update(root, props) {
        propsRef.current = props;
        renderToRoot(root);
      },
      unmount(root, container) {
        root.unmount();
        container.innerHTML = '';
      },
    },
  });
}
