import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStyleCollector } from './style-collector.js';
import type { StyleCollector } from './style-collector.js';

describe('createStyleCollector', () => {
  /** 테스트 중 head에 추가된 요소를 추적하여 정리한다 */
  const addedToHead: HTMLElement[] = [];
  /** 공유 수집기 인스턴스 */
  const NULL_COLLECTOR: StyleCollector = {
    startCapture: () => {},
    stopCapture: () => [],
    removeStyles: () => {},
    getStyles: () => [],
    destroy: () => {},
  };
  const collectorRef = { current: NULL_COLLECTOR };

  /** head에 style 요소를 추가하고 추적 목록에 등록한다 */
  function appendStyleToHead(cssText: string): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.appendChild(style);
    addedToHead.push(style);
    return style;
  }

  /** head에 link[rel="stylesheet"] 요소를 추가하고 추적 목록에 등록한다 */
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
    it('캡처 중 추가된 style 요소를 수집한다', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.a { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');

      expect(captured).toHaveLength(1);
      expect(captured[0].textContent).toBe('.a { color: red; }');
    });

    it('캡처 중 추가된 link[rel="stylesheet"] 요소를 수집한다', async () => {
      collectorRef.current.startCapture('app-a');

      appendLinkToHead('https://example.com/style.css');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');

      expect(captured).toHaveLength(1);
    });

    it('수집된 요소에 data-esmap-app 속성을 추가한다', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.tagged { color: blue; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');

      expect(captured[0].getAttribute('data-esmap-app')).toBe('app-a');
    });

    it('캡처 중이 아닌 앱에는 요소를 수집하지 않는다', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.x { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const capturedB = collectorRef.current.stopCapture('app-b');
      const capturedA = collectorRef.current.stopCapture('app-a');

      expect(capturedB).toHaveLength(0);
      expect(capturedA).toHaveLength(1);
    });

    it('stopCapture 후 추가된 요소는 수집하지 않는다', async () => {
      collectorRef.current.startCapture('app-a');
      collectorRef.current.stopCapture('app-a');

      appendStyleToHead('.after { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const styles = collectorRef.current.getStyles('app-a');
      expect(styles).toHaveLength(0);
    });

    it('존재하지 않는 앱을 stopCapture하면 빈 배열을 반환한다', () => {
      const result = collectorRef.current.stopCapture('nonexistent');
      expect(result).toStrictEqual([]);
    });

    it('여러 앱을 동시에 캡처할 수 있다', async () => {
      collectorRef.current.startCapture('app-a');
      collectorRef.current.startCapture('app-b');

      appendStyleToHead('.shared { color: green; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const capturedA = collectorRef.current.stopCapture('app-a');
      const capturedB = collectorRef.current.stopCapture('app-b');

      // 두 앱 모두 활성 상태였으므로 둘 다 수집
      expect(capturedA).toHaveLength(1);
      expect(capturedB).toHaveLength(1);
    });
  });

  describe('getStyles', () => {
    it('수집된 스타일 요소를 반환한다', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.get-test { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const styles = collectorRef.current.getStyles('app-a');
      expect(styles).toHaveLength(1);
    });

    it('존재하지 않는 앱에 대해 빈 배열을 반환한다', () => {
      const styles = collectorRef.current.getStyles('nonexistent');
      expect(styles).toStrictEqual([]);
    });

    it('stopCapture 후에도 getStyles로 조회 가능하다', async () => {
      collectorRef.current.startCapture('app-a');

      appendStyleToHead('.persisted { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      collectorRef.current.stopCapture('app-a');

      const styles = collectorRef.current.getStyles('app-a');
      expect(styles).toHaveLength(1);
    });
  });

  describe('removeStyles', () => {
    it('앱에 속한 스타일 요소를 DOM에서 제거한다', async () => {
      collectorRef.current.startCapture('app-a');

      const style = appendStyleToHead('.remove-me { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      collectorRef.current.stopCapture('app-a');
      collectorRef.current.removeStyles('app-a');

      expect(style.parentNode).toBeNull();
      expect(collectorRef.current.getStyles('app-a')).toHaveLength(0);
    });

    it('존재하지 않는 앱에 대해 에러 없이 실행된다', () => {
      expect(() => collectorRef.current.removeStyles('nonexistent')).not.toThrow();
    });

    it('여러 요소를 한 번에 제거한다', async () => {
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
    it('destroy 후 새로운 스타일을 수집하지 않는다', async () => {
      collectorRef.current.startCapture('app-a');
      collectorRef.current.destroy();

      appendStyleToHead('.after-destroy { color: red; }');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const styles = collectorRef.current.getStyles('app-a');
      expect(styles).toStrictEqual([]);
    });
  });

  describe('스타일과 무관한 요소', () => {
    it('script 요소는 수집하지 않는다', async () => {
      collectorRef.current.startCapture('app-a');

      const script = document.createElement('script');
      script.textContent = 'console.log("hi")';
      document.head.appendChild(script);
      addedToHead.push(script);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const captured = collectorRef.current.stopCapture('app-a');
      expect(captured).toHaveLength(0);
    });

    it('rel이 stylesheet가 아닌 link 요소는 수집하지 않는다', async () => {
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
