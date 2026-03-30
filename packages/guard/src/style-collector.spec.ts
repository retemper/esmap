import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStyleCollector } from './style-collector.js';
import type { StyleCollector } from './style-collector.js';

describe('createStyleCollector', () => {
  /** Tracks elements added to head during testing for cleanup */
  const addedToHead: HTMLElement[] = [];
  /** Shared collector instance */
  const NULL_COLLECTOR: StyleCollector = {
    startCapture: () => {},
    stopCapture: () => [],
    removeStyles: () => {},
    getStyles: () => [],
    destroy: () => {},
  };
  const collectorRef = { current: NULL_COLLECTOR };

  /** Adds a style element to head and registers it in the tracking list */
  function appendStyleToHead(cssText: string): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.appendChild(style);
    addedToHead.push(style);
    return style;
  }

  /** Adds a link[rel="stylesheet"] element to head and registers it in the tracking list */
  function appendLinkToHead(href: string): HTMLLinkElement {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    addedToHead.push(link);
    return link;
  }

  beforeEach(() => {
    collectorRef.current = createStyleCollector();
  });

  afterEach(() => {
    collectorRef.current.destroy();
    for (const el of addedToHead) {
      el.remove();
    }
    addedToHead.length = 0;
  });

  describe('startCapture / stopCapture', () => {
    it('collects style elements added during capture', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.a { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');

      expect(captured).toHaveLength(1);
      expect(captured[0].textContent).toBe('.a { color: red; }');
    });

    it('collects link[rel="stylesheet"] elements added during capture', async () => {
      collectorRef.current.startCapture('app-a');

      appendLinkToHead('https://example.com/style.css');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');

      expect(captured).toHaveLength(1);
    });

    it('adds data-esmap-app attribute to collected elements', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.tagged { color: blue; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');

      expect(captured[0].getAttribute('data-esmap-app')).toBe('app-a');
    });

    it('does not collect elements for apps not currently capturing', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.x { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const capturedB = collectorRef.current.stopCapture('app-b');
      const capturedA = collectorRef.current.stopCapture('app-a');

      expect(capturedB).toHaveLength(0);
      expect(capturedA).toHaveLength(1);
    });

    it('does not collect elements added after stopCapture', async () => {
      collectorRef.current.startCapture('app-a');
      collectorRef.current.stopCapture('app-a');

      appendStyleToHead('.after { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const styles = collectorRef.current.getStyles('app-a');
      expect(styles).toHaveLength(0);
    });

    it('returns an empty array when stopping capture for a nonexistent app', () => {
      const result = collectorRef.current.stopCapture('nonexistent');
      expect(result).toStrictEqual([]);
    });

    it('can capture multiple apps simultaneously', async () => {
      collectorRef.current.startCapture('app-a');
      collectorRef.current.startCapture('app-b');

      appendStyleToHead('.shared { color: green; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const capturedA = collectorRef.current.stopCapture('app-a');
      const capturedB = collectorRef.current.stopCapture('app-b');

      // Both apps were active, so both collected
      expect(capturedA).toHaveLength(1);
      expect(capturedB).toHaveLength(1);
    });
  });

  describe('getStyles', () => {
    it('returns collected style elements', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.get-test { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const styles = collectorRef.current.getStyles('app-a');
      expect(styles).toHaveLength(1);
    });

    it('returns an empty array for a nonexistent app', () => {
      const styles = collectorRef.current.getStyles('nonexistent');
      expect(styles).toStrictEqual([]);
    });

    it('allows querying via getStyles even after stopCapture', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.persisted { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      collectorRef.current.stopCapture('app-a');

      const styles = collectorRef.current.getStyles('app-a');
      expect(styles).toHaveLength(1);
    });
  });

  describe('removeStyles', () => {
    it('removes style elements belonging to the app from the DOM', async () => {
      collectorRef.current.startCapture('app-a');

      const style = appendStyleToHead('.remove-me { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      collectorRef.current.stopCapture('app-a');
      collectorRef.current.removeStyles('app-a');

      expect(style.parentNode).toBeNull();
      expect(collectorRef.current.getStyles('app-a')).toHaveLength(0);
    });

    it('runs without error for a nonexistent app', () => {
      expect(() => collectorRef.current.removeStyles('nonexistent')).not.toThrow();
    });

    it('removes multiple elements at once', async () => {
      collectorRef.current.startCapture('app-a');

      const style1 = appendStyleToHead('.r1 { color: red; }');
      const style2 = appendStyleToHead('.r2 { color: blue; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      collectorRef.current.stopCapture('app-a');
      collectorRef.current.removeStyles('app-a');

      expect(style1.parentNode).toBeNull();
      expect(style2.parentNode).toBeNull();
      expect(collectorRef.current.getStyles('app-a')).toHaveLength(0);
    });
  });

  describe('destroy', () => {
    it('does not collect new styles after destroy', async () => {
      collectorRef.current.startCapture('app-a');
      collectorRef.current.destroy();

      appendStyleToHead('.after-destroy { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const styles = collectorRef.current.getStyles('app-a');
      expect(styles).toStrictEqual([]);
    });
  });

  describe('non-style elements', () => {
    it('does not collect script elements', async () => {
      collectorRef.current.startCapture('app-a');

      const script = document.createElement('script');
      script.textContent = 'console.log("hi")';
      document.head.appendChild(script);
      addedToHead.push(script);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');
      expect(captured).toHaveLength(0);
    });

    it('does not collect link elements whose rel is not stylesheet', async () => {
      collectorRef.current.startCapture('app-a');

      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = '/favicon.ico';
      document.head.appendChild(link);
      addedToHead.push(link);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');
      expect(captured).toHaveLength(0);
    });
  });
});
