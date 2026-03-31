import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout, withRetry, withResilience, TimeoutError, createCircuitBreaker, CircuitOpenError } from './resilience.js';
import type { CircuitBreakerOptions } from './resilience.js';

describe('TimeoutError', () => {
  it('creates an error with the timeout value', () => {
    const error = new TimeoutError(3000);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.timeout).toBe(3000);
    expect(error.name).toBe('TimeoutError');
    expect(error.message).toContain('3000ms');
  });

  it('creates correctly even when timeout is 0', () => {
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

  it('returns the result when completed within the time limit', async () => {
    const fn = () => Promise.resolve('success');

    const result = await withTimeout(fn, 1000);

    expect(result).toBe('success');
  });

  it('throws TimeoutError when not completed within the time limit', async () => {
    const fn = () =>
      new Promise<string>(() => {
        /* never resolves */
      });

    const promise = withTimeout(fn, 1000);

    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow(TimeoutError);
    await expect(promise).rejects.toThrow('1000ms');
  });

  it('propagates the error when the function throws', async () => {
    const fn = () => Promise.reject(new Error('original error'));

    await expect(withTimeout(fn, 1000)).rejects.toThrow('original error');
  });
});

describe('withRetry', () => {
  it('returns immediately when the first attempt succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, { retries: 3, delay: 0 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('returns the result when retrying after failure succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('failure 1'))
      .mockRejectedValueOnce(new Error('failure 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { retries: 3, delay: 0 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error when all retries fail', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(new Error('always fails')));

    await expect(withRetry(fn, { retries: 2, delay: 0 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('executes only once without retrying when retries is 0', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(new Error('failed')));

    await expect(withRetry(fn, { retries: 0, delay: 0 })).rejects.toThrow('failed');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('waits for the specified delay between retries', async () => {
    vi.useFakeTimers();

    const timestamps: number[] = [];
    const fn = vi
      .fn()
      .mockImplementationOnce(() => {
        timestamps.push(Date.now());
        return Promise.reject(new Error('failed'));
      })
      .mockImplementation(() => {
        timestamps.push(Date.now());
        return Promise.resolve('success');
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
  it('returns the result when successful within the time limit', async () => {
    const fn = () => Promise.resolve(42);

    const result = await withResilience(fn, {
      timeout: 1000,
      retries: 2,
      delay: 0,
    });

    expect(result).toBe(42);
  });

  it('returns the result when retrying after timeout succeeds', async () => {
    vi.useFakeTimers();

    const fn = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>(() => {
            /* never resolves — triggers timeout */
          }),
      )
      .mockResolvedValue(99);

    const promise = withResilience(fn, {
      timeout: 1000,
      retries: 1,
      delay: 100,
    });

    /* First attempt: 1000ms timeout */
    await vi.advanceTimersByTimeAsync(1000);
    /* Delay before retry: 100ms */
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;

    expect(result).toBe(99);
    expect(fn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('throws TimeoutError when all attempts time out', async () => {
    vi.useFakeTimers();

    const fn = () =>
      new Promise<never>(() => {
        /* promise that never resolves */
      });

    const promise = withResilience(fn, {
      timeout: 100,
      retries: 1,
      delay: 50,
    });

    /* First attempt timeout */
    await vi.advanceTimersByTimeAsync(100);
    /* delay */
    await vi.advanceTimersByTimeAsync(50);
    /* Second attempt timeout — attach catch first */
    const caught = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);

    const error = await caught;
    expect(error).toBeInstanceOf(TimeoutError);

    vi.useRealTimers();
  });

  it('returns the final success when function errors and timeouts are mixed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('recovered');

    const result = await withResilience(fn, {
      timeout: 1000,
      retries: 1,
      delay: 0,
    });

    expect(result).toBe('recovered');
  });
});

describe('CircuitOpenError', () => {
  it('creates an error with the correct name and message', () => {
    const error = new CircuitOpenError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CircuitOpenError);
    expect(error.name).toBe('CircuitOpenError');
    expect(error.message).toContain('circuit');
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

  it('stays CLOSED when succeeding in CLOSED state', async () => {
    const breaker = createCircuitBreaker(defaultOptions);

    await breaker.execute(() => Promise.resolve('ok'));

    expect(breaker.state).toBe('CLOSED');
  });

  it('transitions to OPEN when failures reach threshold in CLOSED state', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    expect(breaker.state).toBe('OPEN');
  });

  it('throws CircuitOpenError immediately in OPEN state', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
  });

  it('transitions to HALF_OPEN after cooldown in OPEN state', async () => {
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

  it('returns to CLOSED when succeeding in HALF_OPEN state', async () => {
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

  it('transitions back to OPEN when failing in HALF_OPEN state', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    vi.advanceTimersByTime(5000);

    await breaker.execute(failing).catch(() => {});

    expect(breaker.state).toBe('OPEN');
  });

  it('resets the state to CLOSED with reset()', async () => {
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

  it('calls the onStateChange callback on state transitions', async () => {
    const onStateChange = vi.fn();
    const breaker = createCircuitBreaker({ ...defaultOptions, onStateChange });
    const failing = () => Promise.reject(new Error('fail'));

    for (const _ of Array.from({ length: 3 })) {
      await breaker.execute(failing).catch(() => {});
    }

    expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN');
  });

  it('accurately tracks consecutive failure count with failureCount', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    expect(breaker.failureCount).toBe(0);

    await breaker.execute(failing).catch(() => {});
    expect(breaker.failureCount).toBe(1);

    await breaker.execute(failing).catch(() => {});
    expect(breaker.failureCount).toBe(2);
  });

  it('resets failureCount to 0 on success', async () => {
    const breaker = createCircuitBreaker(defaultOptions);
    const failing = () => Promise.reject(new Error('fail'));

    await breaker.execute(failing).catch(() => {});
    await breaker.execute(failing).catch(() => {});
    expect(breaker.failureCount).toBe(2);

    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.failureCount).toBe(0);
  });
});
