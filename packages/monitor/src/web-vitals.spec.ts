/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebVitalsTracker, findAppScope } from './web-vitals.js';
import type { WebVitalsTracker } from './web-vitals.js';

/**
 * Callback storage for mocking PerformanceObserver.
 * Stores callbacks by type on observe() calls so entries can be manually injected in tests.
 */
const observerCallbacks = new Map<
  string,
  (list: { getEntries: () => PerformanceEntry[] }) => void
>();

/** Spy to track disconnect calls */
const disconnectSpy = vi.fn();

/** Reference to the original PerformanceObserver */
const OriginalPerformanceObserver = globalThis.PerformanceObserver;

/**
 * Mocked PerformanceObserver class.
 * Stores callbacks by type on observe().
 */
class MockPerformanceObserver {
  private readonly callback: (list: { getEntries: () => PerformanceEntry[] }) => void;

  constructor(callback: (list: { getEntries: () => PerformanceEntry[] }) => void) {
    this.callback = callback;
  }

  /** Registers callbacks by type on observe call */
  observe(options: { type: string; buffered?: boolean }): void {
    observerCallbacks.set(options.type, this.callback);
  }

  /** Disconnects the observer */
  disconnect(): void {
    disconnectSpy();
  }
}

/**
 * Injects entries into the PerformanceObserver callback of a specific type.
 * @param type - entry type (layout-shift, largest-contentful-paint, event)
 * @param entries - list of entries to inject
 */
function emitEntries(type: string, entries: PerformanceEntry[]): void {
  const callback = observerCallbacks.get(type);
  if (callback) {
    callback({ getEntries: () => entries });
  }
}

/**
 * Creates a DOM structure with an MFE scope.
 * @param appName - MFE app name
 * @returns child element inside the scoped container
 */
function createScopedElement(appName: string): Element {
  const container = document.createElement('div');
  container.setAttribute('data-esmap-scope', appName);
  const child = document.createElement('div');
  container.appendChild(child);
  document.body.appendChild(container);
  return child;
}

describe('findAppScope', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds the closest MFE scope', () => {
    const child = createScopedElement('checkout-app');

    expect(findAppScope(child, 'data-esmap-scope')).toBe('checkout-app');
  });

  it('returns null when outside an MFE container', () => {
    const orphan = document.createElement('div');
    document.body.appendChild(orphan);

    expect(findAppScope(orphan, 'data-esmap-scope')).toBeNull();
  });

  it('returns null when element is null', () => {
    expect(findAppScope(null, 'data-esmap-scope')).toBeNull();
  });

  it('returns the closest scope in nested scopes', () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-esmap-scope', 'outer-app');
    const inner = document.createElement('div');
    inner.setAttribute('data-esmap-scope', 'inner-app');
    const child = document.createElement('span');
    inner.appendChild(child);
    outer.appendChild(inner);
    document.body.appendChild(outer);

    expect(findAppScope(child, 'data-esmap-scope')).toBe('inner-app');
  });
});

