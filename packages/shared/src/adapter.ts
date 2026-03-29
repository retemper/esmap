import type { MfeApp } from './types/lifecycle.js';
import type { DefineAdapterOptions } from './types/adapter.js';

/**
 * 프레임워크 어댑터를 정의하여 MfeApp 라이프사이클 객체를 생성한다.
 * 프레임워크별 렌더링 로직(protocol)만 제공하면 bootstrap/mount/unmount/update를
 * 자동으로 구현한다.
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
 * @typeParam TContext - 프레임워크별 렌더링 컨텍스트
 * @param options - 어댑터 정의 옵션
 * @returns MfeApp 라이프사이클 객체
 */
export function defineAdapter<TContext>(options: DefineAdapterOptions<TContext>): MfeApp {
  const { name, protocol } = options;

  const ref: { context: TContext | null; container: HTMLElement | null } = {
    context: null,
    container: null,
  };

  return {
    async bootstrap(): Promise<void> {
      // 대부분의 프레임워크는 bootstrap 단계에서 할 작업이 없다
    },

    async mount(container: HTMLElement): Promise<void> {
      if (ref.context !== null) {
        throw new Error(`[${name}] 이미 마운트된 어댑터를 다시 마운트할 수 없습니다`);
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
