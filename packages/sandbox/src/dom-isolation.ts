/**
 * DOM 쿼리 격리.
 * document.querySelector, getElementById 등을 앱 컨테이너 범위로 스코핑한다.
 * micro-app(JD.com)의 Element Isolation 패턴에서 영감을 받았다.
 *
 * MFE 앱이 `document.querySelector('.my-class')`를 호출하면
 * 실제로는 앱의 컨테이너 내에서만 검색하여 다른 앱의 DOM에 접근하는 것을 방지한다.
 */

/** DOM 격리 옵션 */
export interface DomIsolationOptions {
  /** 앱 이름 (디버깅용) */
  readonly name: string;
  /** 앱의 DOM 컨테이너 엘리먼트 */
  readonly container: HTMLElement;
  /**
   * 격리 대상에서 제외할 셀렉터 패턴.
   * 예: ['#global-modal', '[data-esmap-global]']
   * 이 패턴에 매칭되는 쿼리는 document 전체에서 검색한다.
   */
  readonly globalSelectors?: readonly string[];
}

/** DOM 격리 핸들. dispose로 원본 메서드를 복원한다. */
export interface DomIsolationHandle {
  /** 격리를 해제하고 원본 document 메서드를 복원한다. */
  dispose(): void;
  /** 격리 대상 컨테이너를 반환한다. */
  readonly container: HTMLElement;
}

/** 패치 대상 document 메서드와 원본 참조 */
interface PatchedMethods {
  readonly querySelector: Document['querySelector'];
  readonly querySelectorAll: Document['querySelectorAll'];
  readonly getElementById: Document['getElementById'];
  readonly getElementsByClassName: Document['getElementsByClassName'];
  readonly getElementsByTagName: Document['getElementsByTagName'];
}

/**
 * 주어진 셀렉터가 글로벌 셀렉터 패턴에 매칭되는지 확인한다.
 * 패턴과 정확히 일치하거나, 패턴 뒤에 CSS 결합자/공백이 오는 경우만 매칭한다.
 * 예: 패턴 '#modal'은 '#modal'과 '#modal > .child'에 매칭되지만, '#modal-overlay'에는 매칭되지 않는다.
 * @param selector - 검사할 CSS 셀렉터
 * @param globalPatterns - 글로벌 셀렉터 패턴 목록
 */
function isGlobalSelector(selector: string, globalPatterns: readonly string[]): boolean {
  return globalPatterns.some((pattern) => {
    if (selector === pattern) return true;
    if (!selector.startsWith(pattern)) return false;
    // 패턴 직후 문자가 CSS 결합자 또는 공백이어야 매칭 (접두사 오매칭 방지)
    const nextChar = selector[pattern.length];
    return nextChar === ' ' || nextChar === '>' || nextChar === '+' || nextChar === '~'
      || nextChar === ',' || nextChar === ':' || nextChar === '[';
  });
}

/**
 * DOM 쿼리 격리를 생성한다.
 * document의 쿼리 메서드를 패치하여 앱 컨테이너 범위로 제한한다.
 *
 * @param options - DOM 격리 옵션
 * @returns DomIsolationHandle (dispose로 복원 가능)
 */
export function createDomIsolation(options: DomIsolationOptions): DomIsolationHandle {
  const { container, globalSelectors = [] } = options;

  const originals: PatchedMethods = {
    querySelector: document.querySelector.bind(document),
    querySelectorAll: document.querySelectorAll.bind(document),
    getElementById: document.getElementById.bind(document),
    getElementsByClassName: document.getElementsByClassName.bind(document),
    getElementsByTagName: document.getElementsByTagName.bind(document),
  };

  document.querySelector = function patchedQuerySelector<E extends Element>(
    selectors: string,
  ): E | null {
    if (isGlobalSelector(selectors, globalSelectors)) {
      return originals.querySelector(selectors);
    }
    return container.querySelector<E>(selectors);
  };

  document.querySelectorAll = function patchedQuerySelectorAll<E extends Element>(
    selectors: string,
  ): NodeListOf<E> {
    if (isGlobalSelector(selectors, globalSelectors)) {
      return originals.querySelectorAll(selectors);
    }
    return container.querySelectorAll<E>(selectors);
  };

  document.getElementById = function patchedGetElementById(elementId: string): HTMLElement | null {
    // getElementById는 ID 기반이므로 globalSelectors 체크를 #id 형태로 수행한다
    if (isGlobalSelector(`#${elementId}`, globalSelectors)) {
      return originals.getElementById(elementId);
    }
    return container.querySelector<HTMLElement>(`#${elementId}`);
  };

  document.getElementsByClassName = function patchedGetElementsByClassName(
    classNames: string,
  ): HTMLCollectionOf<Element> {
    if (isGlobalSelector(`.${classNames.split(' ')[0]}`, globalSelectors)) {
      return originals.getElementsByClassName(classNames);
    }
    return container.getElementsByClassName(classNames);
  };

  Object.defineProperty(document, 'getElementsByTagName', {
    value: function patchedGetElementsByTagName(qualifiedName: string) {
      return container.getElementsByTagName(qualifiedName);
    },
    configurable: true,
    writable: true,
  });

  return {
    container,
    dispose(): void {
      document.querySelector = originals.querySelector;
      document.querySelectorAll = originals.querySelectorAll;
      document.getElementById = originals.getElementById;
      document.getElementsByClassName = originals.getElementsByClassName;
      document.getElementsByTagName = originals.getElementsByTagName;
    },
  };
}
