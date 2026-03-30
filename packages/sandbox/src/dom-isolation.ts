/**
 * DOM query isolation.
 * Scopes document.querySelector, getElementById, etc. to the app container boundary.
 * Inspired by the Element Isolation pattern from micro-app (JD.com).
 *
 * When an MFE app calls `document.querySelector('.my-class')`,
 * it actually searches only within the app's container, preventing access to other apps' DOM.
 */

/** DOM isolation options */
export interface DomIsolationOptions {
  /** App name (for debugging) */
  readonly name: string;
  /** App's DOM container element */
  readonly container: HTMLElement;
  /**
   * Selector patterns to exclude from isolation.
   * Example: ['#global-modal', '[data-esmap-global]']
   * Queries matching these patterns search the entire document.
   */
  readonly globalSelectors?: readonly string[];
}

/** DOM isolation handle. Restores original methods via dispose. */
export interface DomIsolationHandle {
  /** Releases isolation and restores original document methods. */
  dispose(): void;
  /** Returns the isolated container element. */
  readonly container: HTMLElement;
}

/** Patched document methods and their original references */
interface PatchedMethods {
  readonly querySelector: Document['querySelector'];
  readonly querySelectorAll: Document['querySelectorAll'];
  readonly getElementById: Document['getElementById'];
  readonly getElementsByClassName: Document['getElementsByClassName'];
  readonly getElementsByTagName: Document['getElementsByTagName'];
}

/**
 * Checks whether the given selector matches any global selector pattern.
 * Matches only exact patterns or patterns followed by a CSS combinator/whitespace.
 * Example: pattern '#modal' matches '#modal' and '#modal > .child', but not '#modal-overlay'.
 * @param selector - CSS selector to check
 * @param globalPatterns - list of global selector patterns
 */
function isGlobalSelector(selector: string, globalPatterns: readonly string[]): boolean {
  return globalPatterns.some((pattern) => {
    if (selector === pattern) return true;
    if (!selector.startsWith(pattern)) return false;
    // The character immediately after the pattern must be a CSS combinator or whitespace (prevents prefix false-positives)
    const nextChar = selector[pattern.length];
    return nextChar === ' ' || nextChar === '>' || nextChar === '+' || nextChar === '~'
      || nextChar === ',' || nextChar === ':' || nextChar === '[';
  });
}

/**
 * Creates DOM query isolation.
 * Patches document query methods to restrict them to the app container scope.
 *
 * @param options - DOM isolation options
 * @returns DomIsolationHandle (restorable via dispose)
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
    // getElementById is ID-based, so globalSelectors check is performed in #id format
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
