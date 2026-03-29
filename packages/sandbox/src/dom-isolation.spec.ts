/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDomIsolation } from './dom-isolation.js';
import type { DomIsolationHandle } from './dom-isolation.js';

describe('createDomIsolation', () => {
  /** 테스트용 DOM 구조를 설정한다 */
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

  /** 핸들이 있으면 dispose한다 */
  function safeDispose(handle: DomIsolationHandle | undefined): void {
    handle?.dispose();
  }

  describe('querySelector 격리', () => {
    it('컨테이너 내의 요소만 반환한다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const result = document.querySelector('.inner-item');
      expect(result?.textContent).toBe('Inside App');

      safeDispose(handle);
    });

    it('컨테이너 외부의 요소는 찾지 못한다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const result = document.querySelector('#outside-element');
      expect(result).toBeNull();

      safeDispose(handle);
    });

    it('글로벌 셀렉터 패턴은 document 전체에서 검색한다', () => {
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

  describe('querySelectorAll 격리', () => {
    it('컨테이너 내의 요소만 반환한다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const results = document.querySelectorAll('.inner-item');
      expect(results).toHaveLength(1);
      expect(results[0].textContent).toBe('Inside App');

      safeDispose(handle);
    });
  });

  describe('getElementById 격리', () => {
    it('컨테이너 내의 ID 요소를 반환한다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const result = document.getElementById('inner-id');
      expect(result?.textContent).toBe('Inside App');

      safeDispose(handle);
    });

    it('컨테이너 외부의 ID 요소는 찾지 못한다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const result = document.getElementById('outside-element');
      expect(result).toBeNull();

      safeDispose(handle);
    });

    it('글로벌 셀렉터로 지정된 ID는 document 전체에서 검색한다', () => {
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

  describe('getElementsByClassName 격리', () => {
    it('컨테이너 내의 클래스 요소만 반환한다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const results = document.getElementsByClassName('inner-item');
      expect(results).toHaveLength(1);

      safeDispose(handle);
    });
  });

  describe('getElementsByTagName 격리', () => {
    it('컨테이너 내의 태그 요소만 반환한다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      const results = document.getElementsByTagName('span');
      expect(results).toHaveLength(1);
      expect(results[0].textContent).toBe('Span Inside');

      safeDispose(handle);
    });
  });

  describe('dispose', () => {
    it('dispose 후 원본 document 메서드가 복원된다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      handle.dispose();

      // dispose 후에는 document 전체에서 검색
      const results = document.querySelectorAll('.inner-item');
      expect(results).toHaveLength(2);
    });

    it('container 속성을 통해 격리 대상 컨테이너에 접근할 수 있다', () => {
      const container = setupDom();
      const handle = createDomIsolation({ name: 'test-app', container });

      expect(handle.container).toBe(container);

      safeDispose(handle);
    });
  });
});
