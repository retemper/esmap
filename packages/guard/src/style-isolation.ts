/**
 * 자동 스타일시트 검색 및 스코핑.
 * MFE 앱이 마운트될 때 컨테이너 내부의 스타일을 자동으로 찾아 격리한다.
 */

import { scopeCssText } from './css-scope.js';

/** 자동 스타일 격리 옵션 */
export interface StyleIsolationOptions {
  /** 스코핑에 사용할 앱 이름 */
  readonly appName: string;
  /** 앱이 렌더링되는 컨테이너 요소 */
  readonly container: HTMLElement;
  /** 전략: 'attribute' (data-attr 스코핑) 또는 'shadow' (Shadow DOM) */
  readonly strategy?: 'attribute' | 'shadow';
  /** MutationObserver로 동적 추가 스타일을 감지할지 여부 */
  readonly observeDynamic?: boolean;
}

/** 스타일 격리를 제어하고 해제하기 위한 핸들 */
export interface StyleIsolationHandle {
  /** 옵저버를 중단하고 스코핑을 제거한다 */
  destroy(): void;
  /** 스코핑된 스타일시트 개수를 반환한다 */
  getScopedCount(): number;
  /** 모든 발견된 스타일을 강제로 다시 스코핑한다 */
  refresh(): void;
}

/** 스코핑된 스타일 요소의 원본 데이터 */
interface ScopedStyleRecord {
  /** 스코핑된 요소 */
  readonly element: HTMLStyleElement | HTMLLinkElement;
  /** 원본 CSS 텍스트 (style 요소인 경우) */
  readonly originalCss: string | null;
  /** 원본 link에 대해 생성된 scope wrapper (link 요소인 경우) */
  readonly wrapperStyle: HTMLStyleElement | null;
}

/**
 * 컨테이너 내부의 style 요소에 스코핑을 적용한다.
 * @param element - 스코핑할 style 요소
 * @param appName - 앱 이름
 * @returns 스코핑 기록
 */
function scopeStyleElement(element: HTMLStyleElement, appName: string): ScopedStyleRecord {
  const originalCss = element.textContent ?? '';
  element.textContent = scopeCssText(originalCss, appName);
  element.setAttribute('data-esmap-scoped', appName);

  return {
    element,
    originalCss,
    wrapperStyle: null,
  };
}

/**
 * 컨테이너 내부의 link[rel="stylesheet"] 요소에 스코프 래퍼를 추가한다.
 * @param element - 스코핑할 link 요소
 * @param appName - 앱 이름
 * @returns 스코핑 기록
 */
function scopeLinkElement(element: HTMLLinkElement, appName: string): ScopedStyleRecord {
  const wrapper = document.createElement('style');
  const scopeAttr = `[data-esmap-scope="${appName}"]`;
  wrapper.textContent = `${scopeAttr} { @import url("${element.href}"); }`;
  wrapper.setAttribute('data-esmap-scoped', appName);
  wrapper.setAttribute('data-esmap-link-wrapper', 'true');

  element.setAttribute('data-esmap-original-link', appName);
  element.disabled = true;
  element.parentNode?.insertBefore(wrapper, element.nextSibling);

  return {
    element,
    originalCss: null,
    wrapperStyle: wrapper,
  };
}

/**
 * 스코핑 기록을 복원하여 원본 상태로 되돌린다.
 * @param record - 복원할 스코핑 기록
 */
function restoreScopedRecord(record: ScopedStyleRecord): void {
  if (record.originalCss !== null && record.element instanceof HTMLStyleElement) {
    record.element.textContent = record.originalCss;
    record.element.removeAttribute('data-esmap-scoped');
  }

  if (record.wrapperStyle !== null && record.element instanceof HTMLLinkElement) {
    record.wrapperStyle.remove();
    record.element.disabled = false;
    record.element.removeAttribute('data-esmap-original-link');
  }
}

/**
 * 컨테이너 내부의 모든 스타일 요소를 검색하여 스코핑한다.
 * @param container - 검색 대상 컨테이너
 * @param appName - 앱 이름
 * @returns 스코핑 기록 배열
 */
function discoverAndScope(container: HTMLElement, appName: string): readonly ScopedStyleRecord[] {
  const records: ScopedStyleRecord[] = [];

  const styleElements = container.querySelectorAll<HTMLStyleElement>(
    'style:not([data-esmap-scoped])',
  );
  for (const el of styleElements) {
    records.push(scopeStyleElement(el, appName));
  }

  const linkElements = container.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]:not([data-esmap-original-link])',
  );
  for (const el of linkElements) {
    records.push(scopeLinkElement(el, appName));
  }

  return records;
}

/**
 * 자동 스타일 격리를 생성한다.
 * 컨테이너 내부의 기존 스타일을 스코핑하고, 옵션에 따라 동적 추가도 감시한다.
 * @param options - 스타일 격리 옵션
 * @returns 격리 제어 핸들
 */
export function createStyleIsolation(options: StyleIsolationOptions): StyleIsolationHandle {
  const { appName, container, strategy = 'attribute', observeDynamic = false } = options;

  if (strategy === 'shadow') {
    return createShadowIsolation(container);
  }

  const scopedRecords: ScopedStyleRecord[] = [...discoverAndScope(container, appName)];
  const observer = observeDynamic ? createStyleObserver(container, appName, scopedRecords) : null;

  return {
    destroy() {
      observer?.disconnect();
      for (const record of scopedRecords) {
        restoreScopedRecord(record);
      }
      scopedRecords.length = 0;
    },

    getScopedCount() {
      return scopedRecords.length;
    },

    refresh() {
      for (const record of scopedRecords) {
        restoreScopedRecord(record);
      }
      scopedRecords.length = 0;
      scopedRecords.push(...discoverAndScope(container, appName));
    },
  };
}

/**
 * Shadow DOM 기반 격리 핸들을 생성한다.
 * @param container - 대상 컨테이너
 * @returns 격리 제어 핸들
 */
function createShadowIsolation(container: HTMLElement): StyleIsolationHandle {
  const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: 'open' });
  const wrapper = document.createElement('div');
  shadowRoot.appendChild(wrapper);

  return {
    destroy() {
      wrapper.remove();
    },

    getScopedCount() {
      return shadowRoot.querySelectorAll('style, link[rel="stylesheet"]').length;
    },

    refresh() {
      // Shadow DOM은 이미 격리되어 있으므로 추가 작업 불필요
    },
  };
}

/**
 * 동적 스타일 추가를 감시하는 MutationObserver를 생성한다.
 * @param container - 감시 대상 컨테이너
 * @param appName - 앱 이름
 * @param records - 스코핑 기록을 축적할 배열
 * @returns 연결된 MutationObserver
 */
function createStyleObserver(
  container: HTMLElement,
  appName: string,
  records: ScopedStyleRecord[],
): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (node instanceof HTMLStyleElement && !node.hasAttribute('data-esmap-scoped')) {
          records.push(scopeStyleElement(node, appName));
        }

        if (
          node instanceof HTMLLinkElement &&
          node.rel === 'stylesheet' &&
          !node.hasAttribute('data-esmap-original-link')
        ) {
          records.push(scopeLinkElement(node, appName));
        }
      }
    }
  });

  observer.observe(container, { childList: true, subtree: true });
  return observer;
}
