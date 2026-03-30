import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultFallback, renderFallback } from './error-boundary.js';

describe('error-boundary', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createDefaultFallback', () => {
    it('creates a default fallback DOM element', () => {
      const onRetry = vi.fn();
      const element = createDefaultFallback('test-app', new Error('fail'), onRetry);

      expect(element.className).toBe('esmap-error-boundary');
      expect(element.querySelector('p')?.textContent).toBe('Unable to load the app');
      expect(element.querySelector('button')?.textContent).toBe('Retry');
    });

    it('calls onRetry callback when the retry button is clicked', () => {
      const onRetry = vi.fn();
      const element = createDefaultFallback('test-app', new Error('fail'), onRetry);

      const button = element.querySelector('button');
      button?.click();

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderFallback', () => {
    it('renders HTMLElement content into the container', () => {
      const container = document.createElement('div');
      container.textContent = 'existing content';
      document.body.appendChild(container);

      const fallback = document.createElement('p');
      fallback.textContent = 'fallback';

      renderFallback(container, fallback);

      expect(container.textContent).toBe('fallback');
      expect(container.children).toHaveLength(1);
    });

    it('safely renders string content via textContent', () => {
      const container = document.createElement('div');
      container.textContent = 'existing content';
      document.body.appendChild(container);

      renderFallback(container, 'An error occurred');

      expect(container.textContent).toBe('An error occurred');
    });

    it('escapes HTML even when string contains HTML', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      renderFallback(container, '<script>alert("xss")</script>');

      expect(container.textContent).toBe('<script>alert("xss")</script>');
      expect(container.querySelector('script')).toBeNull();
    });

    it('removes existing content before rendering', () => {
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
