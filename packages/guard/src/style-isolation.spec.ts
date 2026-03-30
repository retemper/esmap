import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStyleIsolation } from './style-isolation.js';

describe('createStyleIsolation', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  describe('existing style scoping', () => {
    it('scopes style elements inside the container', () => {
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

    it('scopes link[rel="stylesheet"] elements inside the container', () => {
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

    it('skips already scoped elements', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.button { color: red; }';
      style.setAttribute('data-esmap-scoped', 'other-app');
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'checkout', container });

      expect(handle.getScopedCount()).toBe(0);

      handle.destroy();
    });

    it('scopes all style and link elements when there are multiple', () => {
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

    it('returns 0 when there are no style elements', () => {
      const container = document.getElementById('app')!;
      const handle = createStyleIsolation({ appName: 'empty', container });

      expect(handle.getScopedCount()).toBe(0);

      handle.destroy();
    });
  });

  describe('destroy', () => {
    it('restores the original CSS of style elements', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.button { color: red; }';
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'checkout', container });
      handle.destroy();

      expect(style.textContent).toBe('.button { color: red; }');
      expect(style.hasAttribute('data-esmap-scoped')).toBe(false);
    });

    it('restores the original state of link elements and removes the wrapper', () => {
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

    it('getScopedCount returns 0 after destroy', () => {
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
    it('removes existing scoping and reapplies it', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.button { color: red; }';
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'checkout', container });

      // Restore original then re-scope
      handle.refresh();

      expect(style.textContent).toContain('[data-esmap-scope="checkout"]');
      expect(handle.getScopedCount()).toBe(1);

      handle.destroy();
    });

    it('scopes newly added styles on refresh', () => {
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

  describe('dynamic style observation (observeDynamic)', () => {
    it('automatically scopes dynamically added style elements', async () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        observeDynamic: true,
      });

      const style = document.createElement('style');
      style.textContent = '.dynamic { color: blue; }';
      container.appendChild(style);

      // Wait because MutationObserver runs as a microtask
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toContain('[data-esmap-scope="checkout"]');
      expect(handle.getScopedCount()).toBe(1);

      handle.destroy();
    });

    it('automatically scopes dynamically added link elements', async () => {
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

    it('does not observe dynamic styles when observeDynamic is false', async () => {
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

    it('does not observe dynamic styles after destroy', async () => {
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

  describe('shadow strategy', () => {
    it('creates a Shadow DOM', () => {
      const container = document.getElementById('app')!;

      const handle = createStyleIsolation({
        appName: 'checkout',
        container,
        strategy: 'shadow',
      });

      expect(container.shadowRoot).not.toBeNull();

      handle.destroy();
    });

    it('reuses an existing shadowRoot', () => {
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

    it('removes the wrapper on destroy', () => {
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

  describe('defaults', () => {
    it('default strategy is attribute', () => {
      const container = document.getElementById('app')!;
      const style = document.createElement('style');
      style.textContent = '.btn { color: red; }';
      container.appendChild(style);

      const handle = createStyleIsolation({ appName: 'test', container });

      expect(style.textContent).toContain('[data-esmap-scope="test"]');
      expect(container.shadowRoot).toBeNull();

      handle.destroy();
    });

    it('default observeDynamic is false', async () => {
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
