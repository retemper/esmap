import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultFallback, renderFallback } from './error-boundary.js';

describe('error-boundary', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createDefaultFallback', () => {
    it('기본 폴백 DOM 요소를 생성한다', () => {
      const onRetry = vi.fn();
      const element = createDefaultFallback('test-app', new Error('fail'), onRetry);

      expect(element.className).toBe('esmap-error-boundary');
      expect(element.querySelector('p')?.textContent).toBe('앱을 불러올 수 없습니다');
      expect(element.querySelector('button')?.textContent).toBe('다시 시도');
    });

    it('다시 시도 버튼 클릭 시 onRetry 콜백을 호출한다', () => {
      const onRetry = vi.fn();
      const element = createDefaultFallback('test-app', new Error('fail'), onRetry);

      const button = element.querySelector('button');
      button?.click();

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderFallback', () => {
    it('HTMLElement 콘텐츠를 컨테이너에 렌더링한다', () => {
      const container = document.createElement('div');
      container.textContent = '기존 콘텐츠';
      document.body.appendChild(container);

      const fallback = document.createElement('p');
      fallback.textContent = '폴백';

      renderFallback(container, fallback);

      expect(container.textContent).toBe('폴백');
      expect(container.children).toHaveLength(1);
    });

    it('문자열 콘텐츠를 textContent로 안전하게 렌더링한다', () => {
      const container = document.createElement('div');
      container.textContent = '기존 콘텐츠';
      document.body.appendChild(container);

      renderFallback(container, '에러가 발생했습니다');

      expect(container.textContent).toBe('에러가 발생했습니다');
    });

    it('문자열에 HTML이 포함되어도 이스케이프한다', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      renderFallback(container, '<script>alert("xss")</script>');

      expect(container.textContent).toBe('<script>alert("xss")</script>');
      expect(container.querySelector('script')).toBeNull();
    });

    it('렌더링 전에 기존 콘텐츠를 제거한다', () => {
      const container = document.createElement('div');
      container.innerHTML = '<span>old1</span><span>old2</span>';
      document.body.appendChild(container);

      const fallback = document.createElement('div');
      fallback.textContent = 'new';

      renderFallback(container, fallback);

      expect(container.children).toHaveLength(1);
      expect(container.textContent).toBe('new');
    });
  });
});
