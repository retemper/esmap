/**
 * MFE별 Web Vitals(CLS, LCP, INP) 어트리뷰션을 제공한다.
 * PerformanceObserver를 활용하여 각 메트릭을 발생시킨 MFE 앱을 식별한다.
 */

/** Web Vitals 메트릭 타입 */
type WebVitalMetric = 'CLS' | 'LCP' | 'INP';

/** 앱별 Web Vital 측정 결과 */
interface AppWebVital {
  readonly appName: string;
  readonly metric: WebVitalMetric;
  readonly value: number;
  readonly entries: readonly PerformanceEntry[];
}

/** Web Vitals 리스너 */
type WebVitalListener = (vital: AppWebVital) => void;

/** Web Vitals 추적 핸들 */
interface WebVitalsTracker {
  /** 특정 메트릭의 앱별 값을 반환한다 */
  getMetric(metric: WebVitalMetric): ReadonlyMap<string, number>;
  /** 모든 메트릭을 앱별로 요약한다 */
  summarize(): ReadonlyMap<string, { readonly cls: number; readonly lcp: number; readonly inp: number }>;
  /** 메트릭 이벤트 리스너를 등록한다 */
  onVital(listener: WebVitalListener): () => void;
  /** 추적을 중단하고 옵저버를 해제한다 */
  destroy(): void;
}

/** Web Vitals 추적 옵션 */
interface WebVitalsOptions {
  /** 앱 컨테이너를 식별하는 attribute 이름. 기본값 'data-esmap-scope'. */
  readonly scopeAttribute?: string;
}

/** CLS 세션 윈도우 상태 */
interface ClsSession {
  value: number;
  entries: PerformanceEntry[];
  firstTimestamp: number;
  lastTimestamp: number;
}

/** 앱별 CLS 세션 추적 상태 */
interface ClsState {
  currentSession: ClsSession;
  maxSessionValue: number;
}

/** 앱별 INP 인터랙션 추적 상태 */
interface InpState {
  /** interactionId → 최대 duration */
  interactions: Map<number, number>;
  worstDuration: number;
}

/** layout-shift 엔트리의 source 속성 타입 */
interface LayoutShiftSource {
  readonly node: Element | null;
}

/** CLS 세션 윈도우 최대 갭 (ms) */
const CLS_SESSION_GAP = 1000;

/** CLS 세션 윈도우 최대 길이 (ms) */
const CLS_SESSION_MAX_WINDOW = 5000;

/** 어트리뷰션 실패 시 호스트 앱 이름 */
const HOST_APP_NAME = '__host__';

/**
 * 요소에서 가장 가까운 MFE 스코프 이름을 찾는다.
 * @param element - 탐색 시작 요소
 * @param attr - 스코프를 식별하는 attribute 이름
 * @returns 스코프 이름. 찾지 못하면 null
 */
function findAppScope(element: Element | null, attr: string): string | null {
  if (!element) return null;
  const scoped = element.closest(`[${attr}]`);
  return scoped?.getAttribute(attr) ?? null;
}

/**
 * PerformanceEntry에 layout-shift의 sources 속성이 있는지 확인한다.
 * @param entry - 검사할 엔트리
 * @returns sources 속성 존재 여부
 */
function hasLayoutShiftSources(
  entry: PerformanceEntry,
): entry is PerformanceEntry & { readonly sources: readonly LayoutShiftSource[]; readonly value: number } {
  return 'sources' in entry && 'value' in entry;
}

/**
 * PerformanceEntry에 LCP의 element 속성이 있는지 확인한다.
 * @param entry - 검사할 엔트리
 * @returns element 속성 존재 여부
 */
function hasLcpElement(
  entry: PerformanceEntry,
): entry is PerformanceEntry & { readonly element: Element | null } {
  return 'element' in entry;
}

/**
 * PerformanceEntry에 event의 target과 interactionId 속성이 있는지 확인한다.
 * @param entry - 검사할 엔트리
 * @returns target/interactionId 속성 존재 여부
 */
function hasEventTarget(
  entry: PerformanceEntry,
): entry is PerformanceEntry & { readonly target: Element | null; readonly interactionId: number } {
  return 'target' in entry && 'interactionId' in entry;
}

