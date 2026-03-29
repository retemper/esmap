import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout, withRetry, withResilience, TimeoutError, createCircuitBreaker, CircuitOpenError } from './resilience.js';
import type { CircuitBreakerOptions } from './resilience.js';

describe('TimeoutError', () => {
  it('timeout 값을 가진 에러를 생성한다', () => {
    const error = new TimeoutError(3000);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.timeout).toBe(3000);
    expect(error.name).toBe('TimeoutError');
    expect(error.message).toContain('3000ms');
  });

  it('timeout이 0인 경우에도 올바르게 생성된다', () => {
    const error = new TimeoutError(0);

    expect(error.timeout).toBe(0);
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('시간 내에 완료되면 결과를 반환한다', async () => {
    const fn = () => Promise.resolve('성공');

    const result = await withTimeout(fn, 1000);

    expect(result).toBe('성공');
  });

  it('시간 내에 완료되지 않으면 TimeoutError를 던진다', async () => {
    const fn = () =>
      new Promise<string>(() => {
        /* 절대 resolve되지 않음 */
      });

    const promise = withTimeout(fn, 1000);

    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow(TimeoutError);
    await expect(promise).rejects.toThrow('1000ms');
  });

  it('함수가 에러를 던지면 해당 에러가 전파된다', async () => {
    const fn = () => Promise.reject(new Error('원본 에러'));

    await expect(withTimeout(fn, 1000)).rejects.toThrow('원본 에러');
  });
});

describe('withRetry', () => {
  it('첫 번째 시도에서 성공하면 바로 반환한다', async () => {
    const fn = vi.fn().mockResolvedValue('성공');

    const result = await withRetry(fn, { retries: 3, delay: 0 });

    expect(result).toBe('성공');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('실패 후 재시도하여 성공하면 결과를 반환한다', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('실패 1'))
      .mockRejectedValueOnce(new Error('실패 2'))
      .mockResolvedValue('성공');

    const result = await withRetry(fn, { retries: 3, delay: 0 });

    expect(result).toBe('성공');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('모든 재시도가 실패하면 마지막 에러를 던진다', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(new Error('항상 실패')));

    await expect(withRetry(fn, { retries: 2, delay: 0 })).rejects.toThrow('항상 실패');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries가 0이면 재시도 없이 한 번만 실행한다', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(new Error('실패')));

    await expect(withRetry(fn, { retries: 0, delay: 0 })).rejects.toThrow('실패');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('재시도 사이에 지정된 delay만큼 대기한다', async () => {
    vi.useFakeTimers();

    const timestamps: number[] = [];
    const fn = vi
      .fn()
      .mockImplementationOnce(() => {
        timestamps.push(Date.now());
        return Promise.reject(new Error('실패'));
      })
      .mockImplementation(() => {
        timestamps.push(Date.now());
        return Promise.resolve('성공');
      });

    const promise = withRetry(fn, { retries: 1, delay: 500 });

    await vi.advanceTimersByTimeAsync(500);

    await promise;

    expect(timestamps).toHaveLength(2);
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(500);

    vi.useRealTimers();
  });
});

describe('withResilience', () => {
  it('시간 내에 성공하면 결과를 반환한다', async () => {
    const fn = () => Promise.resolve(42);

    const result = await withResilience(fn, {
      timeout: 1000,
      retries: 2,
      delay: 0,
    });

    expect(result).toBe(42);
  });

  it('타임아웃 후 재시도하여 성공하면 결과를 반환한다', async () => {
    vi.useFakeTimers();

    const fn = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>(() => {
            /* 절대 resolve되지 않음 — 타임아웃 유발 */
          }),
      )
      .mockResolvedValue(99);

    const promise = withResilience(fn, {
      timeout: 1000,
      retries: 1,
      delay: 100,
    });

    /* 첫 번째 시도: 1000ms 타임아웃 */
    await vi.advanceTimersByTimeAsync(1000);
    /* 재시도 전 delay: 100ms */
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;

    expect(result).toBe(99);
    expect(fn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('모든 시도가 타임아웃되면 TimeoutError를 던진다', async () => {
    vi.useFakeTimers();

    const fn = () =>
      new Promise<never>(() => {
        /* 절대 resolve되지 않는 promise */
      });

    const promise = withResilience(fn, {
      timeout: 100,
      retries: 1,
      delay: 50,
    });

    /* 첫 번째 시도 타임아웃 */
    await vi.advanceTimersByTimeAsync(100);
    /* delay */
    await vi.advanceTimersByTimeAsync(50);
    /* 두 번째 시도 타임아웃 — catch를 먼저 걸어둔다 */
    const caught = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);

    const error = await caught;
    expect(error).toBeInstanceOf(TimeoutError);

    vi.useRealTimers();
  });

  it('함수 에러와 타임아웃이 혼합된 경우 최종 성공을 반환한다', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('네트워크 에러'))
      .mockResolvedValue('복구됨');

    const result = await withResilience(fn, {
      timeout: 1000,
      retries: 1,
      delay: 0,
    });

    expect(result).toBe('복구됨');
  });
});

describe('CircuitOpenError', () => {
  it('올바른 이름과 메시지를 가진 에러를 생성한다', () => {
    const error = new CircuitOpenError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CircuitOpenError);
    expect(error.name).toBe('CircuitOpenError');
    expect(error.message).toContain('서킷');
  });
});

describe('createCircuitBreaker', () => {
  const defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 3,
    cooldownMs: 5000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CLOSED 상태에서 성공하면 CLOSED를 유지한다', async () => {
    const breaker = createCircuitBreaker(defaultOptions);

    await breaker.execute(() => Promise.resolve('ok'));

    expect(breaker.state).toBe('CLOSED');
  });

  it('CLOSED 상태에서 실패가 threshold에 도달하면 OPEN으로 전환된다', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    expect(breaker.state).toBe('OPEN');
  });

  it('OPEN 상태에서 즉시 CircuitOpenError를 던진다', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
  });

  it('OPEN 상태에서 cooldown 후 HALF_OPEN으로 전환된다', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    expect(breaker.state).toBe('OPEN');

    vi.advanceTimersByTime(5000);

    await breaker.execute(() => Promise.resolve('ok'));

    expect(breaker.state).toBe('CLOSED');
  });

  it('HALF_OPEN 상태에서 성공하면 CLOSED로 복귀한다', async () => {
    const onStateChange = vi.fn();
    const breaker = createCircuitBreaker({ ...defaultOptions, onStateChange });
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    vi.advanceTimersByTime(5000);

    await breaker.execute(() => Promise.resolve('ok'));

    expect(breaker.state).toBe('CLOSED');
    expect(onStateChange).toHaveBeenCalledWith('HALF_OPEN', 'CLOSED');
  });

  it('HALF_OPEN 상태에서 실패하면 다시 OPEN으로 전환된다', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    vi.advanceTimersByTime(5000);

    await breaker.execute(failing).catch(() => {});

    expect(breaker.state).toBe('OPEN');
  });

  it('reset()이 상태를 CLOSED로 초기화한다', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    expect(breaker.state).toBe('OPEN');

    breaker.reset();

    expect(breaker.state).toBe('CLOSED');
    expect(breaker.failureCount).toBe(0);
  });

  it('onStateChange 콜백이 상태 전환 시 호출된다', async () => {
    const onStateChange = vi.fn();
    const breaker = createCircuitBreaker({ ...defaultOptions, onStateChange });
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN');
  });

  it('failureCount가 연속 실패 횟수를 정확히 추적한다', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    expect(breaker.failureCount).toBe(0);

    await breaker.execute(failing).catch(() => {});
    expect(breaker.failureCount).toBe(1);

    await breaker.execute(failing).catch(() => {});
    expect(breaker.failureCount).toBe(2);
  });

  it('성공 시 failureCount가 0으로 리셋된다', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    await breaker.execute(failing).catch(() => {});
    await breaker.execute(failing).catch(() => {});
    expect(breaker.failureCount).toBe(2);

    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.failureCount).toBe(0);
  });
});