describe('createWebVitalsTracker', () => {
  beforeEach(() => {
    observerCallbacks.clear();
    disconnectSpy.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).PerformanceObserver = MockPerformanceObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    globalThis.PerformanceObserver = OriginalPerformanceObserver;
  });

  it('works gracefully in environments without PerformanceObserver', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).PerformanceObserver;

    const tracker = createWebVitalsTracker();

    expect(tracker.getMetric('CLS').size).toBe(0);
    expect(tracker.getMetric('LCP').size).toBe(0);
    expect(tracker.getMetric('INP').size).toBe(0);
    expect(tracker.summarize().size).toBe(0);

    const listener = vi.fn();
    const unsubscribe = tracker.onVital(listener);
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();

    tracker.destroy();
  });

  it('getMetric returns per-app CLS values', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [
      createLayoutShiftEntry(0.1, 100, [{ node: child }]),
      createLayoutShiftEntry(0.05, 200, [{ node: child }]),
    ]);

    const clsMap = tracker.getMetric('CLS');
    expect(clsMap.get('app-a')).toBe(0.15000000000000002);

    tracker.destroy();
  });

  it('attributes CLS to __host__ when outside an MFE', () => {
    const orphan = document.createElement('div');
    document.body.appendChild(orphan);
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [createLayoutShiftEntry(0.1, 100, [{ node: orphan }])]);

    const clsMap = tracker.getMetric('CLS');
    expect(clsMap.get('__host__')).toBe(0.1);

    tracker.destroy();
  });

  it('resets CLS session window when gap >= 1000ms', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [createLayoutShiftEntry(0.1, 100, [{ node: child }])]);
    emitEntries('layout-shift', [createLayoutShiftEntry(0.3, 1200, [{ node: child }])]);

    const clsMap = tracker.getMetric('CLS');
    // 0.3 > 0.1 so the max session is 0.3
    expect(clsMap.get('app-a')).toBe(0.3);

    tracker.destroy();
  });

  it('getMetric returns per-app LCP values', () => {
    const child = createScopedElement('app-b');
    const tracker = createWebVitalsTracker();

    emitEntries('largest-contentful-paint', [
      createLcpEntry(500, child),
      createLcpEntry(800, child),
    ]);

    const lcpMap = tracker.getMetric('LCP');
    // LCP takes the last value
    expect(lcpMap.get('app-b')).toBe(800);

    tracker.destroy();
  });

  it('getMetric returns per-app INP values', () => {
    const child = createScopedElement('app-c');
    const tracker = createWebVitalsTracker();

    emitEntries('event', [
      createEventEntry(child, 1, 50),
      createEventEntry(child, 2, 120),
      createEventEntry(child, 1, 80),
    ]);

    const inpMap = tracker.getMetric('INP');
    // interaction 1: max(50, 80) = 80, interaction 2: 120 → worst = 120
    expect(inpMap.get('app-c')).toBe(120);

    tracker.destroy();
  });

  it('summarize aggregates all metrics per app', () => {
    const child = createScopedElement('app-x');
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [createLayoutShiftEntry(0.05, 100, [{ node: child }])]);
    emitEntries('largest-contentful-paint', [createLcpEntry(300, child)]);
    emitEntries('event', [createEventEntry(child, 1, 75)]);

    const summary = tracker.summarize();
    const appSummary = summary.get('app-x');

    expect(appSummary).toStrictEqual({
      cls: 0.05,
      lcp: 300,
      inp: 75,
    });

    tracker.destroy();
  });

  it('summarize fills 0 for apps with no metrics', () => {
    const childA = createScopedElement('app-a');
    const childB = createScopedElement('app-b');
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [createLayoutShiftEntry(0.1, 100, [{ node: childA }])]);
    emitEntries('largest-contentful-paint', [createLcpEntry(200, childB)]);

    const summary = tracker.summarize();

    expect(summary.get('app-a')).toStrictEqual({ cls: 0.1, lcp: 0, inp: 0 });
    expect(summary.get('app-b')).toStrictEqual({ cls: 0, lcp: 200, inp: 0 });

    tracker.destroy();
  });

  it('destroy disconnects the observers', () => {
    const tracker = createWebVitalsTracker();

    tracker.destroy();

    // 3 observers (CLS, LCP, INP) should have called disconnect
    expect(disconnectSpy).toHaveBeenCalledTimes(3);
  });

  it('onVital listener receives metric events', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();
    const listener = vi.fn();

    tracker.onVital(listener);

    emitEntries('layout-shift', [createLayoutShiftEntry(0.1, 100, [{ node: child }])]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: 'app-a',
        metric: 'CLS',
        value: 0.1,
      }),
    );

    tracker.destroy();
  });

  it('is not called after the onVital listener is unsubscribed', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();
    const listener = vi.fn();

    const unsubscribe = tracker.onVital(listener);
    unsubscribe();

    emitEntries('layout-shift', [createLayoutShiftEntry(0.1, 100, [{ node: child }])]);

    expect(listener).not.toHaveBeenCalled();

    tracker.destroy();
  });

  it('INP ignores events with interactionId 0', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();

    emitEntries('event', [createEventEntry(child, 0, 100)]);

    const inpMap = tracker.getMetric('INP');
    expect(inpMap.size).toBe(0);

    tracker.destroy();
  });

  it('can use a custom scopeAttribute', () => {
    const container = document.createElement('div');
    container.setAttribute('data-custom-scope', 'custom-app');
    const child = document.createElement('div');
    container.appendChild(child);
    document.body.appendChild(container);

    const tracker = createWebVitalsTracker({ scopeAttribute: 'data-custom-scope' });

    emitEntries('largest-contentful-paint', [createLcpEntry(400, child)]);

    const lcpMap = tracker.getMetric('LCP');
    expect(lcpMap.get('custom-app')).toBe(400);

    tracker.destroy();
  });
});

/**
 * Creates a mock layout-shift entry.
 * @param value - CLS value
 * @param startTime - start time
 * @param sources - list of shift sources
 * @returns mocked PerformanceEntry
 */
function createLayoutShiftEntry(
  value: number,
  startTime: number,
  sources: ReadonlyArray<{ readonly node: Element | null }>,
): PerformanceEntry {
  return {
    entryType: 'layout-shift',
    name: 'layout-shift',
    startTime,
    duration: 0,
    value,
    sources,
    toJSON: () => ({}),
  } as unknown as PerformanceEntry;
}

/**
 * Creates a mock largest-contentful-paint entry.
 * @param startTime - LCP time
 * @param element - LCP target element
 * @returns mocked PerformanceEntry
 */
function createLcpEntry(startTime: number, element: Element | null): PerformanceEntry {
  return {
    entryType: 'largest-contentful-paint',
    name: 'largest-contentful-paint',
    startTime,
    duration: 0,
    element,
    toJSON: () => ({}),
  } as unknown as PerformanceEntry;
}

/**
 * Creates a mock event entry.
 * @param target - event target element
 * @param interactionId - interaction ID
 * @param duration - event duration
 * @returns mocked PerformanceEntry
 */
function createEventEntry(
  target: Element | null,
  interactionId: number,
  duration: number,
): PerformanceEntry {
  return {
    entryType: 'event',
    name: 'event',
    startTime: 0,
    duration,
    target,
    interactionId,
    toJSON: () => ({}),
  } as unknown as PerformanceEntry;
}
