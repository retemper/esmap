/**
 * esmap DevTools Extension — shared message protocol.
 *
 * Defines message types between content script,
 * background service worker, and panel.
 */

/** App information */
export interface AppInfo {
  readonly name: string;
  readonly status: string;
  readonly container: string;
}

/** Event category */
export type EventCategory = 'lifecycle' | 'auth' | 'route' | 'state' | 'error' | 'all';

/** Transition statistics */
export interface TransitionStats {
  readonly from: string;
  readonly to: string;
  readonly count: number;
  readonly ratio: number;
}

/** Page -> Panel direction messages (page postMessage -> content-script -> background -> panel) */
export type PageToPanel =
  | {
      type: 'ESMAP_INIT';
      apps: AppInfo[];
      currentState: Record<string, unknown>;
      prefetchStats: TransitionStats[];
    }
  | { type: 'ESMAP_STATUS_CHANGE'; appName: string; from: string; to: string; timestamp: number }
  | {
      type: 'ESMAP_EVENT';
      event: string;
      payload: string;
      category: EventCategory;
      appName?: string;
      timestamp: number;
    }
  | {
      type: 'ESMAP_STATE_CHANGE';
      newState: Record<string, unknown>;
      prevState: Record<string, unknown>;
      timestamp: number;
    }
  | { type: 'ESMAP_ROUTE_CHANGE'; from: string; to: string; timestamp: number }
  | {
      type: 'ESMAP_PERF';
      appName: string;
      phase: string;
      duration: number;
      startTime: number;
      timestamp: number;
    }
  | { type: 'ESMAP_PREFETCH_STATS'; stats: TransitionStats[]; timestamp: number }
  | { type: 'ESMAP_LOG'; message: string; timestamp: number };

/** Panel -> Page direction messages (panel -> background -> content-script -> page postMessage) */
export type PanelToPage = { type: 'ESMAP_GET_SNAPSHOT' };

/** window.postMessage envelope */
export interface MessageEnvelope {
  readonly source: 'esmap-devtools' | 'esmap-devtools-panel';
  readonly payload: PageToPanel | PanelToPage;
}

/** Chrome extension port message */
export interface PortMessage {
  readonly tabId?: number;
  readonly payload: PageToPanel | PanelToPage;
}
