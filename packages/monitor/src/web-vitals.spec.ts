/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebVitalsTracker, findAppScope } from './web-vitals.js';
import type { WebVitalsTracker } from './web-vitals.js';

/**
 * PerformanceObserver 모킹을 위한 콜백 저장소.
 * observe() 호출 시 type별로 콜백을 저장하여 테스트에서 엔트리를 수동 주입할 수 있게 한다.
 */
const observerCallbacks = new Map<string, (list: { getEntries: () => PerformanceEntry[] }) => void>();

/** disconnect 호출 추적용 spy */
const disconnectSpy = vi.fn();

/** 원본 PerformanceObserver 참조 */
const OriginalPerformanceObserver = globalThis.PerformanceObserver;

/**
 * 모킹된 PerformanceObserver 클래스.
 * observe() 시 type에 따라 콜백을 저장한다.
 */
class MockPerformanceObserver {
  private readonly callback: (list: { getEntries: () => PerformanceEntry[] }) => void;

  constructor(callback: (list: { getEntries: () => PerformanceEntry[] }) => void) {
    this.callback = callback;
  }

  /** observe 호출 시 type별로 콜백을 등록한다 */
  observe(options: { type: string; buffered?: boolean }): void {
    observerCallbacks.set(options.type, this.callback);
  }

  /** 옵저버를 해제한다 */
  disconnect(): void {
    disconnectSpy();
  }
}

/**
 * 특정 타입의 PerformanceObserver 콜백에 엔트리를 주입한다.
 * @param type - 엔트리 타입 (layout-shift, largest-contentful-paint, event)
 * @param entries - 주입할 엔트리 목록
 */
function emitEntries(type: string, entries: PerformanceEntry[]): void {
  const callback = observerCallbacks.get(type);
  if (callback) {
    callback({ getEntries: () => entries });
  }
}

