import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './event-bus.js';

describe('createEventBus', () => {
  it('emits and receives events with basic emit/on behavior', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('test', handler);
    bus.emit('test', { value: 42 });

    expect(handler).toHaveBeenCalledWith({ value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('once is called only once', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.once('test', handler);
    bus.emit('test', 'first');
    bus.emit('test', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('unsubscribes using the unsubscribe function', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const unsub = bus.on('test', handler);
    bus.emit('test', 'before');
    unsub();
    bus.emit('test', 'after');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('before');
  });

  it('removes all listeners for a specific event with off', () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('test', handler1);
    bus.on('test', handler2);
    bus.off('test');
    bus.emit('test', 'data');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('removes all listeners with clear', () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('event-a', handler1);
    bus.on('event-b', handler2);
    bus.clear();
    bus.emit('event-a', 'data');
    bus.emit('event-b', 'data');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('retrieves event history with getHistory', () => {
    const bus = createEventBus();

    bus.emit('a', 1);
    bus.emit('b', 2);

    const history = bus.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toStrictEqual(expect.objectContaining({ event: 'a', payload: 1 }));
    expect(history[1]).toStrictEqual(expect.objectContaining({ event: 'b', payload: 2 }));
  });

  it('deletes old history entries when maxHistory is exceeded', () => {
    const bus = createEventBus({ maxHistory: 3 });

    bus.emit('e', 1);
    bus.emit('e', 2);
    bus.emit('e', 3);
    bus.emit('e', 4);

    const history = bus.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0]).toStrictEqual(expect.objectContaining({ payload: 2 }));
    expect(history[2]).toStrictEqual(expect.objectContaining({ payload: 4 }));
  });

  it('returns the correct count from listenerCount', () => {
    const bus = createEventBus();

    expect(bus.listenerCount('test')).toBe(0);

    const unsub1 = bus.on('test', vi.fn());
    bus.on('test', vi.fn());
    expect(bus.listenerCount('test')).toBe(2);

    unsub1();
    expect(bus.listenerCount('test')).toBe(1);
  });

  it('does not throw when emitting with no listeners', () => {
    const bus = createEventBus();

    expect(() => bus.emit('nonexistent', 'data')).not.toThrow();
  });

  it('can emit without a payload', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('ping', handler);
    bus.emit('ping');

    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('calls multiple listeners in registration order', () => {
    const bus = createEventBus();
    const callOrder: Array<number> = [];

    bus.on('test', () => callOrder.push(1));
    bus.on('test', () => callOrder.push(2));
    bus.on('test', () => callOrder.push(3));
    bus.emit('test', 'data');

    expect(callOrder).toStrictEqual([1, 2, 3]);
  });

  it('filters by event when passing an event argument to getHistory', () => {
    const bus = createEventBus();

    bus.emit('a', 1);
    bus.emit('b', 2);
    bus.emit('a', 3);

    const filtered = bus.getHistory('a');
    expect(filtered).toHaveLength(2);
    expect(filtered[0]).toStrictEqual(expect.objectContaining({ event: 'a', payload: 1 }));
    expect(filtered[1]).toStrictEqual(expect.objectContaining({ event: 'a', payload: 3 }));
  });

  it('does not call handler if once unsubscribe is called before emit', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const unsub = bus.once('test', handler);
    unsub();
    bus.emit('test', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  describe('handler error isolation', () => {
    it('other handlers still execute even when a handler throws', () => {
      const bus = createEventBus();
      const handler1 = vi.fn(() => {
        throw new Error('handler error');
      });
      const handler2 = vi.fn();

      bus.on('test', handler1);
      bus.on('test', handler2);
      bus.emit('test', 'data');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('passes error information to onHandlerError callback', () => {
      const onHandlerError = vi.fn();
      const bus = createEventBus({ onHandlerError });
      const error = new Error('handler error');

      bus.on('test', () => {
        throw error;
      });
      bus.emit('test', 'data');

      expect(onHandlerError).toHaveBeenCalledWith('test', error);
    });

    it('reports all errors even when multiple handlers throw', () => {
      const onHandlerError = vi.fn();
      const bus = createEventBus({ onHandlerError });

      bus.on('test', () => {
        throw new Error('error1');
      });
      bus.on('test', () => {
        throw new Error('error2');
      });
      bus.emit('test', 'data');

      expect(onHandlerError).toHaveBeenCalledTimes(2);
    });
  });

  describe('wildcard subscription (onAny)', () => {
    it('receives all events matching the pattern', () => {
      const bus = createEventBus();
      const handler = vi.fn();

      bus.onAny('app:*', handler);
      bus.emit('app:loaded', { name: 'checkout' });
      bus.emit('app:mounted', { name: 'nav' });
      bus.emit('user:login', { id: '1' });

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { name: 'checkout' });
      expect(handler).toHaveBeenNthCalledWith(2, { name: 'nav' });
    });

    it('removes wildcard listeners with the unsubscribe function', () => {
      const bus = createEventBus();
      const handler = vi.fn();

      const unsub = bus.onAny('app:*', handler);
      bus.emit('app:loaded', 'before');
      unsub();
      bus.emit('app:mounted', 'after');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('clear() also removes wildcard listeners', () => {
      const bus = createEventBus();
      const handler = vi.fn();

      bus.onAny('app:*', handler);
      bus.clear();
      bus.emit('app:loaded', 'data');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('event history replay', () => {
    it('replays previous history when subscribing with replay option', () => {
      const bus = createEventBus();

      bus.emit('data', { id: 1 });
      bus.emit('data', { id: 2 });

      const handler = vi.fn();
      bus.on('data', handler, { replay: true });

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(handler).toHaveBeenNthCalledWith(2, { id: 2 });
    });

    it('does not receive previous history when subscribing without replay', () => {
      const bus = createEventBus();

      bus.emit('data', { id: 1 });

      const handler = vi.fn();
      bus.on('data', handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not replay history from other events', () => {
      const bus = createEventBus();

      bus.emit('event-a', 1);
      bus.emit('event-b', 2);

      const handler = vi.fn();
      bus.on('event-a', handler, { replay: true });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  describe('Request-Response pattern', () => {
    it('emits an event and receives a response with request', async () => {
      const bus = createEventBus();

      // Register responder
      bus.on('getData', (payload) => {
        bus.emit('getData:response', { result: `data for ${payload}` });
      });

      const response = await bus.request('getData', 'user-123');

      expect(response).toStrictEqual({ result: 'data for user-123' });
    });

    it('throws an error if no response within timeout', async () => {
      const bus = createEventBus({ defaultRequestTimeout: 50 });

      // No responder
      await expect(bus.request('noResponder', 'data')).rejects.toThrow('timed out');
    });

    it('can specify a custom timeout', async () => {
      const bus = createEventBus();

      await expect(bus.request('noResponder', 'data', 50)).rejects.toThrow('timed out');
    });

    it('automatically removes response listener after response', async () => {
      const bus = createEventBus();

      bus.on('ping', () => {
        bus.emit('ping:response', 'pong');
      });

      await bus.request('ping');

      // After response, there should be no response listeners
      expect(bus.listenerCount('ping:response')).toBe(0);
    });
  });

  describe('type-safe event map', () => {
    it('emit/on works correctly with a typed event bus', () => {
      type AppEvents = {
        'user:login': { userId: string };
        'cart:update': { items: number };
      };

      const bus = createEventBus<AppEvents>();
      const handler = vi.fn();

      bus.on('user:login', handler);
      bus.emit('user:login', { userId: '123' });

      expect(handler).toHaveBeenCalledWith({ userId: '123' });
    });

    it('preserves types in the history of a typed event bus', () => {
      type Events = {
        ping: { ts: number };
      };

      const bus = createEventBus<Events>();
      bus.emit('ping', { ts: 42 });

      const history = bus.getHistory('ping');
      expect(history).toHaveLength(1);
      expect(history[0].payload).toStrictEqual({ ts: 42 });
    });
  });
});
