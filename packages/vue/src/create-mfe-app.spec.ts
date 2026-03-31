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

  it('returns the MfeApp lifecycle interface', () => {
    const app = createVueMfeApp({ rootComponent: TestApp });

    expect(typeof app.bootstrap).toBe('function');
    expect(typeof app.mount).toBe('function');
    expect(typeof app.unmount).toBe('function');
    expect(typeof app.update).toBe('function');
  });

  it('completes bootstrap without errors', async () => {
    const app = createVueMfeApp({ rootComponent: TestApp });
    await expect(app.bootstrap()).resolves.toStrictEqual(undefined);
  });

  it('renders the component into the DOM after mount', async () => {
    const app = createVueMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    expect(container.innerHTML).toContain('Hello MFE');
  });

  it('cleans up the DOM after unmount', async () => {
    const app = createVueMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);

    expect(container.innerHTML).toBe('');
  });

  it('applies wrapWith provider wrapping', async () => {
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

  it('re-renders when props change via update', async () => {
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

  it('can remount after unmount (route re-entry)', async () => {
    const app = createVueMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.mount(container);

    expect(container.innerHTML).toContain('Hello MFE');
  });
});