/**
 * MFE 스코프가 있는 DOM 구조를 생성한다.
 * @param appName - MFE 앱 이름
 * @returns 스코프 컨테이너 내부의 자식 요소
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

  it('가장 가까운 MFE 스코프를 찾는다', () => {
    const child = createScopedElement('checkout-app');

    expect(findAppScope(child, 'data-esmap-scope')).toBe('checkout-app');
  });

  it('MFE 컨테이너 밖이면 null을 반환한다', () => {
    const orphan = document.createElement('div');
    document.body.appendChild(orphan);

    expect(findAppScope(orphan, 'data-esmap-scope')).toBeNull();
  });

  it('element가 null이면 null을 반환한다', () => {
    expect(findAppScope(null, 'data-esmap-scope')).toBeNull();
  });

  it('중첩된 스코프에서 가장 가까운 것을 반환한다', () => {
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

  it('PerformanceObserver가 없는 환경에서 graceful하게 동작한다', () => {
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

  it('getMetric이 앱별 CLS 값을 반환한다', () => {
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

  it('CLS가 MFE 밖이면 __host__로 어트리뷰트한다', () => {
    const orphan = document.createElement('div');
    document.body.appendChild(orphan);
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [
      createLayoutShiftEntry(0.1, 100, [{ node: orphan }]),
    ]);

    const clsMap = tracker.getMetric('CLS');
    expect(clsMap.get('__host__')).toBe(0.1);

    tracker.destroy();
  });

  it('CLS 세션 윈도우가 gap >= 1000ms에서 리셋된다', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [
      createLayoutShiftEntry(0.1, 100, [{ node: child }]),
    ]);
    emitEntries('layout-shift', [
      createLayoutShiftEntry(0.3, 1200, [{ node: child }]),
    ]);

    const clsMap = tracker.getMetric('CLS');
    // 0.3 > 0.1 이므로 최대 세션은 0.3
    expect(clsMap.get('app-a')).toBe(0.3);

    tracker.destroy();
  });

  it('getMetric이 앱별 LCP 값을 반환한다', () => {
    const child = createScopedElement('app-b');
    const tracker = createWebVitalsTracker();

    emitEntries('largest-contentful-paint', [
      createLcpEntry(500, child),
      createLcpEntry(800, child),
    ]);

    const lcpMap = tracker.getMetric('LCP');
    // LCP는 가장 마지막 값
    expect(lcpMap.get('app-b')).toBe(800);

    tracker.destroy();
  });

  it('getMetric이 앱별 INP 값을 반환한다', () => {
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

  it('summarize가 모든 메트릭을 앱별로 요약한다', () => {
    const child = createScopedElement('app-x');
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [
      createLayoutShiftEntry(0.05, 100, [{ node: child }]),
    ]);
    emitEntries('largest-contentful-paint', [
      createLcpEntry(300, child),
    ]);
    emitEntries('event', [
      createEventEntry(child, 1, 75),
    ]);

    const summary = tracker.summarize();
    const appSummary = summary.get('app-x');

    expect(appSummary).toStrictEqual({
      cls: 0.05,
      lcp: 300,
      inp: 75,
    });

    tracker.destroy();
  });

  it('summarize가 메트릭이 없는 앱은 0으로 채운다', () => {
    const childA = createScopedElement('app-a');
    const childB = createScopedElement('app-b');
    const tracker = createWebVitalsTracker();

    emitEntries('layout-shift', [
      createLayoutShiftEntry(0.1, 100, [{ node: childA }]),
    ]);
    emitEntries('largest-contentful-paint', [
      createLcpEntry(200, childB),
    ]);

    const summary = tracker.summarize();

    expect(summary.get('app-a')).toStrictEqual({ cls: 0.1, lcp: 0, inp: 0 });
    expect(summary.get('app-b')).toStrictEqual({ cls: 0, lcp: 200, inp: 0 });

    tracker.destroy();
  });

  it('destroy가 옵저버를 해제한다', () => {
    const tracker = createWebVitalsTracker();

    tracker.destroy();

    // 3개 옵저버(CLS, LCP, INP)가 disconnect 호출됨
    expect(disconnectSpy).toHaveBeenCalledTimes(3);
  });

  it('onVital 리스너가 메트릭 이벤트를 수신한다', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();
    const listener = vi.fn();

    tracker.onVital(listener);

    emitEntries('layout-shift', [
      createLayoutShiftEntry(0.1, 100, [{ node: child }]),
    ]);

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

  it('onVital 리스너 해제 후에는 호출되지 않는다', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();
    const listener = vi.fn();

    const unsubscribe = tracker.onVital(listener);
    unsubscribe();

    emitEntries('layout-shift', [
      createLayoutShiftEntry(0.1, 100, [{ node: child }]),
    ]);

    expect(listener).not.toHaveBeenCalled();

    tracker.destroy();
  });

  it('INP가 interactionId 0인 이벤트를 무시한다', () => {
    const child = createScopedElement('app-a');
    const tracker = createWebVitalsTracker();

    emitEntries('event', [
      createEventEntry(child, 0, 100),
    ]);

    const inpMap = tracker.getMetric('INP');
    expect(inpMap.size).toBe(0);

    tracker.destroy();
  });

  it('커스텀 scopeAttribute를 사용할 수 있다', () => {
    const container = document.createElement('div');
    container.setAttribute('data-custom-scope', 'custom-app');
    const child = document.createElement('div');
    container.appendChild(child);
    document.body.appendChild(container);

    const tracker = createWebVitalsTracker({ scopeAttribute: 'data-custom-scope' });

    emitEntries('largest-contentful-paint', [
      createLcpEntry(400, child),
    ]);

    const lcpMap = tracker.getMetric('LCP');
    expect(lcpMap.get('custom-app')).toBe(400);

    tracker.destroy();
  });
});

/**
 * layout-shift 엔트리를 모킹 생성한다.
 * @param value - CLS 값
 * @param startTime - 시작 시각
 * @param sources - shift source 목록
 * @returns 모킹된 PerformanceEntry
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
 * largest-contentful-paint 엔트리를 모킹 생성한다.
 * @param startTime - LCP 시각
 * @param element - LCP 대상 요소
 * @returns 모킹된 PerformanceEntry
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
 * event 엔트리를 모킹 생성한다.
 * @param target - 이벤트 대상 요소
 * @param interactionId - 인터랙션 ID
 * @param duration - 이벤트 지속 시간
 * @returns 모킹된 PerformanceEntry
 */
function createEventEntry(target: Element | null, interactionId: number, duration: number): PerformanceEntry {
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
