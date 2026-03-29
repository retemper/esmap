import { describe, it, expect, vi } from 'vitest';
import { createGlobalState } from './global-state.js';

describe('createGlobalState', () => {
  it('getState로 초기 상태를 반환한다', () => {
    const state = createGlobalState({ count: 0, name: 'test' });

    expect(state.getState()).toStrictEqual({ count: 0, name: 'test' });
  });

  it('getState가 동결된 객체를 반환한다', () => {
    const state = createGlobalState({ count: 0 });
    const result = state.getState();

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('setState로 부분 상태를 얕은 병합한다', () => {
    const state = createGlobalState({ count: 0, name: 'test' });

    state.setState({ count: 5 });

    expect(state.getState()).toStrictEqual({ count: 5, name: 'test' });
  });

  it('subscribe로 상태 변경을 구독한다', () => {
    const state = createGlobalState({ count: 0 });
    const listener = vi.fn();

    state.subscribe(listener);
    state.setState({ count: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 0 }),
    );
  });

  it('subscribe의 반환값으로 구독을 해제한다', () => {
    const state = createGlobalState({ count: 0 });
    const listener = vi.fn();

    const unsub = state.subscribe(listener);
    state.setState({ count: 1 });
    unsub();
    state.setState({ count: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reset으로 초기 상태로 복원한다', () => {
    const state = createGlobalState({ count: 0, name: 'initial' });

    state.setState({ count: 99, name: 'changed' });
    state.reset();

    expect(state.getState()).toStrictEqual({ count: 0, name: 'initial' });
  });

  it('reset 시 구독자에게 알린다', () => {
    const state = createGlobalState({ count: 0 });
    const listener = vi.fn();

    state.setState({ count: 5 });
    state.subscribe(listener);
    state.reset();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ count: 0 }),
      expect.objectContaining({ count: 5 }),
    );
  });

  it('select로 특정 키의 변경만 구독한다', () => {
    const state = createGlobalState({ count: 0, name: 'test' });
    const listener = vi.fn();

    state.select('count', listener);
    state.setState({ name: 'changed' });

    expect(listener).not.toHaveBeenCalled();

    state.setState({ count: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it('select의 반환값으로 구독을 해제한다', () => {
    const state = createGlobalState({ count: 0 });
    const listener = vi.fn();

    const unsub = state.select('count', listener);
    state.setState({ count: 1 });
    unsub();
    state.setState({ count: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('여러 구독자가 모두 알림을 받는다', () => {
    const state = createGlobalState({ count: 0 });
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    state.subscribe(listener1);
    state.subscribe(listener2);
    state.setState({ count: 1 });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('동일한 값으로 setState하면 구독자에게 알리지 않는다', () => {
    const state = createGlobalState({ count: 0, name: 'test' });
    const listener = vi.fn();

    state.subscribe(listener);
    state.setState({ count: 0 }); // 동일한 값
    state.setState({ name: 'test' }); // 동일한 값

    expect(listener).not.toHaveBeenCalled();
  });

  it('일부 키만 변경되면 구독자에게 알린다', () => {
    const state = createGlobalState({ count: 0, name: 'test' });
    const listener = vi.fn();

    state.subscribe(listener);
    state.setState({ count: 0, name: 'changed' }); // name만 변경

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('NaN과 NaN은 동일하게 취급한다 (Object.is 사용)', () => {
    const state = createGlobalState({ value: NaN });
    const listener = vi.fn();

    state.subscribe(listener);
    state.setState({ value: NaN }); // Object.is(NaN, NaN) === true

    expect(listener).not.toHaveBeenCalled();
  });

  it('getState 반환값을 수정해도 내부 상태에 영향이 없다', () => {
    const state = createGlobalState({ count: 0 });

    expect(() => {
      const snapshot = state.getState();
      // frozen 객체이므로 strict mode에서 에러 발생
      (snapshot as Record<string, unknown>)['count'] = 999;
    }).toThrow();

    expect(state.getState()).toStrictEqual({ count: 0 });
  });
});