/**
 * 리스너들에게 메트릭 이벤트를 전달한다.
 * 개별 리스너 에러는 격리된다.
 * @param listeners - 등록된 리스너 목록
 * @param vital - 전달할 메트릭 데이터
 */
function notifyListeners(listeners: readonly WebVitalListener[], vital: AppWebVital): void {
  for (const listener of listeners) {
    try {
      listener(vital);
    } catch {
      // 리스너 에러는 격리 — 다른 리스너 실행을 막지 않는다
    }
  }
}

/**
 * CLS 세션 윈도우를 업데이트하고 최대값을 반환한다.
 * gap >= 1000ms 또는 window >= 5000ms이면 새 세션을 시작한다.
 * @param state - 현재 CLS 상태
 * @param value - 새 layout-shift 값
 * @param timestamp - 엔트리 시작 시각
 * @param entry - layout-shift 엔트리
 * @returns 업데이트된 CLS 최대값
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
    // 새 세션 시작
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
 * 새로운 CLS 상태를 생성한다.
 * @returns 초기 CLS 상태
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
 * 새로운 INP 상태를 생성한다.
 * @returns 초기 INP 상태
 */
function createInpState(): InpState {
  return {
    interactions: new Map(),
    worstDuration: 0,
  };
}

/**
 * Web Vitals 추적기를 생성한다.
 * PerformanceObserver를 사용하여 CLS, LCP, INP 메트릭을 MFE 앱별로 어트리뷰션한다.
 * @param options - 추적 옵션
 * @returns Web Vitals 추적 핸들. PerformanceObserver가 없으면 no-op 핸들을 반환한다.
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
   * layout-shift 엔트리를 처리하여 앱별 CLS를 업데이트한다.
   * @param entries - layout-shift 엔트리 목록
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
   * largest-contentful-paint 엔트리를 처리하여 앱별 LCP를 업데이트한다.
   * @param entries - LCP 엔트리 목록
   */
  const handleLcp = (entries: PerformanceEntryList): void => {
    for (const entry of entries) {
      if (!hasLcpElement(entry)) continue;

      const appName = findAppScope(entry.element, scopeAttribute) ?? HOST_APP_NAME;
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
   * event 엔트리를 처리하여 앱별 INP를 업데이트한다.
   * @param entries - event 엔트리 목록
   */
  const handleEvent = (entries: PerformanceEntryList): void => {
    for (const entry of entries) {
      if (!hasEventTarget(entry)) continue;
      if (entry.interactionId === 0) continue;

      const appName = findAppScope(entry.target, scopeAttribute) ?? HOST_APP_NAME;
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
   * layout-shift sources에서 앱 이름을 추론한다.
   * @param sources - LayoutShiftAttribution 목록
   * @param attr - 스코프 attribute 이름
   * @returns 앱 이름. 식별 불가 시 HOST_APP_NAME
   */
  const resolveAppFromShiftSources = (sources: readonly LayoutShiftSource[], attr: string): string => {
    for (const source of sources) {
      const appName = findAppScope(source.node, attr);
      if (appName) return appName;
    }
    return HOST_APP_NAME;
  };

  const tryObserve = (type: string, callback: (entries: PerformanceEntryList) => void): void => {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      // 지원하지 않는 엔트리 타입은 무시한다
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

    summarize(): ReadonlyMap<string, { readonly cls: number; readonly lcp: number; readonly inp: number }> {
      const appNames = new Set([...clsPerApp.keys(), ...lcpPerApp.keys(), ...inpPerApp.keys()]);
      const result = new Map<string, { readonly cls: number; readonly lcp: number; readonly inp: number }>();

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
 * PerformanceObserver가 없는 환경을 위한 no-op 추적기를 생성한다.
 * @returns 모든 메서드가 빈 결과를 반환하는 추적 핸들
 */
function createNoopTracker(): WebVitalsTracker {
  return {
    getMetric(): ReadonlyMap<string, number> {
      return new Map();
    },
    summarize(): ReadonlyMap<string, { readonly cls: number; readonly lcp: number; readonly inp: number }> {
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
