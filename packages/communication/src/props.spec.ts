import { describe, it, expect, vi } from 'vitest';
import { createAppProps } from './props.js';

describe('createAppProps', () => {
  it('getProps로 초기 프로퍼티를 반환한다', () => {
    const props = createAppProps({ theme: 'light', locale: 'ko' });

    expect(props.getProps()).toStrictEqual({ theme: 'light', locale: 'ko' });
  });

  it('getProps가 동결된 객체를 반환한다', () => {
    const props = createAppProps({ theme: 'light' });
    const result = props.getProps();

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('setProps로 부분 프로퍼티를 병합한다', () => {
    const props = createAppProps({ theme: 'light', locale: 'ko' });

    props.setProps({ theme: 'dark' });

    expect(props.getProps()).toStrictEqual({ theme: 'dark', locale: 'ko' });
  });

  it('onPropsChange로 변경을 구독한다', () => {
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

  it('onPropsChange의 반환값으로 구독을 해제한다', () => {
    const props = createAppProps({ theme: 'light' });
    const listener = vi.fn();

    const unsub = props.onPropsChange(listener);
    props.setProps({ theme: 'dark' });
    unsub();
    props.setProps({ theme: 'light' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('여러 구독자가 모두 알림을 받는다', () => {
    const props = createAppProps({ theme: 'light' });
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    props.onPropsChange(listener1);
    props.onPropsChange(listener2);
    props.setProps({ theme: 'dark' });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('getProps 반환값을 수정해도 내부 상태에 영향이 없다', () => {
    const props = createAppProps({ theme: 'light' });

    expect(() => {
      const snapshot = props.getProps();
      (snapshot as Record<string, unknown>)['theme'] = 'hacked';
    }).toThrow();

    expect(props.getProps()).toStrictEqual({ theme: 'light' });
  });

  it('setProps를 연속 호출하면 각각 구독자에게 알린다', () => {
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
