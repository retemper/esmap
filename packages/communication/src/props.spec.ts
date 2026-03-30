import { describe, it, expect, vi } from 'vitest';
import { createAppProps } from './props.js';

describe('createAppProps', () => {
  it('returns initial properties with getProps', () => {
    const props = createAppProps({ theme: 'light', locale: 'ko' });

    expect(props.getProps()).toStrictEqual({ theme: 'light', locale: 'ko' });
  });

  it('returns a frozen object from getProps', () => {
    const props = createAppProps({ theme: 'light' });
    const result = props.getProps();

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('merges partial properties with setProps', () => {
    const props = createAppProps({ theme: 'light', locale: 'ko' });

    props.setProps({ theme: 'dark' });

    expect(props.getProps()).toStrictEqual({ theme: 'dark', locale: 'ko' });
  });

  it('subscribes to changes with onPropsChange', () => {
    const props = createAppProps({ theme: 'light' });
    const listener = vi.fn();

    props.onPropsChange(listener);
    props.setProps({ theme: 'dark' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'dark' }),
      expect.objectContaining({ theme: 'light' }),
    );
  });

  it('unsubscribes using the return value of onPropsChange', () => {
    const props = createAppProps({ theme: 'light' });
    const listener = vi.fn();

    const unsub = props.onPropsChange(listener);
    props.setProps({ theme: 'dark' });
    unsub();
    props.setProps({ theme: 'light' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies all subscribers', () => {
    const props = createAppProps({ theme: 'light' });
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    props.onPropsChange(listener1);
    props.onPropsChange(listener2);
    props.setProps({ theme: 'dark' });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('modifying getProps return value does not affect internal state', () => {
    const props = createAppProps({ theme: 'light' });

    expect(() => {
      const snapshot = props.getProps();
      (snapshot as Record<string, unknown>)['theme'] = 'hacked';
    }).toThrow();

    expect(props.getProps()).toStrictEqual({ theme: 'light' });
  });

  it('notifies subscribers for each consecutive setProps call', () => {
    const props = createAppProps({ count: 0 });
    const listener = vi.fn();

    props.onPropsChange(listener);
    props.setProps({ count: 1 });
    props.setProps({ count: 2 });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 0 }),
    );
    expect(listener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ count: 2 }),
      expect.objectContaining({ count: 1 }),
    );
  });
});
