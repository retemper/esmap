/**
 * CSS-in-JS 라이브러리(styled-components, Emotion 등)가 document.head에
 * 동적으로 주입하는 <style> 요소를 감지하고 자동으로 스코핑한다.
 *
 * 기존 style-collector는 수집만 하고 스코핑은 하지 않았고,
 * style-isolation은 컨테이너 내부만 감시했다.
 * 이 모듈은 둘을 연결하여 head에 주입되는 스타일도 스코핑한다.
 */

import { scopeCssText, isPrescopedCss } from './css-scope.js';

/** 스코핑된 스타일 수집기 옵션 */
export interface ScopedStyleCollectorOptions {
  /** 스코프에 사용할 앱 이름 */
  readonly appName: string;
  /**
   * 스코핑에서 제외할 스타일 요소를 판별하는 함수.
   * true를 반환하면 해당 요소는 스코핑하지 않는다.
   */
  readonly exclude?: (element: HTMLStyleElement | HTMLLinkElement) => boolean;
}

/** 스코핑된 스타일 수집기 핸들 */
export interface ScopedStyleCollectorHandle {
  /** 수집 및 스코핑을 시작한다 */
  start(): void;
  /** 수집을 중단한다. 이미 스코핑된 스타일은 유지된다. */
  stop(): void;
  /** 모든 스코핑된 스타일을 원본으로 복원하고 수집기를 해제한다 */
  destroy(): void;
  /** 현재 스코핑된 스타일 요소 수를 반환한다 */
  getScopedCount(): number;
}

/** 스코핑된 스타일 요소의 원본 데이터 */
interface TrackedStyle {
  /** 스코핑된 요소 */
  readonly element: HTMLStyleElement;
  /** 원본 CSS 텍스트 */
  readonly originalCss: string;
}

/**
 * head에 주입되는 스타일 요소를 감지하고 자동으로 CSS 스코핑을 적용하는 수집기를 생성한다.
 * CSS-in-JS 라이브러리(styled-components, Emotion 등)와의 호환성을 제공한다.
 *
 * @param options - 수집기 옵션
 * @returns 수집기 핸들
 */
export function createScopedStyleCollector(
  options: ScopedStyleCollectorOptions,
): ScopedStyleCollectorHandle {
  const { appName, exclude } = options;
  const tracked: TrackedStyle[] = [];
  const ref: { observer: MutationObserver | null; active: boolean } = {
    observer: null,
    active: false,
  };

  /**
   * style 요소가 수집 대상인지 판별한다.
   * @param node - 검사할 DOM 노드
   */
  function isTargetStyleElement(node: Node): node is HTMLStyleElement {
    if (!(node instanceof HTMLStyleElement)) return false;
    if (node.hasAttribute('data-esmap-scoped')) return false;
    if (node.getAttribute('type') === 'importmap') return false;
    if (exclude?.(node)) return false;
    return true;
  }

  /**
   * style 요소의 CSS를 스코핑한다.
   * @param element - 스코핑할 style 요소
   */
  /**
   * style 요소의 CSS를 스코핑한다.
   * 빌드 타임에 이미 프리스코핑된 CSS는 건너뛴다.
   * @param element - 스코핑할 style 요소
   */
  function scopeElement(element: HTMLStyleElement): void {
    const originalCss = element.textContent ?? '';
    if (originalCss.trim().length === 0) return;
    if (isPrescopedCss(originalCss)) {
      element.setAttribute('data-esmap-scoped', appName);
      return;
    }

    element.textContent = scopeCssText(originalCss, appName);
    element.setAttribute('data-esmap-scoped', appName);
    tracked.push({ element, originalCss });
  }

  /**
   * CSS-in-JS 라이브러리는 빈 style 태그를 먼저 삽입한 후 나중에 내용을 채우는 경우가 있다.
   * characterData 변경을 감시하여 내용이 추가되면 스코핑한다.
   * @param element - 감시할 style 요소
   */
  function observeContentChange(element: HTMLStyleElement): void {
    const contentObserver = new MutationObserver(() => {
      if (!ref.active) {
        contentObserver.disconnect();
        return;
      }

      const alreadyTracked = tracked.some((t) => t.element === element);
      if (alreadyTracked) {
        // 이미 스코핑된 요소의 내용이 변경됨 — 재스코핑
        const idx = tracked.findIndex((t) => t.element === element);
        if (idx !== -1) {
          tracked.splice(idx, 1);
        }
        element.removeAttribute('data-esmap-scoped');
      }

      scopeElement(element);
    });

    contentObserver.observe(element, { childList: true, characterData: true, subtree: true });
  }

  return {
    start(): void {
      if (ref.active) return;
      ref.active = true;

      // 이미 head에 있는 스타일 요소 중 스코핑되지 않은 것을 처리
      const existing = document.head.querySelectorAll<HTMLStyleElement>(
        'style:not([data-esmap-scoped]):not([type="importmap"])',
      );
      for (const el of existing) {
        if (exclude?.(el)) continue;
        scopeElement(el);
      }

      // 새로 추가되는 스타일 요소를 감시
      ref.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!isTargetStyleElement(node)) continue;

            if ((node.textContent ?? '').trim().length === 0) {
              // 빈 style 태그 — 내용 변경을 감시
              observeContentChange(node);
            } else {
              scopeElement(node);
            }
          }
        }
      });

      ref.observer.observe(document.head, { childList: true });
    },

    stop(): void {
      ref.active = false;
      ref.observer?.disconnect();
      ref.observer = null;
    },

    destroy(): void {
      ref.active = false;
      ref.observer?.disconnect();
      ref.observer = null;

      // 원본 CSS로 복원
      for (const { element, originalCss } of tracked) {
        if (element.parentNode) {
          element.textContent = originalCss;
          element.removeAttribute('data-esmap-scoped');
        }
      }
      tracked.length = 0;
    },

    getScopedCount(): number {
      return tracked.length;
    },
  };
}
