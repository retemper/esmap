import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './event-bus.js';
import { createScopedEventBus } from './scoped-event-bus.js';

describe('createScopedEventBus', () => {
  it('emit 시 스코프 prefix가 자동으로 붙는다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'checkout');
    const handler = vi.fn();

    bus.on('checkout:loaded', handler);
    scoped.emit('loaded', { ready: true });

    expect(handler).toHaveBeenCalledWith({ ready: true });
  });

  it('on으로 스코프된 이벤트를 구독한다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'nav');
    const handler = vi.fn();

    scoped.on('click', handler);
    bus.emit('nav:click', { target: 'home' });

    expect(handler).toHaveBeenCalledWith({ target: 'home' });
  });

  it('다른 스코프의 이벤트는 수신하지 않는다', () => {
    const bus = createEventBus();
    const checkoutBus = createScopedEventBus(bus, 'checkout');
    const navBus = createScopedEventBus(bus, 'nav');
    const checkoutHandler = vi.fn();
    const navHandler = vi.fn();

    checkoutBus.on('update', checkoutHandler);
    navBus.on('update', navHandler);

    checkoutBus.emit('update', { items: 3 });

    expect(checkoutHandler).toHaveBeenCalledWith({ items: 3 });
    expect(navHandler).not.toHaveBeenCalled();
  });

  it('once로 스코프된 이벤트를 한 번만 구독한다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'app');
    const handler = vi.fn();

    scoped.once('init', handler);
    scoped.emit('init', 'first');
    scoped.emit('init', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('off로 스코프된 이벤트의 리스너를 제거한다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'app');
    const handler = vi.fn();

    scoped.on('test', handler);
    scoped.off('test');
    scoped.emit('test', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('getHistory가 스코프에 해당하는 이벤트만 반환한다', () => {
    const bus = createEventBus();
    const scopedA = createScopedEventBus(bus, 'a');
    const scopedB = createScopedEventBus(bus, 'b');

    scopedA.emit('event1', 1);
    scopedB.emit('event2', 2);
    scopedA.emit('event3', 3);

    const historyA = scopedA.getHistory();
    expect(historyA).toHaveLength(2);
    expect(historyA[0].event).toBe('a:event1');
    expect(historyA[1].event).toBe('a:event3');
  });

  it('getHistory에 이벤트 이름을 전달하면 스코프 + 이벤트로 필터한다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'app');

    scoped.emit('load', 1);
    scoped.emit('mount', 2);
    scoped.emit('load', 3);

    const loadHistory = scoped.getHistory('load');
    expect(loadHistory).toHaveLength(2);
    expect(loadHistory[0].payload).toBe(1);
    expect(loadHistory[1].payload).toBe(3);
  });

  it('scope 프로퍼티가 네임스페이스를 반환한다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'checkout');

    expect(scoped.scope).toBe('checkout');
  });

  it('구독 해제 함수가 정상 동작한다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'app');
    const handler = vi.fn();

    const unsub = scoped.on('test', handler);
    scoped.emit('test', 'before');
    unsub();
    scoped.emit('test', 'after');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('before');
  });

  it('replay 옵션이 스코프된 이벤트에서도 동작한다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'app');

    scoped.emit('data', { id: 1 });
    scoped.emit('data', { id: 2 });

    const handler = vi.fn();
    scoped.on('data', handler, { replay: true });

    // 이력 2건이 재생된 후 구독 상태
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { id: 2 });
  });

  it('onAny로 스코프 내 와일드카드 패턴을 구독한다', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'checkout');
    const handler = vi.fn();

    scoped.onAny('item:*', handler);
    scoped.emit('item:added', { id: 1 });
    scoped.emit('item:removed', { id: 2 });
    scoped.emit('cart:updated', { total: 100 });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { id: 2 });
  });

  it('onAny가 다른 스코프의 같은 패턴 이벤트를 수신하지 않는다', () => {
    const bus = createEventBus();
    const scopedA = createScopedEventBus(bus, 'a');
    const scopedB = createScopedEventBus(bus, 'b');
    const handler = vi.fn();

    scopedA.onAny('item:*', handler);
    scopedB.emit('item:added', { from: 'b' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('request로 스코프 내 Request-Response를 수행한다', async () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'user');

    // 스코프 내 응답자 등록
    scoped.on('getProfile', (userId) => {
      // 응답은 상위 버스의 'user:getProfile:response'로 전달됨
      bus.emit('user:getProfile:response', { name: 'Kim', id: userId });
    });

    const result = await scoped.request('getProfile', 'user-123');

    expect(result).toStrictEqual({ name: 'Kim', id: 'user-123' });
  });

  it('request 타임아웃이 스코프에서도 동작한다', async () => {
    const bus = createEventBus({ defaultRequestTimeout: 50 });
    const scoped = createScopedEventBus(bus, 'service');

    await expect(scoped.request('noResponder', 'data', 50)).rejects.toThrow('타임아웃');
  });
});
