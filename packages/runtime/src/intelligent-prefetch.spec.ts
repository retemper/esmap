/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { createIntelligentPrefetch } from './intelligent-prefetch.js';

describe('createIntelligentPrefetch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('navigation recording', () => {
    it('records navigation and historySize increases', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation(undefined, 'app-home');
      prefetch.recordNavigation('app-home', 'app-settings');

      expect(prefetch.historySize).toBe(2);
    });

    it('removes old records when maxHistory is exceeded', () => {
      const prefetch = createIntelligentPrefetch({ maxHistory: 3 });

      prefetch.recordNavigation(undefined, 'app-a');
      prefetch.recordNavigation('app-a', 'app-b');
      prefetch.recordNavigation('app-b', 'app-c');
      prefetch.recordNavigation('app-c', 'app-d');

      expect(prefetch.historySize).toBe(3);
    });
  });

  describe('transition probability calculation', () => {
    it('calculates priorities based on transition frequency', () => {
      const prefetch = createIntelligentPrefetch();

      // home -> settings 3 times, home -> dashboard 1 time
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

    it('excludes probabilities below the threshold', () => {
      const prefetch = createIntelligentPrefetch({ threshold: 0.3 });

      // home -> settings 3 times, home -> dashboard 1 time (25% < 30%)
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-dashboard');

      const priorities = prefetch.getPriorities('app-home');

      expect(priorities).toHaveLength(1);
      expect(priorities[0].appName).toBe('app-settings');
    });

    it('truncates apps exceeding maxPrefetch', () => {
      const prefetch = createIntelligentPrefetch({ maxPrefetch: 1 });

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-dashboard');

      const priorities = prefetch.getPriorities('app-home');

      expect(priorities).toHaveLength(1);
    });

    it('returns an empty array for apps with no history', () => {
      const prefetch = createIntelligentPrefetch();

      const priorities = prefetch.getPriorities('app-unknown');

      expect(priorities).toStrictEqual([]);
    });

    it('does not include initial entries with undefined from in transition counts', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation(undefined, 'app-home');
      prefetch.recordNavigation(undefined, 'app-settings');

      const stats = prefetch.getStats();
      expect(stats).toHaveLength(0);
    });
  });

  describe('transition statistics', () => {
    it('returns overall transition statistics', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-settings', 'app-home');

      const stats = prefetch.getStats();

      expect(stats).toHaveLength(2);
      // Sorted by count descending
      expect(stats[0].from).toBe('app-home');
      expect(stats[0].to).toBe('app-settings');
      expect(stats[0].count).toBe(2);
      expect(stats[0].ratio).toBe(1); // All transitions from home go to settings
    });
  });

  describe('history limit and count consistency', () => {
    it('decrements transition counts for evicted records when maxHistory is exceeded', () => {
      const prefetch = createIntelligentPrefetch({ maxHistory: 5 });

      // 5 records: home -> settings 5 times
      for (const _ of Array.from({ length: 5 })) {
        prefetch.recordNavigation('app-home', 'app-settings');
      }

      expect(prefetch.getStats()[0].count).toBe(5);

      // 6th record: home -> dashboard — the oldest home->settings record is evicted
      prefetch.recordNavigation('app-home', 'app-dashboard');

      const stats = prefetch.getStats();
      const settingsCount = stats.find((s) => s.to === 'app-settings')?.count ?? 0;
      const dashboardCount = stats.find((s) => s.to === 'app-dashboard')?.count ?? 0;

      expect(settingsCount).toBe(4);
      expect(dashboardCount).toBe(1);
      expect(prefetch.historySize).toBe(5);
    });

    it('removes stats entry when count reaches 0 due to maxHistory eviction', () => {
      const prefetch = createIntelligentPrefetch({ maxHistory: 3 });

      // A->B 1 time, A->C 2 times
      prefetch.recordNavigation('A', 'B');
      prefetch.recordNavigation('A', 'C');
      prefetch.recordNavigation('A', 'C');

      // 4th record: A->D — the oldest A->B record is evicted
      prefetch.recordNavigation('A', 'D');

      const stats = prefetch.getStats();
      const bStat = stats.find((s) => s.to === 'B');

      expect(bStat).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('resets all learned data with reset', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.recordNavigation('app-home', 'app-settings');

      prefetch.reset();

      expect(prefetch.historySize).toBe(0);
      expect(prefetch.getStats()).toStrictEqual([]);
      expect(prefetch.getPriorities('app-home')).toStrictEqual([]);
    });
  });

  describe('persistence (localStorage)', () => {
    it('saves to localStorage with persist and loads back', () => {
      const key = 'esmap-test-prefetch';
      const prefetch1 = createIntelligentPrefetch({ persistKey: key });

      prefetch1.recordNavigation('app-home', 'app-settings');
      prefetch1.recordNavigation('app-home', 'app-settings');
      prefetch1.persist();

      // Load with a new instance
      const prefetch2 = createIntelligentPrefetch({ persistKey: key });

      expect(prefetch2.historySize).toBe(2);
      const priorities = prefetch2.getPriorities('app-home');
      expect(priorities).toHaveLength(1);
      expect(priorities[0].appName).toBe('app-settings');
    });

    it('deletes localStorage data on reset', () => {
      const key = 'esmap-test-prefetch-reset';
      const prefetch = createIntelligentPrefetch({ persistKey: key });

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.persist();

      expect(localStorage.getItem(key)).not.toBeNull();

      prefetch.reset();

      expect(localStorage.getItem(key)).toBeNull();
    });

    it('ignores invalid localStorage data', () => {
      const key = 'esmap-test-invalid';
      localStorage.setItem(key, 'not-json');

      const prefetch = createIntelligentPrefetch({ persistKey: key });
      expect(prefetch.historySize).toBe(0);
    });

    it('only persists within the session when persistKey is not set', () => {
      const prefetch = createIntelligentPrefetch();

      prefetch.recordNavigation('app-home', 'app-settings');
      prefetch.persist(); // no-op

      expect(prefetch.historySize).toBe(1);
    });
  });
});
