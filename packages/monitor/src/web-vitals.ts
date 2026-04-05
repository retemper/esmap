/**
 * Provides per-MFE Web Vitals (CLS, LCP, INP) attribution.
 * Uses PerformanceObserver to identify which MFE app caused each metric.
 */

/** Web Vitals metric type */
type WebVitalMetric = 'CLS' | 'LCP' | 'INP';

/** Per-app Web Vital measurement result */
interface AppWebVital {
  readonly appName: string;
  readonly metric: WebVitalMetric;
  readonly value: number;
  readonly entries: readonly PerformanceEntry[];
}

/** Web Vitals listener */
type WebVitalListener = (vital: AppWebVital) => void;

/** Web Vitals tracking handle */
interface WebVitalsTracker {
  /** Returns per-app values for a specific metric */
  getMetric(metric: WebVitalMetric): ReadonlyMap<string, number>;
  /** Summarizes all metrics per app */
  summarize(): ReadonlyMap<
    string,
    { readonly cls: number; readonly lcp: number; readonly inp: number }
  >;
  /** Registers a metric event listener */
  onVital(listener: WebVitalListener): () => void;
  /** Stops tracking and disconnects observers */
  destroy(): void;
}

/** Web Vitals tracking options */
interface WebVitalsOptions {
  /** Attribute name to identify app containers. Defaults to 'data-esmap-scope'. */
  readonly scopeAttribute?: string;
}

/** CLS session window state */
interface ClsSession {
  value: number;
  entries: PerformanceEntry[];
  firstTimestamp: number;
  lastTimestamp: number;
}

/** Per-app CLS session tracking state */
interface ClsState {
  currentSession: ClsSession;
  maxSessionValue: number;
}

/** Per-app INP interaction tracking state */
interface InpState {
  /** interactionId to max duration */
  interactions: Map<number, number>;
  worstDuration: number;
}

/** Type for the source property of a layout-shift entry */
interface LayoutShiftSource {
  readonly node: Element | null;
}

/** Maximum gap for CLS session window (ms) */
const CLS_SESSION_GAP = 1000;

/** Maximum length for CLS session window (ms) */
const CLS_SESSION_MAX_WINDOW = 5000;

/** Shell app name used when attribution fails */
const SHELL_APP_NAME = '__shell__';

/**
 * Finds the closest MFE scope name from an element.
 * @param element - starting element for traversal
 * @param attr - attribute name to identify the scope
 * @returns scope name, or null if not found
 */
function findAppScope(element: Element | null, attr: string): string | null {
  if (!element) return null;
  const scoped = element.closest(`[${attr}]`);
  return scoped?.getAttribute(attr) ?? null;
}

/**
 * Checks whether a PerformanceEntry has the layout-shift sources property.
 * @param entry - entry to inspect
 * @returns whether the sources property exists
 */
function hasLayoutShiftSources(entry: PerformanceEntry): entry is PerformanceEntry & {
  readonly sources: readonly LayoutShiftSource[];
  readonly value: number;
} {
  return 'sources' in entry && 'value' in entry;
}

/**
 * Checks whether a PerformanceEntry has the LCP element property.
 * @param entry - entry to inspect
 * @returns whether the element property exists
 */
function hasLcpElement(
  entry: PerformanceEntry,
): entry is PerformanceEntry & { readonly element: Element | null } {
  return 'element' in entry;
}

/**
 * Checks whether a PerformanceEntry has the event target and interactionId properties.
 * @param entry - entry to inspect
 * @returns whether the target/interactionId properties exist
 */
function hasEventTarget(
  entry: PerformanceEntry,
): entry is PerformanceEntry & { readonly target: Element | null; readonly interactionId: number } {
  return 'target' in entry && 'interactionId' in entry;
}

/**
 * Dispatches a metric event to listeners.
 * Individual listener errors are isolated.
 * @param listeners - list of registered listeners
 * @param vital - metric data to dispatch
 */
