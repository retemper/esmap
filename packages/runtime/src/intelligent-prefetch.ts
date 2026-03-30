/**
 * Intelligent prefetch system.
 * Learns user navigation patterns to prioritize prefetching apps most likely to be visited next.
 * Inspired by Garfish (ByteDance)'s intelligent preloading pattern.
 *
 * How it works:
 * 1. Records user page transitions (from -> to)
 * 2. Aggregates transition frequency from each app to the next
 * 3. Prioritizes prefetching the most frequently visited apps from the current app
 */

import { isRecord } from '@esmap/shared';

/** A single entry in the navigation transition history */
export interface NavigationRecord {
  /** Source app name (undefined for initial entry) */
  readonly from: string | undefined;
  /** Destination app name */
  readonly to: string;
  /** Transition timestamp (ms) */
  readonly timestamp: number;
}

/** Transition frequency statistics */
export interface TransitionStats {
  /** Source app name */
  readonly from: string;
  /** Destination app name */
  readonly to: string;
  /** Transition count */
  readonly count: number;
  /** Ratio of total transitions (0~1) */
  readonly ratio: number;
}

/** Prefetch priority information */
export interface PrefetchPriority {
  /** App name */
  readonly appName: string;
  /** Visit probability (0~1). Based on transition frequency. */
  readonly probability: number;
}

/** Intelligent prefetch options */
export interface IntelligentPrefetchOptions {
  /**
   * Maximum number of navigations to record. Old records are automatically removed.
   * Defaults to 200.
   */
  readonly maxHistory?: number;
  /**
   * Prefetch trigger probability threshold (0~1).
   * Only apps with transition probability at or above this value are prefetched.
   * Defaults to 0.1 (10%).
   */
  readonly threshold?: number;
  /**
   * Maximum number of apps to prefetch.
   * Defaults to 3.
   */
  readonly maxPrefetch?: number;
  /**
   * localStorage key. Persists learned data across browser sessions.
   * If undefined, data is only kept within the session.
   */
  readonly persistKey?: string;
}

/** Intelligent prefetch controller */
export interface IntelligentPrefetchController {
  /** Records a navigation transition. */
  recordNavigation(from: string | undefined, to: string): void;
  /** Calculates prefetch priorities based on the current app. */
  getPriorities(currentApp: string): readonly PrefetchPriority[];
  /** Returns overall transition statistics. */
  getStats(): readonly TransitionStats[];
  /** Returns the number of recorded navigations. */
  readonly historySize: number;
  /** Resets all learned data. */
  reset(): void;
  /** Saves learned data to localStorage (when persistKey is set). */
  persist(): void;
}

/** Default maximum history size */
const DEFAULT_MAX_HISTORY = 200;

/** Default prefetch threshold */
const DEFAULT_THRESHOLD = 0.1;

/** Default maximum number of apps to prefetch */
const DEFAULT_MAX_PREFETCH = 3;

/**
 * Creates an intelligent prefetch controller.
 * Learns navigation patterns to predict the next visited app.
 *
 * @param options - intelligent prefetch options
 * @returns IntelligentPrefetchController instance
 */
export function createIntelligentPrefetch(
  options: IntelligentPrefetchOptions = {},
): IntelligentPrefetchController {
  const {
    maxHistory = DEFAULT_MAX_HISTORY,
    threshold = DEFAULT_THRESHOLD,
    maxPrefetch = DEFAULT_MAX_PREFETCH,
    persistKey,
  } = options;

  /** Navigation history */
  const history: NavigationRecord[] = loadPersistedHistory(persistKey);

  /** Transition frequency map: "from→to" → count */
  const transitionCounts = new Map<string, number>();
  /** Total transitions per source: "from" → totalCount */
  const fromTotals = new Map<string, number>();

  /** Rebuilds transition counts from existing history */
  function rebuildCounts(): void {
    transitionCounts.clear();
    fromTotals.clear();
    for (const record of history) {
      if (record.from === undefined) continue;
      const key = `${record.from}→${record.to}`;
      transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
      fromTotals.set(record.from, (fromTotals.get(record.from) ?? 0) + 1);
    }
  }

  rebuildCounts();

  return {
    recordNavigation(from: string | undefined, to: string): void {
      history.push({ from, to, timestamp: Date.now() });

      // Decrement counts of old records and remove when max history is exceeded
      while (history.length > maxHistory) {
        const evicted = history.shift();
        if (evicted?.from !== undefined) {
          decrementTransition(transitionCounts, fromTotals, evicted.from, evicted.to);
        }
      }

      if (from !== undefined) {
        const key = `${from}→${to}`;
        transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
        fromTotals.set(from, (fromTotals.get(from) ?? 0) + 1);
      }
    },

    getPriorities(currentApp: string): readonly PrefetchPriority[] {
      const total = fromTotals.get(currentApp);
      if (total === undefined || total === 0) return [];

      const priorities: PrefetchPriority[] = [];

      for (const [key, count] of transitionCounts) {
        if (!key.startsWith(`${currentApp}→`)) continue;
        const appName = key.slice(currentApp.length + 1); // "→" is 1 char in the key
        const probability = count / total;
        if (probability >= threshold) {
          priorities.push({ appName, probability });
        }
      }

      // Sort by probability descending and truncate to maxPrefetch
      priorities.sort((a, b) => b.probability - a.probability);
      return priorities.slice(0, maxPrefetch);
    },

    getStats(): readonly TransitionStats[] {
      const stats: TransitionStats[] = [];

      for (const [key, count] of transitionCounts) {
        const arrowIndex = key.indexOf('→');
        const from = key.slice(0, arrowIndex);
        const to = key.slice(arrowIndex + 1);
        const total = fromTotals.get(from) ?? 1;
        stats.push({ from, to, count, ratio: count / total });
      }

      return stats.sort((a, b) => b.count - a.count);
    },

    get historySize(): number {
      return history.length;
    },

    reset(): void {
      history.length = 0;
      transitionCounts.clear();
      fromTotals.clear();

      if (persistKey) {
        try {
          localStorage.removeItem(persistKey);
        } catch {
          /* Ignore when localStorage is inaccessible */
        }
      }
    },

    persist(): void {
      if (!persistKey) return;

      try {
        localStorage.setItem(persistKey, JSON.stringify(history));
      } catch {
        /* Ignore when localStorage is inaccessible */
      }
    },
  };
}

/**
 * Decrements transition counts for evicted records. Removes from map when count reaches 0 or below.
 * @param counts - transition frequency map
 * @param totals - per-source total transitions map
 * @param from - source app
 * @param to - destination app
 */
function decrementTransition(
  counts: Map<string, number>,
  totals: Map<string, number>,
  from: string,
  to: string,
): void {
  const key = `${from}→${to}`;
  const count = (counts.get(key) ?? 0) - 1;
  if (count <= 0) {
    counts.delete(key);
  } else {
    counts.set(key, count);
  }
  const total = (totals.get(from) ?? 0) - 1;
  if (total <= 0) {
    totals.delete(from);
  } else {
    totals.set(from, total);
  }
}

/** Loads persisted navigation history from localStorage */
function loadPersistedHistory(persistKey: string | undefined): NavigationRecord[] {
  if (!persistKey) return [];

  try {
    const stored = localStorage.getItem(persistKey);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNavigationRecord);
  } catch {
    return [];
  }
}

/** Checks whether a value is a valid NavigationRecord */
function isNavigationRecord(value: unknown): value is NavigationRecord {
  if (!isRecord(value)) return false;
  return typeof value.to === 'string' && typeof value.timestamp === 'number';
}
