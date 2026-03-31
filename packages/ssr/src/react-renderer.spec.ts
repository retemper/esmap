import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderReactToString, createReactSsrRender } from './react-renderer.js';

describe('renderReactToString', () => {
  it('renders a React component to an HTML string', () => {
    const App = () => createElement('div', null, 'Hello SSR');

    const html = renderReactToString({ rootComponent: App });

    expect(html).toBe('<div>Hello SSR</div>');
  });

  it('passes props to the component', () => {
    const App = ({ name }: { name: string }) => createElement('span', null, `Hi ${name}`);

    const html = renderReactToString({
      rootComponent: App,
      props: { name: 'World' },
    });

    expect(html).toBe('<span>Hi World</span>');
  });

  it('wraps the component with wrapWith', () => {
    const App = () => createElement('div', null, 'Content');
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement('main', { className: 'wrapper' }, children);

    const html = renderReactToString({
      rootComponent: App,
      wrapWith: Wrapper,
    });

    expect(html).toContain('<main class="wrapper">');
    expect(html).toContain('<div>Content</div>');
  });
});

describe('createReactSsrRender', () => {
  it('creates an ssrRender function', () => {
    const App = () => createElement('div', null, 'SSR App');

    const ssrRender = createReactSsrRender({ rootComponent: App });
    const html = ssrRender();

    expect(html).toBe('<div>SSR App</div>');
  });

  it('passes runtime props to the component', () => {
    const App = ({ count }: { count: number }) => createElement('span', null, `Count: ${count}`);

    const ssrRender = createReactSsrRender({ rootComponent: App });
    const html = ssrRender({ count: 42 });

    expect(html).toBe('<span>Count: 42</span>');
  });
});
