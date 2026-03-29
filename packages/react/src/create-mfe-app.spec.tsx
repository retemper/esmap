import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { createReactMfeApp } from './create-mfe-app.js';

/** 테스트용 간단한 React 컴포넌트 */
function TestApp(): ReactNode {
  return createElement('div', { 'data-testid': 'test-app' }, 'Hello MFE');
}

/** 테스트용 props 받는 컴포넌트 */
function PropsApp({ name }: { name: string }): ReactNode {
  return createElement('span', null, `Hello ${name}`);
}

/** 테스트용 Wrapper 컴포넌트 */
function TestWrapper({ children }: { children: ReactNode }): ReactNode {
  return createElement('div', { 'data-testid': 'wrapper' }, children);
}

describe('createReactMfeApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('MfeApp 라이프사이클 인터페이스를 반환한다', () => {
    const app = createReactMfeApp({ rootComponent: TestApp });

    expect(typeof app.bootstrap).toBe('function');
    expect(typeof app.mount).toBe('function');
    expect(typeof app.unmount).toBe('function');
    expect(typeof app.update).toBe('function');
  });

  it('bootstrap은 에러 없이 완료된다', async () => {
    const app = createReactMfeApp({ rootComponent: TestApp });
    await expect(app.bootstrap()).resolves.toStrictEqual(undefined);
  });

  it('mount 후 컴포넌트가 DOM에 렌더링된다', async () => {
    const app = createReactMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    expect(container.innerHTML).toContain('Hello MFE');
  });

  it('unmount 후 DOM이 정리된다', async () => {
    const app = createReactMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);

    expect(container.innerHTML).toBe('');
  });

  it('wrapWith로 Provider 래핑이 적용된다', async () => {
    const app = createReactMfeApp({
      rootComponent: TestApp,
      wrapWith: TestWrapper,
    });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    expect(container.innerHTML).toContain('data-testid="wrapper"');
    expect(container.innerHTML).toContain('Hello MFE');
  });

  it('update로 props를 변경하면 리렌더링된다', async () => {
    const app = createReactMfeApp({ rootComponent: PropsApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.update!({ name: 'World' });

    expect(container.innerHTML).toContain('Hello World');
  });

  it('unmount 후 다시 mount할 수 있다 (라우트 재진입)', async () => {
    const app = createReactMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.mount(container);

    expect(container.innerHTML).toContain('Hello MFE');
  });
});
