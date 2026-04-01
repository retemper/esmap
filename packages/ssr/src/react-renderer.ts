import type { ComponentType } from 'react';
import { createElement } from 'react';
import { renderToString as reactRenderToString } from 'react-dom/server';

/** Options for React server-side rendering */
export interface ReactSsrOptions<P extends Record<string, unknown> = Record<string, unknown>> {
  /** Root React component to render */
  readonly rootComponent: ComponentType<P>;
  /** Wrapper component (e.g., providers). Must render children. */
  readonly wrapWith?: ComponentType<{ children: React.ReactNode }>;
  /** Props passed to the root component */
  readonly props?: P;
}

/**
 * Renders a React component tree to an HTML string on the server.
 * Use this to implement the `ssrRender` export in React-based MFE modules.
 *
 * @param options - React SSR options including the root component and optional wrapper
 * @returns HTML string of the rendered component tree
 */
export function renderReactToString<P extends Record<string, unknown> = Record<string, unknown>>(
  options: ReactSsrOptions<P>,
): string {
  const element = buildElement(options);
  return reactRenderToString(element);
}

/**
 * Creates an `ssrRender` function for a React MFE app.
 * This pairs with `createReactMfeApp` from `@esmap/react` — use it to add SSR capability
 * to the same MFE entry module that already exports bootstrap/mount/unmount.
 *
 * @example
 * ```ts
 * import { createReactMfeApp } from '@esmap/react';
 * import { createReactSsrRender } from '@esmap/ssr';
 * import App from './App';
 *
 * const { bootstrap, mount, unmount } = createReactMfeApp({ rootComponent: App });
 * const ssrRender = createReactSsrRender({ rootComponent: App });
 *
 * export { bootstrap, mount, unmount, ssrRender };
 * ```
 *
 * @param options - React SSR options (same rootComponent/wrapWith as createReactMfeApp)
 * @returns ssrRender function compatible with the SsrMfeModule interface
 */
export function createReactSsrRender<P extends Record<string, unknown> = Record<string, unknown>>(
  options: Omit<ReactSsrOptions<P>, 'props'>,
): (props?: Readonly<Record<string, unknown>>) => string {
  return (props) => {
    return renderReactToString({
      ...options,
      props: props as P,
    });
  };
}

/** Builds the React element tree from options */
function buildElement<P extends Record<string, unknown>>(
  options: ReactSsrOptions<P>,
): React.ReactElement {
  const componentElement = createElement(options.rootComponent, (options.props ?? {}) as P);

  if (options.wrapWith) {
    return createElement(options.wrapWith, null, componentElement);
  }

  return componentElement;
}
