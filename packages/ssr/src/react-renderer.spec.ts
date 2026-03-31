import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderReactToString, createReactSsrRender } from './react-renderer.js';

describe('renderReactToString', () => {
  it('React 컴포넌트를 HTML 문자열로 렌더링한다', () => {
    const App = () => createElement('div', null, 'Hello SSR');

    const html = renderReactToString({ rootComponent: App });

    expect(html).toBe('<div>Hello SSR</div>');
  });

  it('props를 컴포넌트에 전달한다', () => {
    const App = ({ name }: { name: string }) => createElement('span', null, `Hi ${name}`);

    const html = renderReactToString({
      rootComponent: App,
      props: { name: 'World' },
    });

    expect(html).toBe('<span>Hi World</span>');
  });

  it('wrapWith으로 컴포넌트를 감싼다', () => {
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
  it('ssrRender 함수를 생성한다', () => {
    const App = () => createElement('div', null, 'SSR App');

    const ssrRender = createReactSsrRender({ rootComponent: App });
    const html = ssrRender();

    expect(html).toBe('<div>SSR App</div>');
  });

  it('호출 시 전달받은 props를 컴포넌트에 전달한다', () => {
    const App = ({ count }: { count: number }) => createElement('span', null, `Count: ${count}`);

    const ssrRender = createReactSsrRender({ rootComponent: App });
    const html = ssrRender({ count: 42 });

    expect(html).toBe('<span>Count: 42</span>');
  });
});
