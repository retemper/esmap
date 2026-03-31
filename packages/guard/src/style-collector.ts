/**
 * Per-app stylesheet tracking utility.
 * Collects and manages style elements added to document head on a per-app basis.
 */

/** Style collector interface */
export interface StyleCollector {
  /** Starts style collection for a specific app */
  startCapture(appName: string): void;
  /** Stops collection and returns collected style elements */
  stopCapture(appName: string): readonly (HTMLStyleElement | HTMLLinkElement)[];
  /** Removes all styles belonging to a specific app from the DOM */
  removeStyles(appName: string): void;
  /** Returns all style elements belonging to a specific app */
  getStyles(appName: string): readonly (HTMLStyleElement | HTMLLinkElement)[];
  /** Releases the collector and cleans up all resources */
  destroy(): void;
}

/** Per-app capture state */
interface CaptureState {
  /** Whether capture is active */
  readonly active: boolean;
  /** List of collected style elements */
  readonly elements: (HTMLStyleElement | HTMLLinkElement)[];
}

/**
 * Determines whether a node added to head is a style-related element.
 * @param node - DOM node to check
 * @returns true if the element is style-related
 */
function isStyleRelatedElement(node: Node): node is HTMLStyleElement | HTMLLinkElement {
  if (node instanceof HTMLStyleElement) return true;
  if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') return true;
  return false;
}

/**
 * Creates a style collector.
 * Attaches a MutationObserver to document head to detect style additions.
 * @returns style collector instance
 */
export function createStyleCollector(): StyleCollector {
  const captures = new Map<string, CaptureState>();
  const activeApps = new Set<string>();

  const observer = new MutationObserver((mutations) => {
    if (activeApps.size === 0) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!isStyleRelatedElement(node)) continue;

        for (const appName of activeApps) {
          const state = captures.get(appName);
          if (state?.active) {
            node.setAttribute('data-esmap-app', appName);
            state.elements.push(node);
          }
        }
      }
    }
  });

  observer.observe(document.head, { childList: true });

  return {
    startCapture(appName: string): void {
      const existing = captures.get(appName);
      const elements = existing?.elements ?? [];

      captures.set(appName, { active: true, elements });
      activeApps.add(appName);
    },

    stopCapture(appName: string): readonly (HTMLStyleElement | HTMLLinkElement)[] {
      const state = captures.get(appName);
      if (!state) return [];

      captures.set(appName, { active: false, elements: state.elements });
      activeApps.delete(appName);

      return state.elements;
    },

    removeStyles(appName: string): void {
      const state = captures.get(appName);
      if (!state) return;

      for (const element of state.elements) {
        element.remove();
      }

      captures.set(appName, { active: state.active, elements: [] });
    },

    getStyles(appName: string): readonly (HTMLStyleElement | HTMLLinkElement)[] {
      const state = captures.get(appName);
      if (!state) return [];

      return state.elements;
    },

    destroy(): void {
      observer.disconnect();
      captures.clear();
      activeApps.clear();
    },
  };
}
