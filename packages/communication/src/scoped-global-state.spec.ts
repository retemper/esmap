import { describe, it, expect, vi } from 'vitest';
import { createGlobalState } from './global-state.js';
import { createScopedGlobalState } from './scoped-global-state.js';

/** State type for testing */
type TestState = {
  theme: string;
  locale: string;
  user: string | null;
  count: number;
};

/** Creates the default initial state */
function createInitialState(): TestState {
  return { theme: 'dark', locale: 'ko', user: null, count: 0 };
}

describe('createScopedGlobalState', () => {
  describe('getState — exposes only allowed keys', () => {
    it('returns a partial state containing only the allowed keys', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme', 'locale'] as const,
      });

      const state = scoped.getState();

      expect(state).toStrictEqual({ theme: 'dark', locale: 'ko' });
      expect(Object.keys(state)).toStrictEqual(['theme', 'locale']);
    });

    it('reflects parent state changes in the scoped view', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme'] as const,
      });

      global.setState({ theme: 'light' });

      expect(scoped.getState()).toStrictEqual({ theme: 'light' });
    });
  });

  describe('setState — only allowed keys can be modified', () => {
    it('can modify allowed keys', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme', 'locale'] as const,
      });

      scoped.setState({ theme: 'light' });

      expect(global.getState().theme).toBe('light');
      // Other keys are not affected
      expect(global.getState().user).toBeNull();
    });

    it('throws an error when calling setState in readonly mode', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme'] as const,
        readonly: true,
      });

      expect(() => scoped.setState({ theme: 'light' })).toThrow(
        'Cannot modify state in a read-only scope',
      );
    });
  });

  describe('subscribe — subscribes only to allowed key changes', () => {
    it('calls the listener when an allowed key changes', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme', 'locale'] as const,
      });
      const listener = vi.fn();

      scoped.subscribe(listener);
      global.setState({ theme: 'light' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        { theme: 'light', locale: 'ko' },
        { theme: 'dark', locale: 'ko' },
      );
    });

    it('does not call the listener when only non-allowed keys change', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme'] as const,
      });
      const listener = vi.fn();

      scoped.subscribe(listener);
      global.setState({ user: 'Kim' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('unsubscribe works correctly', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme'] as const,
      });
      const listener = vi.fn();

      const unsubscribe = scoped.subscribe(listener);
      unsubscribe();
      global.setState({ theme: 'light' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('isolation guarantee', () => {
    it('different scopes operate independently', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const themeScope = createScopedGlobalState({
        state: global,
        keys: ['theme'] as const,
      });
      const userScope = createScopedGlobalState({
        state: global,
        keys: ['user'] as const,
      });
      const themeListener = vi.fn();
      const userListener = vi.fn();

      themeScope.subscribe(themeListener);
      userScope.subscribe(userListener);

      themeScope.setState({ theme: 'light' });

      expect(themeListener).toHaveBeenCalledTimes(1);
      expect(userListener).not.toHaveBeenCalled();
    });

    it('getState of a readonly scope always reflects the latest state', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const readonlyScope = createScopedGlobalState({
        state: global,
        keys: ['count'] as const,
        readonly: true,
      });

      global.setState({ count: 42 });

      expect(readonlyScope.getState()).toStrictEqual({ count: 42 });
    });
  });

  describe('allowedKeys property', () => {
    it('returns the list of allowed keys', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme', 'locale'] as const,
      });

      expect(scoped.allowedKeys).toStrictEqual(['theme', 'locale']);
    });
  });
});
