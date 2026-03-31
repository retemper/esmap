import type { MfeApp } from './types/lifecycle.js';
import type { DefineAdapterOptions } from './types/adapter.js';

/**
 * Defines a framework adapter and creates an MfeApp lifecycle object.
 * Provide only the framework-specific rendering logic (protocol) and
 * bootstrap/mount/unmount/update are implemented automatically.
 *
 * @example
 * ```ts
 * const app = defineAdapter<Root>({
 *   name: 'react',
 *   protocol: {
 *     mount(container) {
 *       const root = createRoot(container);
 *       root.render(<App />);
 *       return root;
 *     },
 *     update(root, props) {
 *       root.render(<App {...props} />);
 *     },
 *     unmount(root, container) {
 *       root.unmount();
 *       container.innerHTML = '';
 *     },
 *   },
 * });
 * ```
 *
 * @typeParam TContext - framework-specific rendering context
 * @param options - adapter definition options
 * @returns MfeApp lifecycle object
 */
export function defineAdapter<TContext>(options: DefineAdapterOptions<TContext>): MfeApp {
  const { name, protocol } = options;

  const ref: { context: TContext | null; container: HTMLElement | null } = {
    context: null,
    container: null,
  };

  return {
    async bootstrap(): Promise<void> {
      // Most frameworks have nothing to do during the bootstrap phase
    },

    async mount(container: HTMLElement): Promise<void> {
      if (ref.context !== null) {
        throw new Error(`[${name}] Cannot mount an adapter that is already mounted`);
      }

      ref.context = protocol.mount(container);
      ref.container = container;
    },

    async unmount(container: HTMLElement): Promise<void> {
      if (ref.context === null) return;

      protocol.unmount(ref.context, container);
      ref.context = null;
      ref.container = null;
    },

    async update(props: Readonly<Record<string, unknown>>): Promise<void> {
      if (ref.context === null) return;

      protocol.update(ref.context, props);
    },
  };
}