function notifyListeners(listeners: readonly WebVitalListener[], vital: AppWebVital): void {
  for (const listener of listeners) {
    try {
      listener(vital);
    } catch {
      // Listener errors are isolated -- they do not block other listeners
    }
  }
}

/**
 * Updates the CLS session window and returns the maximum value.
 * Starts a new session when gap >= 1000ms or window >= 5000ms.
 * @param state - current CLS state
 * @param value - new layout-shift value
 * @param timestamp - entry start time
 * @param entry - layout-shift entry
 * @returns updated CLS maximum value
 */
function updateClsSession(
  state: ClsState,
  value: number,
  timestamp: number,
  entry: PerformanceEntry,
): number {
  const { currentSession } = state;
  const gap = timestamp - currentSession.lastTimestamp;
  const windowDuration = timestamp - currentSession.firstTimestamp;

  if (gap >= CLS_SESSION_GAP || windowDuration >= CLS_SESSION_MAX_WINDOW) {
    // Start new session
    state.currentSession = {
      value,
      entries: [entry],
      firstTimestamp: timestamp,
      lastTimestamp: timestamp,
    };
  } else {
    currentSession.value += value;
    currentSession.entries.push(entry);
    currentSession.lastTimestamp = timestamp;
  }

  if (state.currentSession.value > state.maxSessionValue) {
    state.maxSessionValue = state.currentSession.value;
  }

  return state.maxSessionValue;
}

/**
 * Creates a new CLS state.
 * @returns initial CLS state
 */
function createClsState(): ClsState {
  return {
    currentSession: {
      value: 0,
      entries: [],
      firstTimestamp: 0,
      lastTimestamp: 0,
    },
    maxSessionValue: 0,
  };
}

/**
 * Creates a new INP state.
 * @returns initial INP state
 */
function createInpState(): InpState {
  return {
    interactions: new Map(),
    worstDuration: 0,
  };
}

/**
 * Creates a Web Vitals tracker.
 * Uses PerformanceObserver to attribute CLS, LCP, INP metrics to individual MFE apps.
 * @param options - tracking options
 * @returns Web Vitals tracking handle. Returns a no-op handle if PerformanceObserver is unavailable.
 */
