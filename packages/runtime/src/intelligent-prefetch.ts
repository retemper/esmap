/**
 * 지능형 프리페치 시스템.
 * 사용자 네비게이션 패턴을 학습하여 다음에 방문할 가능성이 높은 앱을 우선 프리페치한다.
 * Garfish(ByteDance)의 intelligent preloading 패턴에서 영감을 받았다.
 *
 * 동작 원리:
 * 1. 사용자의 페이지 전환(from → to)을 기록한다
 * 2. 각 앱에서 다음 앱으로의 전환 빈도를 집계한다
 * 3. 현재 앱에서 가장 자주 이동하는 앱을 우선 프리페치한다
 */

import { isRecord } from '@esmap/shared';

/** 네비게이션 전환 기록의 단일 항목 */
export interface NavigationRecord {
  /** 출발 앱 이름 (없으면 초기 진입) */
  readonly from: string | undefined;
  /** 도착 앱 이름 */
  readonly to: string;
  /** 전환 시각 (ms timestamp) */
  readonly timestamp: number;
}

/** 전환 빈도 통계 */
export interface TransitionStats {
  /** 출발 앱 이름 */
  readonly from: string;
  /** 도착 앱 이름 */
  readonly to: string;
  /** 전환 횟수 */
  readonly count: number;
  /** 전체 전환 중 비율 (0~1) */
  readonly ratio: number;
}

/** 프리페치 우선순위 정보 */
export interface PrefetchPriority {
  /** 앱 이름 */
  readonly appName: string;
  /** 방문 확률 (0~1). 전환 빈도 기반. */
  readonly probability: number;
}

/** 지능형 프리페치 옵션 */
export interface IntelligentPrefetchOptions {
  /**
   * 기록할 최대 네비게이션 수. 오래된 기록은 자동 삭제된다.
   * 기본값 200.
   */
  readonly maxHistory?: number;
  /**
   * 프리페치 트리거 확률 임계값 (0~1).
   * 이 값 이상의 전환 확률을 가진 앱만 프리페치한다.
   * 기본값 0.1 (10%).
   */
  readonly threshold?: number;
  /**
   * 프리페치할 최대 앱 수.
   * 기본값 3.
   */
  readonly maxPrefetch?: number;
  /**
   * localStorage 키. 브라우저 세션 간 학습 데이터를 유지한다.
   * undefined면 세션 내에서만 유지한다.
   */
  readonly persistKey?: string;
}

/** 지능형 프리페치 컨트롤러 */
export interface IntelligentPrefetchController {
  /** 네비게이션 전환을 기록한다. */
  recordNavigation(from: string | undefined, to: string): void;
  /** 현재 앱 기준으로 프리페치 우선순위를 계산한다. */
  getPriorities(currentApp: string): readonly PrefetchPriority[];
  /** 전체 전환 통계를 반환한다. */
  getStats(): readonly TransitionStats[];
  /** 기록된 네비게이션 수를 반환한다. */
  readonly historySize: number;
  /** 학습 데이터를 초기화한다. */
  reset(): void;
  /** 학습 데이터를 localStorage에 저장한다 (persistKey가 설정된 경우). */
  persist(): void;
}

/** 기본 최대 기록 수 */
const DEFAULT_MAX_HISTORY = 200;

/** 기본 프리페치 임계값 */
const DEFAULT_THRESHOLD = 0.1;

/** 기본 최대 프리페치 앱 수 */
const DEFAULT_MAX_PREFETCH = 3;

/**
 * 지능형 프리페치 컨트롤러를 생성한다.
 * 네비게이션 패턴을 학습하여 다음 방문 앱을 예측한다.
 *
 * @param options - 지능형 프리페치 옵션
 * @returns IntelligentPrefetchController 인스턴스
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

  /** 네비게이션 기록 */
  const history: NavigationRecord[] = loadPersistedHistory(persistKey);

  /** 전환 빈도 맵: "from→to" → count */
  const transitionCounts = new Map<string, number>();
  /** 출발별 전체 전환 횟수: "from" → totalCount */
  const fromTotals = new Map<string, number>();

  /** 기존 기록에서 전환 카운트를 재구성한다 */
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

      // 최대 기록 수 초과 시 오래된 기록의 카운트를 차감 후 제거
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

      // 확률 내림차순 정렬 후 maxPrefetch만큼 자르기
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
          /* localStorage 접근 불가 시 무시 */
        }
      }
    },

    persist(): void {
      if (!persistKey) return;

      try {
        localStorage.setItem(persistKey, JSON.stringify(history));
      } catch {
        /* localStorage 접근 불가 시 무시 */
      }
    },
  };
}

/**
 * 제거된 기록의 전환 카운트를 차감한다. 0 이하가 되면 맵에서 삭제한다.
 * @param counts - 전환 빈도 맵
 * @param totals - 출발별 전체 전환 횟수 맵
 * @param from - 출발 앱
 * @param to - 도착 앱
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

/** localStorage에서 저장된 네비게이션 기록을 불러온다 */
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

/** 값이 유효한 NavigationRecord인지 확인한다 */
function isNavigationRecord(value: unknown): value is NavigationRecord {
  if (!isRecord(value)) return false;
  return typeof value.to === 'string' && typeof value.timestamp === 'number';
}
