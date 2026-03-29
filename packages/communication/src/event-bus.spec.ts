import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './event-bus.js';

describe('createEventBus', () => {
  it('emit/on 기본 동작으로 이벤트를 발행하고 수신한다', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('test', handler);
    bus.emit('test', { value: 42 });

    expect(handler).toHaveBeenCalledWith({ value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('once는 한 번만 호출된다', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.once('test', handler);
    bus.emit('test', 'first');
    bus.emit('test', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('unsubscribe 함수로 구독을 해제한다', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const unsub = bus.on('test', handler);
    bus.emit('test', 'before');
    unsub();
    bus.emit('test', 'after');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('before');
  });

  it('off로 특정 이벤트의 모든 리스너를 제거한다', () => {
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

  it('clear로 모든 리스너를 제거한다', () => {
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

  it('getHistory로 이벤트 이력을 조회한다', () => {
    const bus = createEventBus();

    bus.emit('a', 1);
    bus.emit('b', 2);

    const history = bus.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toStrictEqual(expect.objectContaining({ event: 'a', payload: 1 }));
    expect(history[1]).toStrictEqual(expect.objectContaining({ event: 'b', payload: 2 }));
  });

  it('maxHistory를 초과하면 오래된 이력이 삭제된다', () => {
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

  it('listenerCount가 정확한 수를 반환한다', () => {
    const bus = createEventBus();

    expect(bus.listenerCount('test')).toBe(0);

    const unsub1 = bus.on('test', vi.fn());
    bus.on('test', vi.fn());
    expect(bus.listenerCount('test')).toBe(2);

    unsub1();
    expect(bus.listenerCount('test')).toBe(1);
  });

  it('이벤트 없이 emit해도 에러가 없다', () => {
    const bus = createEventBus();

    expect(() => bus.emit('nonexistent', 'data')).not.toThrow();
  });

  it('payload 없이 emit할 수 있다', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('ping', handler);
    bus.emit('ping');

    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('여러 리스너가 등록 순서대로 호출된다', () => {
    const bus = createEventBus();
    const callOrder: Array<number> = [];

    bus.on('test', () => callOrder.push(1));
    bus.on('test', () => callOrder.push(2));
    bus.on('test', () => callOrder.push(3));
    bus.emit('test', 'data');

    expect(callOrder).toStrictEqual([1, 2, 3]);
  });

  it('getHistory에 event 인자를 전달하면 해당 이벤트만 필터한다', () => {
    const bus = createEventBus();

    bus.emit('a', 1);
    bus.emit('b', 2);
    bus.emit('a', 3);

    const filtered = bus.getHistory('a');
    expect(filtered).toHaveLength(2);
    expect(filtered[0]).toStrictEqual(expect.objectContaining({ event: 'a', payload: 1 }));
    expect(filtered[1]).toStrictEqual(expect.objectContaining({ event: 'a', payload: 3 }));
  });

  it('once의 unsubscribe를 emit 전에 호출하면 핸들러가 호출되지 않는다', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const unsub = bus.once('test', handler);
    unsub();
    bus.emit('test', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  describe('핸들러 에러 격리', () => {
    it('핸들러가 에러를 던져도 다른 핸들러는 실행된다', () => {
      const bus = createEventBus();
      const handler1 = vi.fn(() => {
        throw new Error('핸들러 에러');
      });
      const handler2 = vi.fn();

      bus.on('test', handler1);
      bus.on('test', handler2);
      bus.emit('test', 'data');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('onHandlerError 콜백에 에러 정보가 전달된다', () => {
      const onHandlerError = vi.fn();
      const bus = createEventBus({ onHandlerError });
      const error = new Error('핸들러 에러');

      bus.on('test', () => {
        throw error;
      });
      bus.emit('test', 'data');

      expect(onHandlerError).toHaveBeenCalledWith('test', error);
    });

    it('여러 핸들러에서 에러가 발생해도 모든 에러가 보고된다', () => {
      const onHandlerError = vi.fn();
      const bus = createEventBus({ onHandlerError });

      bus.on('test', () => {
        throw new Error('에러1');
      });
      bus.on('test', () => {
        throw new Error('에러2');
      });
      bus.emit('test', 'data');

      expect(onHandlerError).toHaveBeenCalledTimes(2);
    });
  });

  describe('와일드카드 구독 (onAny)', () => {
    it('패턴에 매칭되는 모든 이벤트를 수신한다', () => {
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

    it('구독 해제 함수로 와일드카드 리스너를 제거한다', () => {
      const bus = createEventBus();
      const handler = vi.fn();

      const unsub = bus.onAny('app:*', handler);
      bus.emit('app:loaded', 'before');
      unsub();
      bus.emit('app:mounted', 'after');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('clear()가 와일드카드 리스너도 제거한다', () => {
      const bus = createEventBus();
      const handler = vi.fn();

      bus.onAny('app:*', handler);
      bus.clear();
      bus.emit('app:loaded', 'data');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('이벤트 이력 재생 (replay)', () => {
    it('replay 옵션으로 구독하면 이전 이력이 재생된다', () => {
      const bus = createEventBus();

      bus.emit('data', { id: 1 });
      bus.emit('data', { id: 2 });

      const handler = vi.fn();
      bus.on('data', handler, { replay: true });

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(handler).toHaveBeenNthCalledWith(2, { id: 2 });
    });

    it('replay 없이 구독하면 이전 이력을 받지 않는다', () => {
      const bus = createEventBus();

      bus.emit('data', { id: 1 });

      const handler = vi.fn();
      bus.on('data', handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it('다른 이벤트의 이력은 재생하지 않는다', () => {
      const bus = createEventBus();

      bus.emit('event-a', 1);
      bus.emit('event-b', 2);

      const handler = vi.fn();
      bus.on('event-a', handler, { replay: true });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  describe('Request-Response 패턴', () => {
    it('request로 이벤트를 발행하고 응답을 받는다', async () => {
      const bus = createEventBus();

      // 응답자 등록
      bus.on('getData', (payload) => {
        bus.emit('getData:response', { result: `data for ${payload}` });
      });

      const response = await bus.request('getData', 'user-123');

      expect(response).toStrictEqual({ result: 'data for user-123' });
    });

    it('타임아웃 내에 응답이 없으면 에러가 발생한다', async () => {
      const bus = createEventBus({ defaultRequestTimeout: 50 });

      // 응답자 없음
      await expect(bus.request('noResponder', 'data')).rejects.toThrow('타임아웃');
    });

    it('커스텀 타임아웃을 지정할 수 있다', async () => {
      const bus = createEventBus();

      await expect(bus.request('noResponder', 'data', 50)).rejects.toThrow('타임아웃');
    });

    it('응답 후 response 리스너가 자동으로 해제된다', async () => {
      const bus = createEventBus();

      bus.on('ping', () => {
        bus.emit('ping:response', 'pong');
      });

      await bus.request('ping');

      // 응답 후에는 response 리스너가 없어야 함
      expect(bus.listenerCount('ping:response')).toBe(0);
    });
  });

  describe('타입 안전한 이벤트 맵', () => {
    it('타입이 지정된 이벤트 버스에서 emit/on이 정상 동작한다', () => {
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

    it('타입이 지정된 이벤트 버스의 이력에서 타입이 보존된다', () => {
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
