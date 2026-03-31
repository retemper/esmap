import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './event-bus.js';
import { createScopedEventBus } from './scoped-event-bus.js';

describe('createScopedEventBus', () => {
  it('automatically adds scope prefix on emit', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'checkout');
    const handler = vi.fn();

    bus.on('checkout:loaded', handler);
    scoped.emit('loaded', { ready: true });

    expect(handler).toHaveBeenCalledWith({ ready: true });
  });

  it('subscribes to scoped events with on', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'nav');
    const handler = vi.fn();

    scoped.on('click', handler);
    bus.emit('nav:click', { target: 'home' });

    expect(handler).toHaveBeenCalledWith({ target: 'home' });
  });

  it('does not receive events from a different scope', () => {
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

  it('subscribes to a scoped event only once with once', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'app');
    const handler = vi.fn();

    scoped.once('init', handler);
    scoped.emit('init', 'first');
    scoped.emit('init', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('removes listeners for a scoped event with off', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'app');
    const handler = vi.fn();

    scoped.on('test', handler);
    scoped.off('test');
    scoped.emit('test', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('getHistory returns only events belonging to the scope', () => {
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

  it('getHistory filters by scope + event when an event name is provided', () => {
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

  it('scope property returns the namespace', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'checkout');

    expect(scoped.scope).toBe('checkout');
  });

  it('unsubscribe function works correctly', () => {
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

  it('replay option works with scoped events', () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'app');

    scoped.emit('data', { id: 1 });
    scoped.emit('data', { id: 2 });

    const handler = vi.fn();
    scoped.on('data', handler, { replay: true });

    // 2 history entries replayed upon subscription
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { id: 2 });
  });

  it('subscribes to wildcard patterns within the scope using onAny', () => {
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

  it('onAny does not receive events matching the same pattern from a different scope', () => {
    const bus = createEventBus();
    const scopedA = createScopedEventBus(bus, 'a');
    const scopedB = createScopedEventBus(bus, 'b');
    const handler = vi.fn();

    scopedA.onAny('item:*', handler);
    scopedB.emit('item:added', { from: 'b' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('performs Request-Response within the scope using request', async () => {
    const bus = createEventBus();
    const scoped = createScopedEventBus(bus, 'user');

    // Register responder within the scope
    scoped.on('getProfile', (userId) => {
      // Response is delivered via the parent bus's 'user:getProfile:response'
      bus.emit('user:getProfile:response', { name: 'Kim', id: userId });
    });

    const result = await scoped.request('getProfile', 'user-123');

    expect(result).toStrictEqual({ name: 'Kim', id: 'user-123' });
  });

  it('request timeout works within the scope', async () => {
    const bus = createEventBus({ defaultRequestTimeout: 50 });
    const scoped = createScopedEventBus(bus, 'service');

    await expect(scoped.request('noResponder', 'data', 50)).rejects.toThrow('timed out');
  });
});
