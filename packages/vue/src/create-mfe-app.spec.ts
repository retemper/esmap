/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { defineComponent, h, type VNode } from 'vue';
import { createVueMfeApp } from './create-mfe-app.js';

/** Simple Vue component for testing */
const TestApp = defineComponent({
  setup() {
    return (): VNode => h('div', { 'data-testid': 'test-app' }, 'Hello MFE');
  },
});

/** Test component that accepts props */
const PropsApp = defineComponent({
  props: {
    name: { type: String, required: true },
  },
  setup(props) {
    return (): VNode => h('span', null, `Hello ${props.name}`);
  },
});

/** Test Wrapper component */
const TestWrapper = defineComponent({
  setup(_, { slots }) {
    return (): VNode => h('div', { 'data-testid': 'wrapper' }, slots.default?.());
  },
});

describe('createVueMfeApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('MfeApp 라이프사이클 인터페이스를 반환한다', () => {
    const app = createVueMfeApp({ rootComponent: TestApp });

    expect(typeof app.bootstrap).toBe('function');
    expect(typeof app.mount).toBe('function');
    expect(typeof app.unmount).toBe('function');
    expect(typeof app.update).toBe('function');
  });

  it('bootstrap가 에러 없이 완료된다', async () => {
    const app = createVueMfeApp({ rootComponent: TestApp });
    await expect(app.bootstrap()).resolves.toStrictEqual(undefined);
  });

  it('mount 후 컴포넌트를 DOM에 렌더링한다', async () => {
    const app = createVueMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    expect(container.innerHTML).toContain('Hello MFE');
  });

  it('unmount 후 DOM을 정리한다', async () => {
    const app = createVueMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);

    expect(container.innerHTML).toBe('');
  });

  it('wrapWith로 Provider 래핑을 적용한다', async () => {
    const app = createVueMfeApp({
      rootComponent: TestApp,
      wrapWith: TestWrapper,
    });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    expect(container.innerHTML).toContain('data-testid="wrapper"');
    expect(container.innerHTML).toContain('Hello MFE');
  });

  it('update로 props 변경 시 리렌더링한다', async () => {
    const app = createVueMfeApp({ rootComponent: PropsApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.update!({ name: 'World' });

    // Vue updates asynchronously — wait for the next tick
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(container.innerHTML).toContain('Hello World');
  });

  it('unmount 후 다시 mount할 수 있다 (라우트 재진입)', async () => {
    const app = createVueMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.mount(container);

    expect(container.innerHTML).toContain('Hello MFE');
  });
});
