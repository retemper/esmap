import type { MfeApp } from '@esmap/shared';
import { defineAdapter } from '@esmap/shared';
import type { ComponentType } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';

/** React MFE 앱 생성 옵션 */
export interface ReactMfeAppOptions<P extends Record<string, unknown> = Record<string, unknown>> {
  /** 마운트할 React 컴포넌트 */
  readonly rootComponent: ComponentType<P>;
  /** 컴포넌트를 감싸는 Wrapper (Provider 등). children을 렌더링해야 한다. */
  readonly wrapWith?: ComponentType<{ children: React.ReactNode }>;
  /** 에러 바운더리 폴백 UI */
  readonly errorBoundary?: ComponentType<{ error: Error }>;
}

/**
 * React 컴포넌트를 esmap MfeApp 라이프사이클로 변환한다.
 * defineAdapter 기반으로 구현되어 createRoot/unmount를 자동 관리하며 메모리 누수를 방지한다.
 *
 * @example
 * ```tsx
 * import { createReactMfeApp } from '@esmap/react';
 * import App from './App';
 *
 * export default createReactMfeApp({ rootComponent: App });
 * ```
 *
 * @param options - React MFE 앱 옵션
 * @returns MfeApp 라이프사이클 객체
 */
export function createReactMfeApp<P extends Record<string, unknown> = Record<string, unknown>>(
  options: ReactMfeAppOptions<P>,
): MfeApp {
  /** 최신 props를 보관한다. mount 시 초기값은 빈 객체 */
  const propsRef: { current: Readonly<Record<string, unknown>> } = { current: {} };

  /** 현재 props로 컴포넌트 트리를 동기적으로 렌더링한다 */
  function renderToRoot(root: Root): void {
    const componentElement = createElement(
      options.rootComponent,
      propsRef.current as Readonly<P>,
    );

    const rendered = options.wrapWith
      ? createElement(options.wrapWith, null, componentElement)
      : componentElement;

    // flushSync로 동기 렌더링 — mount() 반환 시 DOM이 준비됨을 보장
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
