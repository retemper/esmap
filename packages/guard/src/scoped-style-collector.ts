/**
 * Detects and automatically scopes <style> elements dynamically injected
 * into document.head by CSS-in-JS libraries (styled-components, Emotion, etc.).
 *
 * The existing style-collector only collects without scoping,
 * and style-isolation only watches inside the container.
 * This module bridges both to scope styles injected into head.
 */

import { scopeCssText, isPrescopedCss } from './css-scope.js';

/** Scoped style collector options */
export interface ScopedStyleCollectorOptions {
  /** App name used for scoping */
  readonly appName: string;
  /**
   * Function to determine which style elements to exclude from scoping.
   * If it returns true, the element will not be scoped.
   */
  readonly exclude?: (element: HTMLStyleElement | HTMLLinkElement) => boolean;
}

/** Scoped style collector handle */
export interface ScopedStyleCollectorHandle {
  /** Starts collection and scoping */
  start(): void;
  /** Stops collection. Already scoped styles are preserved. */
  stop(): void;
  /** Restores all scoped styles to their originals and releases the collector */
  destroy(): void;
  /** Returns the number of currently scoped style elements */
  getScopedCount(): number;
}

/** Original data for a scoped style element */
interface TrackedStyle {
  /** The scoped element */
  readonly element: HTMLStyleElement;
  /** Original CSS text */
  readonly originalCss: string;
}

/**
 * Creates a collector that detects style elements injected into head and automatically applies CSS scoping.
 * Provides compatibility with CSS-in-JS libraries (styled-components, Emotion, etc.).
 *
 * @param options - collector options
 * @returns collector handle
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
   * Determines whether a style element is a collection target.
   * @param node - DOM node to check
   */
  function isTargetStyleElement(node: Node): node is HTMLStyleElement {
    if (!(node instanceof HTMLStyleElement)) return false;
    if (node.hasAttribute('data-esmap-scoped')) return false;
    if (node.getAttribute('type') === 'importmap') return false;
    if (exclude?.(node)) return false;
    return true;
  }

  /**
   * Scopes the CSS of a style element.
   * Skips CSS that was already prescoped at build time.
   * @param element - style element to scope
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
   * CSS-in-JS libraries may insert an empty style tag first and fill in content later.
   * Watches for characterData changes and scopes when content is added.
   * @param element - style element to watch
   */
  function observeContentChange(element: HTMLStyleElement): void {
    const contentObserver = new MutationObserver(() => {
      if (!ref.active) {
        contentObserver.disconnect();
        return;
      }

      const alreadyTracked = tracked.some((t) => t.element === element);
      if (alreadyTracked) {
        // Content of an already scoped element changed -- re-scope
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

      // Process unscoped style elements already in head
      const existing = document.head.querySelectorAll<HTMLStyleElement>(
        'style:not([data-esmap-scoped]):not([type="importmap"])',
      );
      for (const el of existing) {
        if (exclude?.(el)) continue;
        scopeElement(el);
      }

      // Watch for newly added style elements
      ref.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!isTargetStyleElement(node)) continue;

            if ((node.textContent ?? '').trim().length === 0) {
              // Empty style tag -- watch for content changes
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

      // Restore original CSS
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
