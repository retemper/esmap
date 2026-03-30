import { describe, it, expect, vi } from 'vitest';
import { createGlobalState } from './global-state.js';

describe('createGlobalState', () => {
  it('returns the initial state with getState', () => {
    const state = createGlobalState({ count: 0, name: 'test' });

    expect(state.getState()).toStrictEqual({ count: 0, name: 'test' });
  });

  it('returns a frozen object from getState', () => {
    const state = createGlobalState({ count: 0 });
    const result = state.getState();

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('shallow merges partial state with setState', () => {
    const state = createGlobalState({ count: 0, name: 'test' });

    state.setState({ count: 5 });

    expect(state.getState()).toStrictEqual({ count: 5, name: 'test' });
  });

  it('subscribes to state changes with subscribe', () => {
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

  it('unsubscribes using the return value of subscribe', () => {
    const state = createGlobalState({ count: 0 });
    const listener = vi.fn();

    const unsub = state.subscribe(listener);
    state.setState({ count: 1 });
    unsub();
    state.setState({ count: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('restores to initial state with reset', () => {
    const state = createGlobalState({ count: 0, name: 'initial' });

    state.setState({ count: 99, name: 'changed' });
    state.reset();

    expect(state.getState()).toStrictEqual({ count: 0, name: 'initial' });
  });

  it('notifies subscribers on reset', () => {
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

  it('subscribes to changes of a specific key with select', () => {
    const state = createGlobalState({ count: 0, name: 'test' });
    const listener = vi.fn();

    state.select('count', listener);
    state.setState({ name: 'changed' });

    expect(listener).not.toHaveBeenCalled();

    state.setState({ count: 1 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it('unsubscribes using the return value of select', () => {
    const state = createGlobalState({ count: 0 });
    const listener = vi.fn();

    const unsub = state.select('count', listener);
    state.setState({ count: 1 });
    unsub();
    state.setState({ count: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies all subscribers', () => {
    const state = createGlobalState({ count: 0 });
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    state.subscribe(listener1);
    state.subscribe(listener2);
    state.setState({ count: 1 });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('does not notify subscribers when setState is called with the same value', () => {
    const state = createGlobalState({ count: 0, name: 'test' });
    const listener = vi.fn();

    state.subscribe(listener);
    state.setState({ count: 0 }); // same value
    state.setState({ name: 'test' }); // same value

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies subscribers when only some keys change', () => {
    const state = createGlobalState({ count: 0, name: 'test' });
    const listener = vi.fn();

    state.subscribe(listener);
    state.setState({ count: 0, name: 'changed' }); // only name changed

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('treats NaN as equal to NaN (using Object.is)', () => {
    const state = createGlobalState({ value: NaN });
    const listener = vi.fn();

    state.subscribe(listener);
    state.setState({ value: NaN }); // Object.is(NaN, NaN) === true

    expect(listener).not.toHaveBeenCalled();
  });

  it('modifying getState return value does not affect internal state', () => {
    const state = createGlobalState({ count: 0 });

    expect(() => {
      const snapshot = state.getState();
      // Throws in strict mode because the object is frozen
      (snapshot as Record<string, unknown>)['count'] = 999;
    }).toThrow();

    expect(state.getState()).toStrictEqual({ count: 0 });
  });
});
