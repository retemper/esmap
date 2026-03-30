/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDomIsolation } from './dom-isolation.js';
import type { DomIsolationHandle } from './dom-isolation.js';

describe('createDomIsolation', () => {
  /** Sets up the DOM structure for testing */
  function setupDom(): HTMLElement {
    document.body.innerHTML = `
      <div id="global-header">Header</div>
      <div id="app-container">
        <div class="inner-item" id="inner-id">Inside App</div>
        <span class="tag-item">Span Inside</span>
      </div>
      <div id="outside-element" class="inner-item">Outside</div>
    `;
    return document.querySelector<HTMLElement>('#app-container')!;
  }

  /** Disposes the handle if it exists */
  function safeDispose(handle: DomIsolationHandle | undefined): void {
    handle?.dispose();
  }

  describe('querySelector isolation', () => {
    it('returns only elements inside the container', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const result = document.querySelector('.inner-item');
      expect(result?.textContent).toBe('Inside App');

      safeDispose(handle);
    });

    it('does not find elements outside the container', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const result = document.querySelector('#outside-element');
      expect(result).toBeNull();

      safeDispose(handle);
    });

    it('searches the entire document for global selector patterns', () => {
      const container = setupDom();
      const handle = createDomIsolation({
        name: 'test-app',
        container,
        globalSelectors: ['#global-header'],
      });

      const result = document.querySelector('#global-header');
      expect(result?.textContent).toBe('Header');

      safeDispose(handle);
    });
  });

  describe('querySelectorAll isolation', () => {
    it('returns only elements inside the container', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const results = document.querySelectorAll('.inner-item');
      expect(results).toHaveLength(1);
      expect(results[0].textContent).toBe('Inside App');

      safeDispose(handle);
    });
  });

  describe('getElementById isolation', () => {
    it('returns the element with the given ID inside the container', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const result = document.getElementById('inner-id');
      expect(result?.textContent).toBe('Inside App');

      safeDispose(handle);
    });

    it('does not find ID elements outside the container', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const result = document.getElementById('outside-element');
      expect(result).toBeNull();

      safeDispose(handle);
    });

    it('searches the entire document for IDs specified as global selectors', () => {
      const container = setupDom();
      const handle = createDomIsolation({
        name: 'test-app',
        container,
        globalSelectors: ['#global-header'],
      });

      const result = document.getElementById('global-header');
      expect(result?.textContent).toBe('Header');

      safeDispose(handle);
    });
  });

  describe('getElementsByClassName isolation', () => {
    it('returns only elements with the class inside the container', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const results = document.getElementsByClassName('inner-item');
      expect(results).toHaveLength(1);

      safeDispose(handle);
    });
  });

  describe('getElementsByTagName isolation', () => {
    it('returns only elements with the tag inside the container', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const results = document.getElementsByTagName('span');
      expect(results).toHaveLength(1);
      expect(results[0].textContent).toBe('Span Inside');

      safeDispose(handle);
    });
  });

  describe('dispose', () => {
    it('restores original document methods after dispose', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      handle.dispose();

      // After dispose, searches the entire document
      const results = document.querySelectorAll('.inner-item');
      expect(results).toHaveLength(2);
    });

    it('provides access to the isolated container via the container property', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      expect(handle.container).toBe(container);

      safeDispose(handle);
    });
  });
});
