import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { createReactMfeApp } from './create-mfe-app.js';

/** Simple React component for testing */
function TestApp(): ReactNode {
  return createElement('div', { 'data-testid': 'test-app' }, 'Hello MFE');
}

/** Test component that accepts props */
function PropsApp({ name }: { name: string }): ReactNode {
  return createElement('span', null, `Hello ${name}`);
}

/** Test Wrapper component */
function TestWrapper({ children }: { children: ReactNode }): ReactNode {
  return createElement('div', { 'data-testid': 'wrapper' }, children);
}

describe('createReactMfeApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('returns an MfeApp lifecycle interface', () => {
    const app = createReactMfeApp({ rootComponent: TestApp });

    expect(typeof app.bootstrap).toBe('function');
    expect(typeof app.mount).toBe('function');
    expect(typeof app.unmount).toBe('function');
    expect(typeof app.update).toBe('function');
  });

  it('bootstrap completes without errors', async () => {
    const app = createReactMfeApp({ rootComponent: TestApp });
    await expect(app.bootstrap()).resolves.toStrictEqual(undefined);
  });

  it('renders the component to the DOM after mount', async () => {
    const app = createReactMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    expect(container.innerHTML).toContain('Hello MFE');
  });

  it('cleans up the DOM after unmount', async () => {
    const app = createReactMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);

    expect(container.innerHTML).toBe('');
  });

  it('applies Provider wrapping via wrapWith', async () => {
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

  it('re-renders when props are changed via update', async () => {
    const app = createReactMfeApp({ rootComponent: PropsApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.update!({ name: 'World' });

    expect(container.innerHTML).toContain('Hello World');
  });

  it('can mount again after unmount (route re-entry)', async () => {
    const app = createReactMfeApp({ rootComponent: TestApp });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.mount(container);

    expect(container.innerHTML).toContain('Hello MFE');
  });
});
