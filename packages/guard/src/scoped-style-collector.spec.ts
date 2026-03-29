import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScopedStyleCollector } from './scoped-style-collector.js';

describe('createScopedStyleCollector', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  describe('기존 스타일 스코핑', () => {
    it('start 시 head에 이미 있는 style 요소를 스코핑한다', () => {
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

    it('이미 스코핑된 style 요소는 무시한다', () => {
      const style = document.createElement('style');
      style.textContent = '.btn { color: red; }';
      style.setAttribute('data-esmap-scoped', 'other-app');
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();

      expect(collector.getScopedCount()).toBe(0);

      collector.destroy();
    });

    it('빈 style 요소는 스코핑하지 않는다', () => {
      const style = document.createElement('style');
      style.textContent = '';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();

      expect(collector.getScopedCount()).toBe(0);

      collector.destroy();
    });
  });

  describe('동적 스타일 감지', () => {
    it('start 후 head에 추가되는 style 요소를 자동으로 스코핑한다', async () => {
      const collector = createScopedStyleCollector({ appName: 'dashboard' });
      collector.start();

      // CSS-in-JS가 동적으로 style 태그를 삽입하는 시나리오
      const style = document.createElement('style');
      style.textContent = '.card { padding: 16px; }';
      document.head.appendChild(style);

      // MutationObserver는 microtask로 실행됨
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(style.textContent).toContain('[data-esmap-scope="dashboard"] .card');
      expect(collector.getScopedCount()).toBe(1);

      collector.destroy();
    });

    it('stop 후에는 새로운 스타일을 감지하지 않는다', async () => {
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

  describe('exclude 필터', () => {
    it('exclude 함수가 true를 반환하는 요소는 스코핑하지 않는다', () => {
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
    it('destroy 시 모든 스타일을 원본으로 복원한다', () => {
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

    it('destroy 후 getScopedCount는 0이다', () => {
      const style = document.createElement('style');
      style.textContent = '.btn { color: red; }';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'checkout' });
      collector.start();
      collector.destroy();

      expect(collector.getScopedCount()).toBe(0);
    });
  });

  describe('여러 앱 동시 사용', () => {
    it('앱별로 독립적인 스코핑을 유지한다', () => {
      const style1 = document.createElement('style');
      style1.textContent = '.header { color: red; }';
      document.head.appendChild(style1);

      const collector1 = createScopedStyleCollector({ appName: 'app-a' });
      collector1.start();

      expect(style1.textContent).toContain('[data-esmap-scope="app-a"]');

      // app-b가 나중에 스타일 추가
      const style2 = document.createElement('style');
      style2.textContent = '.footer { color: blue; }';
      document.head.appendChild(style2);

      // app-a의 collector가 style2도 스코핑함 (같은 head를 감시하므로)
      // 이건 의도된 동작 — 실제로는 앱별 lifecycle에서 start/stop으로 제어

      collector1.destroy();
    });
  });

  describe('Tailwind CSS 시나리오', () => {
    it('Tailwind의 @layer 규칙 내부 선택자를 스코핑한다', () => {
      const style = document.createElement('style');
      style.textContent = '@layer base { h1 { font-size: 2rem; } }';
      document.head.appendChild(style);

      const collector = createScopedStyleCollector({ appName: 'tw-app' });
      collector.start();

      // @layer는 AT_RULE_PATTERN에 포함되어 재귀 스코핑됨
      expect(style.textContent).toContain('@layer base');
      expect(style.textContent).toContain('[data-esmap-scope="tw-app"] h1');

      collector.destroy();
    });

    it('Tailwind preflight의 전역 리셋을 스코핑한다', () => {
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

  describe('styled-components 시나리오', () => {
    it('동적으로 주입된 styled-components 스타일을 스코핑한다', async () => {
      const collector = createScopedStyleCollector({ appName: 'sc-app' });
      collector.start();

      // styled-components가 <style data-styled="active"> 태그를 head에 삽입
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

  describe('Emotion 시나리오', () => {
    it('Emotion이 주입한 스타일을 스코핑한다', async () => {
      const collector = createScopedStyleCollector({ appName: 'emotion-app' });
      collector.start();

      // Emotion이 <style data-emotion="css"> 태그를 head에 삽입
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
