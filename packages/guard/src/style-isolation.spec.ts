import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStyleIsolation } from './style-isolation.js';

describe('createStyleIsolation', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  describe('기존 스타일 스코핑', () => {
    it('컨테이너 내부의 style 요소를 스코핑한다', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.button { color: red; }';
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'checkout', container });

      expect(style.textContent).toContain('[data-esmap-scope="checkout"]');
      expect(style.getAttribute('data-esmap-scoped')).toBe('checkout');
      expect(handle.getScopedCount()).toBe(1);

      handle.destroy();
    });

    it('컨테이너 내부의 link[rel="stylesheet"] 요소를 스코핑한다', () => {
      const container = document.getElementById('app')!;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://example.com/styles.css';
      container.appendChild(link);

      const handle = createStyleIsolation({ appName: 'checkout', container });

      expect(link.disabled).toBe(true);
      expect(link.getAttribute('data-esmap-original-link')).toBe('checkout');
      expect(handle.getScopedCount()).toBe(1);

      const wrapper = container.querySelector('style[data-esmap-link-wrapper]');
      expect(wrapper).not.toBeNull();
      expect(wrapper?.textContent).toContain('@import');

      handle.destroy();
    });

    it('이미 스코핑된 요소는 건너뛴다', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.button { color: red; }';
      style.setAttribute('data-esmap-scoped', 'other-app');
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'checkout', container });

      expect(handle.getScopedCount()).toBe(0);

      handle.destroy();
    });

    it('style과 link 요소가 여러 개일 때 모두 스코핑한다', () => {
      const container = document.getElementById('app')!;

      const style1 = document.createElement('style');
      style1.textContent = '.a { color: red; }';
      container.appendChild(style1);

      const style2 = document.createElement('style');
      style2.textContent = '.b { color: blue; }';
      container.appendChild(style2);

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://example.com/theme.css';
      container.appendChild(link);

      const handle = createStyleIsolation({ appName: 'shop', container });

      expect(handle.getScopedCount()).toBe(3);

      handle.destroy();
    });

    it('스타일 요소가 없으면 0을 반환한다', () => {
      const container = document.getElementById('app')!;
      const handle = createStyleIsolation({ appName: 'empty', container });

      expect(handle.getScopedCount()).toBe(0);

      handle.destroy();
    });
  });

  describe('destroy', () => {
    it('style 요소의 원본 CSS를 복원한다', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.button { color: red; }';
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'checkout', container });
      handle.destroy();

      expect(style.textContent).toBe('.button { color: red; }');
      expect(style.hasAttribute('data-esmap-scoped')).toBe(false);
    });

    it('link 요소의 원본 상태를 복원하고 wrapper를 제거한다', () => {
      const container = document.getElementById('app')!;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://example.com/styles.css';
      container.appendChild(link);

      const handle = createStyleIsolation({ appName: 'checkout', container });
      handle.destroy();

      expect(link.disabled).toBe(false);
      expect(link.hasAttribute('data-esmap-original-link')).toBe(false);
      expect(container.querySelector('style[data-esmap-link-wrapper]')).toBeNull();
    });

    it('destroy 후 getScopedCount가 0을 반환한다', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.x { color: red; }';
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'checkout', container });
      expect(handle.getScopedCount()).toBe(1);

      handle.destroy();
      expect(handle.getScopedCount()).toBe(0);
    });
  });

  describe('refresh', () => {
    it('기존 스코핑을 제거하고 다시 적용한다', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.button { color: red; }';
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'checkout', container });

      // 원본 복원 후 다시 스코핑
      handle.refresh();

      expect(style.textContent).toContain('[data-esmap-scope="checkout"]');
      expect(handle.getScopedCount()).toBe(1);

      handle.destroy();
    });

    it('새로 추가된 스타일도 refresh 시 스코핑한다', () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({ appName: 'checkout', container });
      expect(handle.getScopedCount()).toBe(0);

      const style = document.createElement('style');
      style.textContent = '.new-button { color: green; }';
      container.appendChild(style);

      handle.refresh();

      expect(handle.getScopedCount()).toBe(1);
      expect(style.textContent).toContain('[data-esmap-scope="checkout"]');

      handle.destroy();
    });
  });

  describe('동적 스타일 감시 (observeDynamic)', () => {
    it('동적으로 추가된 style 요소를 자동 스코핑한다', async () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        observeDynamic: true,
      });

      const style = document.createElement('style');
      style.textContent = '.dynamic { color: blue; }';
      container.appendChild(style);

      // MutationObserver는 microtask로 동작하므로 대기
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toContain('[data-esmap-scope="checkout"]');
      expect(handle.getScopedCount()).toBe(1);

      handle.destroy();
    });

    it('동적으로 추가된 link 요소를 자동 스코핑한다', async () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        observeDynamic: true,
      });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://example.com/dynamic.css';
      container.appendChild(link);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(link.disabled).toBe(true);
      expect(handle.getScopedCount()).toBe(1);

      handle.destroy();
    });

    it('observeDynamic이 false면 동적 스타일을 감시하지 않는다', async () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        observeDynamic: false,
      });

      const style = document.createElement('style');
      style.textContent = '.dynamic { color: blue; }';
      container.appendChild(style);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toBe('.dynamic { color: blue; }');
      expect(handle.getScopedCount()).toBe(0);

      handle.destroy();
    });

    it('destroy 후에는 동적 스타일을 감시하지 않는다', async () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        observeDynamic: true,
      });

      handle.destroy();

      const style = document.createElement('style');
      style.textContent = '.late { color: red; }';
      container.appendChild(style);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toBe('.late { color: red; }');
      expect(style.hasAttribute('data-esmap-scoped')).toBe(false);
    });
  });

  describe('shadow 전략', () => {
    it('Shadow DOM을 생성한다', () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        strategy: 'shadow',
      });

      expect(container.shadowRoot).not.toBeNull();

      handle.destroy();
    });

    it('기존 shadowRoot가 있으면 재사용한다', () => {
      const container = document.getElementById('app')!;
      container.attachShadow({ mode: 'open' });

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        strategy: 'shadow',
      });

      expect(container.shadowRoot).not.toBeNull();

      handle.destroy();
    });

    it('destroy 시 wrapper를 제거한다', () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        strategy: 'shadow',
      });

      expect(container.shadowRoot!.children).toHaveLength(1);

      handle.destroy();

      expect(container.shadowRoot!.children).toHaveLength(0);
    });
  });

  describe('기본값', () => {
    it('strategy 기본값은 attribute이다', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.btn { color: red; }';
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'test', container });

      expect(style.textContent).toContain('[data-esmap-scope="test"]');
      expect(container.shadowRoot).toBeNull();

      handle.destroy();
    });

    it('observeDynamic 기본값은 false이다', async () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({ appName: 'test', container });

      const style = document.createElement('style');
      style.textContent = '.dyn { color: red; }';
      container.appendChild(style);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toBe('.dyn { color: red; }');

      handle.destroy();
    });
  });
});
