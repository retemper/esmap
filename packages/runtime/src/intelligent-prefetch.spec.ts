/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { createIntelligentPrefetch } from './intelligent-prefetch.js';

describe('createIntelligentPrefetch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('네비게이션 기록', () => {
    it('네비게이션을 기록하고 historySize가 증가한다', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation(undefined, 'app-home');
      prefetch.recordNavigation('app-home', 'app-settings');

      expect(prefetch.historySize).toBe(2);
    });

    it('maxHistory를 초과하면 오래된 기록이 제거된다', () => {
      const prefetch = createIntelligentPrefetch({ maxHistory: 3 });

      prefetch.recordNavigation(undefined, 'app-a');
      prefetch.recordNavigation('app-a', 'app-b');
      prefetch.recordNavigation('app-b', 'app-c');
      prefetch.recordNavigation('app-c', 'app-d');

      expect(prefetch.historySize).toBe(3);
    });
  });

  describe('전환 확률 계산', () => {
    it('전환 빈도 기반으로 우선순위를 계산한다', () => {
      const prefetch = createIntelligentPrefetch();

      // home → settings 3번, home → dashboard 1번
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-dashboard');

      const priorities = prefetch.getPriorities('app-home');

      expect(priorities).toHaveLength(2);
      expect(priorities[0].appName).toBe('app-settings');
      expect(priorities[0].probability).toBe(0.75);
      expect(priorities[1].appName).toBe('app-dashboard');
      expect(priorities[1].probability).toBe(0.25);
    });

    it('threshold 미만의 확률은 제외된다', () => {
      const prefetch = createIntelligentPrefetch({ threshold: 0.3 });

      // home → settings 3번, home → dashboard 1번 (25% < 30%)
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-dashboard');

      const priorities = prefetch.getPriorities('app-home');

      expect(priorities).toHaveLength(1);
      expect(priorities[0].appName).toBe('app-settings');
    });

    it('maxPrefetch를 초과하는 앱은 잘린다', () => {
      const prefetch = createIntelligentPrefetch({ maxPrefetch: 1 });

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-dashboard');

      const priorities = prefetch.getPriorities('app-home');

      expect(priorities).toHaveLength(1);
    });

    it('기록이 없는 앱에서는 빈 배열을 반환한다', () => {
      const prefetch = createIntelligentPrefetch();

      const priorities = prefetch.getPriorities('app-unknown');

      expect(priorities).toStrictEqual([]);
    });

    it('from이 undefined인 초기 진입은 전환 카운트에 포함되지 않는다', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation(undefined, 'app-home');
      prefetch.recordNavigation(undefined, 'app-settings');

      const stats = prefetch.getStats();
      expect(stats).toHaveLength(0);
    });
  });

  describe('전환 통계', () => {
    it('전체 전환 통계를 반환한다', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-settings', 'app-home');

      const stats = prefetch.getStats();

      expect(stats).toHaveLength(2);
      // count 내림차순 정렬
      expect(stats[0].from).toBe('app-home');
      expect(stats[0].to).toBe('app-settings');
      expect(stats[0].count).toBe(2);
      expect(stats[0].ratio).toBe(1); // home에서의 모든 전환이 settings로
    });
  });

  describe('기록 제한과 카운트 정합성', () => {
    it('maxHistory 초과 시 제거된 기록의 전환 카운트가 차감된다', () => {
      const prefetch = createIntelligentPrefetch({ maxHistory: 5 });

      // 5건: home → settings 5번
      for (const _ of Array.from({ length: 5 })) {
        prefetch.recordNavigation('app-home', 'app-settings');
      }

      expect(prefetch.getStats()[0].count).toBe(5);

      // 6건째: home → dashboard — 가장 오래된 home→settings 1건이 제거
      prefetch.recordNavigation('app-home', 'app-dashboard');

      const stats = prefetch.getStats();
      const settingsCount = stats.find((s) => s.to === 'app-settings')?.count ?? 0;
      const dashboardCount = stats.find((s) => s.to === 'app-dashboard')?.count ?? 0;

      expect(settingsCount).toBe(4);
      expect(dashboardCount).toBe(1);
      expect(prefetch.historySize).toBe(5);
    });

    it('maxHistory 초과로 카운트가 0이 되면 통계에서 사라진다', () => {
      const prefetch = createIntelligentPrefetch({ maxHistory: 3 });

      // A→B 1번, A→C 2번
      prefetch.recordNavigation('A', 'B');
      prefetch.recordNavigation('A', 'C');
      prefetch.recordNavigation('A', 'C');

      // 4번째: A→D — 가장 오래된 A→B 제거
      prefetch.recordNavigation('A', 'D');

      const stats = prefetch.getStats();
      const bStat = stats.find((s) => s.to === 'B');

      expect(bStat).toBeUndefined();
    });
  });

  describe('리셋', () => {
    it('reset으로 모든 학습 데이터를 초기화한다', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');

      prefetch.reset();

      expect(prefetch.historySize).toBe(0);
      expect(prefetch.getStats()).toStrictEqual([]);
      expect(prefetch.getPriorities('app-home')).toStrictEqual([]);
    });
  });

  describe('영속성 (localStorage)', () => {
    it('persist로 localStorage에 저장하고 다시 로드할 수 있다', () => {
      const key = 'esmap-test-prefetch';
      const prefetch1 = createIntelligentPrefetch({ persistKey: key });

      prefetch1.recordNavigation('app-home', 'app-settings');
      prefetch1.recordNavigation('app-home', 'app-settings');
      prefetch1.persist();

      // 새 인스턴스로 로드
      const prefetch2 = createIntelligentPrefetch({ persistKey: key });

      expect(prefetch2.historySize).toBe(2);
      const priorities = prefetch2.getPriorities('app-home');
      expect(priorities).toHaveLength(1);
      expect(priorities[0].appName).toBe('app-settings');
    });

    it('reset으로 localStorage 데이터도 삭제된다', () => {
      const key = 'esmap-test-prefetch-reset';
      const prefetch = createIntelligentPrefetch({ persistKey: key });

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.persist();

      expect(localStorage.getItem(key)).not.toBeNull();

      prefetch.reset();

      expect(localStorage.getItem(key)).toBeNull();
    });

    it('잘못된 localStorage 데이터는 무시한다', () => {
      const key = 'esmap-test-invalid';
      localStorage.setItem(key, 'not-json');

      const prefetch = createIntelligentPrefetch({ persistKey: key });
      expect(prefetch.historySize).toBe(0);
    });

    it('persistKey가 없으면 세션 내에서만 유지한다', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.persist(); // no-op

      expect(prefetch.historySize).toBe(1);
    });
  });
});
