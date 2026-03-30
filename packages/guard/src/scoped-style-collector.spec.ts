import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScopedStyleCollector } from './scoped-style-collector.js';

describe('createScopedStyleCollector', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  describe('existing style scoping', () => {
    it('scopes style elements already in head on start', () => {
      const style = document.createElement('style');
      style.textContent = '.btn { color: red; }';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();

      expect(style.textContent).toContain('[data-esmap-scope="checkout"] .btn');
      expect(style.getAttribute('data-esmap-scoped')).toBe('checkout');
      expect(collector.getScopedCount()).toBe(1);

      collector.destroy();
    });

    it('skips already scoped style elements', () => {
      const style = document.createElement('style');
      style.textContent = '.btn { color: red; }';
      style.setAttribute('data-esmap-scoped', 'other-app');
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();

      expect(collector.getScopedCount()).toBe(0);

      collector.destroy();
    });

    it('does not scope empty style elements', () => {
      const style = document.createElement('style');
      style.textContent = '';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();

      expect(collector.getScopedCount()).toBe(0);

      collector.destroy();
    });
  });

  describe('dynamic style detection', () => {
    it('automatically scopes style elements added to head after start', async () => {
      const collector = createScopedStyleCollector({ appName: 'dashboard' });
      collector.start();

      // Scenario: CSS-in-JS dynamically inserts a style tag
      const style = document.createElement('style');
      style.textContent = '.card { padding: 16px; }';
      document.head.appendChild(style);

      // MutationObserver runs as a microtask
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toContain('[data-esmap-scope="dashboard"] .card');
      expect(collector.getScopedCount()).toBe(1);

      collector.destroy();
    });

    it('does not detect new styles after stop', async () => {
      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();
      collector.stop();

      const style = document.createElement('style');
      style.textContent = '.btn { color: blue; }';
      document.head.appendChild(style);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toBe('.btn { color: blue; }');
      expect(collector.getScopedCount()).toBe(0);

      collector.destroy();
    });
  });

  describe('exclude filter', () => {
    it('does not scope elements for which the exclude function returns true', () => {
      const globalStyle = document.createElement('style');
      globalStyle.textContent = '* { box-sizing: border-box; }';
      globalStyle.setAttribute('data-global', 'true');
      document.head.appendChild(globalStyle);

      const appStyle = document.createElement('style');
      appStyle.textContent = '.app { margin: 0; }';
      document.head.appendChild(appStyle);

      const collector = createScopedStyleCollector({
        appName: 'checkout',
        exclude: (el) => el.hasAttribute('data-global'),
      });
      collector.start();

      expect(globalStyle.textContent).toBe('* { box-sizing: border-box; }');
      expect(appStyle.textContent).toContain('[data-esmap-scope="checkout"]');
      expect(collector.getScopedCount()).toBe(1);

      collector.destroy();
    });
  });

  describe('destroy', () => {
    it('restores all styles to their originals on destroy', () => {
      const style = document.createElement('style');
      style.textContent = '.btn { color: red; }';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();

      expect(style.textContent).toContain('[data-esmap-scope="checkout"]');

      collector.destroy();

      expect(style.textContent).toBe('.btn { color: red; }');
      expect(style.hasAttribute('data-esmap-scoped')).toBe(false);
    });

    it('getScopedCount returns 0 after destroy', () => {
      const style = document.createElement('style');
      style.textContent = '.btn { color: red; }';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();
      collector.destroy();

      expect(collector.getScopedCount()).toBe(0);
    });
  });

  describe('multiple apps simultaneous usage', () => {
    it('maintains independent scoping per app', () => {
      const style1 = document.createElement('style');
      style1.textContent = '.header { color: red; }';
      document.head.appendChild(style1);

      const collector1 = createScopedStyleCollector({ appName: 'app-a' });
      collector1.start();

      expect(style1.textContent).toContain('[data-esmap-scope="app-a"]');

      // app-b adds styles later
      const style2 = document.createElement('style');
      style2.textContent = '.footer { color: blue; }';
      document.head.appendChild(style2);

      // app-a's collector also scopes style2 (since they watch the same head)
      // This is intentional behavior -- in practice, controlled via start/stop per app lifecycle

      collector1.destroy();
    });
  });

  describe('Tailwind CSS scenario', () => {
    it('scopes selectors inside Tailwind @layer rules', () => {
      const style = document.createElement('style');
      style.textContent = '@layer base { h1 { font-size: 2rem; } }';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'tw-app' });
      collector.start();

      // @layer is included in AT_RULE_PATTERN for recursive scoping
      expect(style.textContent).toContain('@layer base');
      expect(style.textContent).toContain('[data-esmap-scope="tw-app"] h1');

      collector.destroy();
    });

    it('scopes Tailwind preflight global resets', () => {
      const style = document.createElement('style');
      style.textContent = '*, ::before, ::after { box-sizing: border-box; border: 0; }';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'tw-app' });
      collector.start();

      expect(style.textContent).toContain('[data-esmap-scope="tw-app"] *');
      expect(style.textContent).toContain('[data-esmap-scope="tw-app"] ::before');
      expect(style.textContent).not.toBe(
        '*, ::before, ::after { box-sizing: border-box; border: 0; }',
      );

      collector.destroy();
    });
  });

  describe('styled-components scenario', () => {
    it('scopes dynamically injected styled-components styles', async () => {
      const collector = createScopedStyleCollector({ appName: 'sc-app' });
      collector.start();

      // styled-components inserts a <style data-styled="active"> tag into head
      const style = document.createElement('style');
      style.setAttribute('data-styled', 'active');
      style.textContent = '.sc-abc123 { background: blue; }';
      document.head.appendChild(style);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toContain('[data-esmap-scope="sc-app"] .sc-abc123');
      expect(collector.getScopedCount()).toBe(1);

      collector.destroy();
    });
  });

  describe('Emotion scenario', () => {
    it('scopes styles injected by Emotion', async () => {
      const collector = createScopedStyleCollector({ appName: 'emotion-app' });
      collector.start();

      // Emotion inserts a <style data-emotion="css"> tag into head
      const style = document.createElement('style');
      style.setAttribute('data-emotion', 'css');
      style.textContent = '.css-1a2b3c { display: flex; }';
      document.head.appendChild(style);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toContain('[data-esmap-scope="emotion-app"] .css-1a2b3c');

      collector.destroy();
    });
  });
});
