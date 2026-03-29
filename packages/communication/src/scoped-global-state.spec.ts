import { describe, it, expect, vi } from 'vitest';
import { createGlobalState } from './global-state.js';
import { createScopedGlobalState } from './scoped-global-state.js';

/** 테스트용 상태 타입 */
interface TestState {
  theme: string;
  locale: string;
  user: string | null;
  count: number;
}

/** 기본 초기 상태를 생성한다 */
function createInitialState(): TestState {
  return { theme: 'dark', locale: 'ko', user: null, count: 0 };
}

describe('createScopedGlobalState', () => {
  describe('getState — 허용된 키만 노출', () => {
    it('허용된 키만 포함하는 부분 상태를 반환한다', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme', 'locale'] as const,
      });

      const state = scoped.getState();

      expect(state).toStrictEqual({ theme: 'dark', locale: 'ko' });
      expect(Object.keys(state)).toStrictEqual(['theme', 'locale']);
    });

    it('상위 상태 변경이 스코프 뷰에 반영된다', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme'] as const,
      });

      global.setState({ theme: 'light' });

      expect(scoped.getState()).toStrictEqual({ theme: 'light' });
    });
  });

  describe('setState — 허용된 키만 수정 가능', () => {
    it('허용된 키를 수정할 수 있다', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme', 'locale'] as const,
      });

      scoped.setState({ theme: 'light' });

      expect(global.getState().theme).toBe('light');
      // 다른 키는 영향받지 않음
      expect(global.getState().user).toBeNull();
    });

    it('readonly 모드에서 setState를 호출하면 에러가 발생한다', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme'] as const,
        readonly: true,
      });

      expect(() => scoped.setState({ theme: 'light' })).toThrow(
        '읽기 전용 스코프에서는 상태를 변경할 수 없습니다',
      );
    });
  });

  describe('subscribe — 허용된 키 변경만 구독', () => {
    it('허용된 키가 변경되면 리스너가 호출된다', () => {
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

    it('허용되지 않은 키만 변경되면 리스너가 호출되지 않는다', () => {
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

    it('구독 해제가 동작한다', () => {
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

  describe('격리 보장', () => {
    it('서로 다른 스코프가 독립적으로 동작한다', () => {
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

    it('readonly 스코프의 getState는 항상 최신 상태를 반영한다', () => {
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

  describe('allowedKeys 속성', () => {
    it('허용된 키 목록을 반환한다', () => {
      const global = createGlobalState<TestState>(createInitialState());
      const scoped = createScopedGlobalState({
        state: global,
        keys: ['theme', 'locale'] as const,
      });

      expect(scoped.allowedKeys).toStrictEqual(['theme', 'locale']);
    });
  });
});