function createWebVitalsTracker(options?: WebVitalsOptions): WebVitalsTracker {
  const scopeAttribute = options?.scopeAttribute ?? 'data-esmap-scope';
  const listeners: WebVitalListener[] = [];

  const clsPerApp = new Map<string, ClsState>();
  const lcpPerApp = new Map<string, number>();
  const inpPerApp = new Map<string, InpState>();
  const lcpEntriesPerApp = new Map<string, PerformanceEntry[]>();

  if (typeof PerformanceObserver === 'undefined') {
    return createNoopTracker();
  }

  const observers: PerformanceObserver[] = [];

  /**
   * Processes layout-shift entries to update per-app CLS.
   * @param entries - list of layout-shift entries
   */
  const handleLayoutShift = (entries: PerformanceEntryList): void => {
    for (const entry of entries) {
      if (!hasLayoutShiftSources(entry)) continue;

      const appName = resolveAppFromShiftSources(entry.sources, scopeAttribute);
      const state = clsPerApp.get(appName) ?? createClsState();
      clsPerApp.set(appName, state);

      const clsValue = updateClsSession(state, entry.value, entry.startTime, entry);

      notifyListeners([...listeners], {
        appName,
        metric: 'CLS',
        value: clsValue,
        entries: state.currentSession.entries,
      });
    }
  };

  /**
   * Processes largest-contentful-paint entries to update per-app LCP.
   * @param entries - list of LCP entries
   */
  const handleLcp = (entries: PerformanceEntryList): void => {
    for (const entry of entries) {
      if (!hasLcpElement(entry)) continue;

      const appName = findAppScope(entry.element, scopeAttribute) ?? SHELL_APP_NAME;
      lcpPerApp.set(appName, entry.startTime);

      const appEntries = lcpEntriesPerApp.get(appName) ?? [];
      appEntries.push(entry);
      lcpEntriesPerApp.set(appName, appEntries);

      notifyListeners([...listeners], {
        appName,
        metric: 'LCP',
        value: entry.startTime,
        entries: [entry],
      });
    }
  };

  /**
   * Processes event entries to update per-app INP.
   * @param entries - list of event entries
   */
  const handleEvent = (entries: PerformanceEntryList): void => {
    for (const entry of entries) {
      if (!hasEventTarget(entry)) continue;
      if (entry.interactionId === 0) continue;

      const appName = findAppScope(entry.target, scopeAttribute) ?? SHELL_APP_NAME;
      const state = inpPerApp.get(appName) ?? createInpState();
      inpPerApp.set(appName, state);

      const currentDuration = state.interactions.get(entry.interactionId) ?? 0;
      if (entry.duration > currentDuration) {
        state.interactions.set(entry.interactionId, entry.duration);
      }

      const newWorst = Math.max(...state.interactions.values());
      state.worstDuration = newWorst;

      notifyListeners([...listeners], {
        appName,
        metric: 'INP',
        value: newWorst,
        entries: [entry],
      });
    }
  };

  /**
   * Infers the app name from layout-shift sources.
   * @param sources - list of LayoutShiftAttribution
   * @param attr - scope attribute name
   * @returns app name, or SHELL_APP_NAME if unidentifiable
   */
  const resolveAppFromShiftSources = (
    sources: readonly LayoutShiftSource[],
    attr: string,
  ): string => {
    for (const source of sources) {
      const appName = findAppScope(source.node, attr);
      if (appName) return appName;
    }
    return SHELL_APP_NAME;
  };

  const tryObserve = (type: string, callback: (entries: PerformanceEntryList) => void): void => {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      // Unsupported entry types are silently ignored
    }
  };

  tryObserve('layout-shift', handleLayoutShift);
  tryObserve('largest-contentful-paint', handleLcp);
  tryObserve('event', handleEvent);

  return {
    getMetric(metric: WebVitalMetric): ReadonlyMap<string, number> {
      switch (metric) {
        case 'CLS': {
          const result = new Map<string, number>();
          for (const [appName, state] of clsPerApp) {
            result.set(appName, state.maxSessionValue);
          }
          return result;
        }
        case 'LCP':
          return new Map(lcpPerApp);
        case 'INP': {
          const result = new Map<string, number>();
          for (const [appName, state] of inpPerApp) {
            result.set(appName, state.worstDuration);
          }
          return result;
        }
        default: {
          const _exhaustive: never = metric;
          return _exhaustive;
        }
      }
    },

    summarize(): ReadonlyMap<
      string,
      { readonly cls: number; readonly lcp: number; readonly inp: number }
    > {
      const appNames = new Set([...clsPerApp.keys(), ...lcpPerApp.keys(), ...inpPerApp.keys()]);
      const result = new Map<
        string,
        { readonly cls: number; readonly lcp: number; readonly inp: number }
      >();

      for (const appName of appNames) {
        result.set(appName, {
          cls: clsPerApp.get(appName)?.maxSessionValue ?? 0,
          lcp: lcpPerApp.get(appName) ?? 0,
          inp: inpPerApp.get(appName)?.worstDuration ?? 0,
        });
      }

      return result;
    },

    onVital(listener: WebVitalListener): () => void {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },

    destroy(): void {
      for (const observer of observers) {
        observer.disconnect();
      }
      observers.length = 0;
      listeners.length = 0;
    },
  };
}

/**
 * Creates a no-op tracker for environments without PerformanceObserver.
 * @returns tracking handle where all methods return empty results
 */
function createNoopTracker(): WebVitalsTracker {
  return {
    getMetric(): ReadonlyMap<string, number> {
      return new Map();
    },
    summarize(): ReadonlyMap<
      string,
      { readonly cls: number; readonly lcp: number; readonly inp: number }
    > {
      return new Map();
    },
    onVital(): () => void {
      return () => {};
    },
    destroy(): void {},
  };
}

export { createWebVitalsTracker, findAppScope };
export type { WebVitalsTracker, WebVitalsOptions, AppWebVital, WebVitalMetric, WebVitalListener };
