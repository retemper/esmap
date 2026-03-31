import type { MfeApp } from '@esmap/shared';
import { defineAdapter } from '@esmap/shared';
import { createApp, h, ref, type App, type Component } from 'vue';

/** Vue MFE app creation options */
export interface VueMfeAppOptions {
  /** Vue component to mount */
  readonly rootComponent: Component;
  /** Wrapper around the component (e.g., plugin provider). Must render a default slot. */
  readonly wrapWith?: Component;
}

/**
 * Converts a Vue 3 component into an esmap MfeApp lifecycle.
 * Built on defineAdapter, it automatically manages createApp/unmount to prevent memory leaks.
 *
 * @example
 * ```ts
 * import { createVueMfeApp } from '@esmap/vue';
 * import App from './App.vue';
 *
 * export default createVueMfeApp({ rootComponent: App });
 * ```
 *
 * @param options - Vue MFE app options
 * @returns MfeApp lifecycle object
 */
export function createVueMfeApp(options: VueMfeAppOptions): MfeApp {
  /** Reactive props source shared between mount and update */
  const propsRef = ref<Readonly<Record<string, unknown>>>({});

  return defineAdapter<App>({
    name: 'vue',
    protocol: {
      mount(container) {
        const app = createApp({
          setup() {
            return () => {
              const componentVNode = h(options.rootComponent, { ...propsRef.value });

              if (options.wrapWith) {
                return h(options.wrapWith, null, { default: () => componentVNode });
              }

              return componentVNode;
            };
          },
        });

        app.mount(container);
        return app;
      },
      update(_app, props) {
        propsRef.value = props;
      },
      unmount(app, container) {
        app.unmount();
        container.innerHTML = '';
      },
    },
  });
}
