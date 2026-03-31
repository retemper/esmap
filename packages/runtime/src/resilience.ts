/** Error thrown when a timeout occurs */
export class TimeoutError extends Error {
  /** Timeout duration (ms) */
  readonly timeout: number;

  constructor(timeout: number) {
    super(`Operation did not complete within ${timeout}ms`);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/** Retry options */
export interface RetryOptions {
  /** Maximum number of retries */
  readonly retries: number;
  /** Delay between retries (ms) */
  readonly delay: number;
}

/** Resilience options (timeout + retry combined) */
export interface ResilienceOptions extends RetryOptions {
  /** Timeout per attempt (ms) */
  readonly timeout: number;
}

/**
 * Applies a timeout to an async function.
 * Throws TimeoutError if not completed within the specified time.
 * @param fn - async function to execute
 * @param ms - timeout (ms)
 * @returns function execution result
 */
export function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(ms));
    }, ms);

    fn().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Wraps an async function with retry capability.
 * Retries on failure up to the specified count with a delay between each attempt.
 * @param fn - async function to execute
 * @param options - retry options
 * @returns function execution result
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries, delay } = options;

  return attempt(fn, retries, delay);
}

/** Recursively attempts to execute the function */
async function attempt<T>(fn: () => Promise<T>, remaining: number, delay: number): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (remaining <= 0) {
      throw error;
    }
    await sleep(delay);
    return attempt(fn, remaining - 1, delay);
  }
}

/**
 * Applies both timeout and retry to an async function.
 * Each attempt has an independent timeout.
 * @param fn - async function to execute
 * @param options - resilience options
 * @returns function execution result
 */
export function withResilience<T>(fn: () => Promise<T>, options: ResilienceOptions): Promise<T> {
  return withRetry(() => withTimeout(fn, options.timeout), {
    retries: options.retries,
    delay: options.delay,
  });
}

/** Waits for the specified duration */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Circuit breaker state */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** Circuit breaker options */
export interface CircuitBreakerOptions {
  /** Number of consecutive failures to transition to OPEN */
  readonly failureThreshold: number;
  /** Wait time (ms) before transitioning from OPEN to HALF_OPEN */
  readonly cooldownMs: number;
  /** Callback invoked on state transitions */
  readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

/** Error thrown when the circuit is open and requests are blocked */
export class CircuitOpenError extends Error {
  constructor() {
    super('Request blocked: circuit is open');
    this.name = 'CircuitOpenError';
  }
}

/** Circuit breaker instance */
export interface CircuitBreaker {
  /** Executes an async function through the circuit breaker */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  /** Current circuit state */
  readonly state: CircuitState;
  /** Resets the circuit to CLOSED state */
  reset(): void;
  /** Consecutive failure count */
  readonly failureCount: number;
}

/**
 * Creates a circuit breaker.
 * Opens the circuit to immediately block subsequent requests when consecutive failures
 * reach the threshold, then allows a single request after cooldown to verify recovery.
 * @param options - circuit breaker options
 * @returns circuit breaker instance
 */
export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const ref: { state: CircuitState; failures: number; lastFailureTime: number } = {
    state: 'CLOSED',
    failures: 0,
    lastFailureTime: 0,
  };

  /** Transitions state and invokes callback */
  const transition = (to: CircuitState): void => {
    const from = ref.state;
    ref.state = to;
    options.onStateChange?.(from, to);
  };

  /** Resets state on success */
  const onSuccess = (): void => {
    ref.failures = 0;
    if (ref.state === 'HALF_OPEN') {
      transition('CLOSED');
    }
  };

  /** Increments the failure counter and opens the circuit if needed */
  const onFailure = (): void => {
    ref.failures += 1;
    ref.lastFailureTime = Date.now();
    if (ref.state === 'HALF_OPEN') {
      transition('OPEN');
    } else if (ref.failures >= options.failureThreshold) {
      transition('OPEN');
    }
  };

  return {
    get state(): CircuitState {
      return ref.state;
    },

    get failureCount(): number {
      return ref.failures;
    },

    reset(): void {
      ref.failures = 0;
      ref.lastFailureTime = 0;
      ref.state = 'CLOSED';
    },

    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (ref.state === 'OPEN') {
        const elapsed = Date.now() - ref.lastFailureTime;
        if (elapsed >= options.cooldownMs) {
          transition('HALF_OPEN');
        } else {
          throw new CircuitOpenError();
        }
      }

      try {
        const result = await fn();
        onSuccess();
        return result;
      } catch (error) {
        onFailure();
        throw error;
      }
    },
  };
}
