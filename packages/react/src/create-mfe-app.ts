import type { MfeApp } from '@esmap/shared';
import { defineAdapter } from '@esmap/shared';
import type { ComponentType } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';

/** React MFE app creation options */
export interface ReactMfeAppOptions<P extends Record<string, unknown> = Record<string, unknown>> {
  /** React component to mount */
  readonly rootComponent: ComponentType<P>;
  /** Wrapper around the component (e.g., Provider). Must render children. */
  readonly wrapWith?: ComponentType<{ children: React.ReactNode }>;
  /** Error boundary fallback UI */
  readonly errorBoundary?: ComponentType<{ error: Error }>;
}

/**
 * Converts a React component into an esmap MfeApp lifecycle.
 * Built on defineAdapter, it automatically manages createRoot/unmount to prevent memory leaks.
 *
 * @example
 * ```tsx
 * import { createReactMfeApp } from '@esmap/react';
 * import App from './App';
 *
 * export default createReactMfeApp({ rootComponent: App });
 * ```
 *
 * @param options - React MFE app options
 * @returns MfeApp lifecycle object
 */
export function createReactMfeApp<P extends Record<string, unknown> = Record<string, unknown>>(
  options: ReactMfeAppOptions<P>,
): MfeApp {
  /** Holds the latest props. Initial value is an empty object at mount time */
  const propsRef: { current: Readonly<Record<string, unknown>> } = { current: {} };

  /** Synchronously renders the component tree with the current props */
  function renderToRoot(root: Root): void {
    const componentElement = createElement(options.rootComponent, propsRef.current as Readonly<P>);

    const rendered = options.wrapWith
      ? createElement(options.wrapWith, null, componentElement)
      : componentElement;

    // Synchronous rendering via flushSync -- guarantees DOM is ready when mount() returns
    flushSync(() => {
      root.render(rendered);
    });
  }

  return defineAdapter<Root>({
    name: 'react',
    protocol: {
      mount(container) {
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
