/**
 * Automatic stylesheet discovery and scoping.
 * Automatically finds and isolates styles inside the container when an MFE app is mounted.
 */

import { scopeCssText } from './css-scope.js';

/** Automatic style isolation options */
export interface StyleIsolationOptions {
  /** App name used for scoping */
  readonly appName: string;
  /** Container element where the app is rendered */
  readonly container: HTMLElement;
  /** Strategy: 'attribute' (data-attr scoping) or 'shadow' (Shadow DOM) */
  readonly strategy?: 'attribute' | 'shadow';
  /** Whether to detect dynamically added styles via MutationObserver */
  readonly observeDynamic?: boolean;
}

/** Handle for controlling and releasing style isolation */
export interface StyleIsolationHandle {
  /** Stops the observer and removes scoping */
  destroy(): void;
  /** Returns the number of scoped stylesheets */
  getScopedCount(): number;
  /** Forcefully re-scopes all discovered styles */
  refresh(): void;
}

/** Original data for a scoped style element */
interface ScopedStyleRecord {
  /** The scoped element */
  readonly element: HTMLStyleElement | HTMLLinkElement;
  /** Original CSS text (for style elements) */
  readonly originalCss: string | null;
  /** Scope wrapper created for the original link (for link elements) */
  readonly wrapperStyle: HTMLStyleElement | null;
}

/**
 * Applies scoping to a style element inside the container.
 * @param element - style element to scope
 * @param appName - app name
 * @returns scoping record
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
 * Adds a scope wrapper to a link[rel="stylesheet"] element inside the container.
 * @param element - link element to scope
 * @param appName - app name
 * @returns scoping record
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
 * Restores a scoping record back to its original state.
 * @param record - scoping record to restore
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
 * Discovers and scopes all style elements inside the container.
 * @param container - container to search
 * @param appName - app name
 * @returns array of scoping records
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
 * Creates automatic style isolation.
 * Scopes existing styles inside the container and optionally observes dynamic additions.
 * @param options - style isolation options
 * @returns isolation control handle
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
 * Creates a Shadow DOM-based isolation handle.
 * @param container - target container
 * @returns isolation control handle
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
      // Shadow DOM is already isolated, no additional work needed
    },
  };
}

/**
 * Creates a MutationObserver that watches for dynamically added styles.
 * @param container - container to observe
 * @param appName - app name
 * @param records - array to accumulate scoping records
 * @returns connected MutationObserver
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
