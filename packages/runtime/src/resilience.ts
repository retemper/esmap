/** 타임아웃 발생 시 던져지는 에러 */
export class TimeoutError extends Error {
  /** 타임아웃 시간(ms) */
  readonly timeout: number;

  constructor(timeout: number) {
    super(`${timeout}ms 내에 작업이 완료되지 않았습니다`);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/** 재시도 옵션 */
export interface RetryOptions {
  /** 최대 재시도 횟수 */
  readonly retries: number;
  /** 재시도 간 지연 시간(ms) */
  readonly delay: number;
}

/** 복원력 옵션 (타임아웃 + 재시도 결합) */
export interface ResilienceOptions extends RetryOptions {
  /** 각 시도의 타임아웃(ms) */
  readonly timeout: number;
}

/**
 * 비동기 함수에 타임아웃을 적용한다.
 * 지정 시간 내에 완료되지 않으면 TimeoutError를 던진다.
 * @param fn - 실행할 비동기 함수
 * @param ms - 타임아웃(ms)
 * @returns 함수 실행 결과
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
 * 비동기 함수를 재시도 가능하게 래핑한다.
 * 지정 횟수만큼 실패 시 재시도하며, 각 시도 사이에 지연을 둔다.
 * @param fn - 실행할 비동기 함수
 * @param options - 재시도 옵션
 * @returns 함수 실행 결과
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries, delay } = options;

  return attempt(fn, retries, delay);
}

/** 재귀적으로 함수 실행을 시도한다 */
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
 * 비동기 함수에 타임아웃과 재시도를 모두 적용한다.
 * 각 시도마다 타임아웃이 독립적으로 적용된다.
 * @param fn - 실행할 비동기 함수
 * @param options - 복원력 옵션
 * @returns 함수 실행 결과
 */
export function withResilience<T>(fn: () => Promise<T>, options: ResilienceOptions): Promise<T> {
  return withRetry(() => withTimeout(fn, options.timeout), {
    retries: options.retries,
    delay: options.delay,
  });
}

/** 지정 시간만큼 대기한다 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** 서킷 브레이커 상태 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** 서킷 브레이커 설정 */
export interface CircuitBreakerOptions {
  /** 서킷을 OPEN으로 전환하기 위한 연속 실패 횟수 */
  readonly failureThreshold: number;
  /** OPEN에서 HALF_OPEN으로 전환하기까지 대기 시간(ms) */
  readonly cooldownMs: number;
  /** 상태 전환 시 호출되는 콜백 */
  readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

/** 서킷이 열려 있어 요청이 차단될 때 던져지는 에러 */
export class CircuitOpenError extends Error {
  constructor() {
    super('서킷이 열려 있어 요청이 차단되었습니다');
    this.name = 'CircuitOpenError';
  }
}

/** 서킷 브레이커 인스턴스 */
export interface CircuitBreaker {
  /** 서킷 브레이커를 통해 비동기 함수를 실행한다 */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  /** 현재 서킷 상태 */
  readonly state: CircuitState;
  /** 서킷을 CLOSED 상태로 초기화한다 */
  reset(): void;
  /** 연속 실패 횟수 */
  readonly failureCount: number;
}

/**
 * 서킷 브레이커를 생성한다.
 * 연속 실패가 임계값에 도달하면 서킷을 열어 후속 요청을 즉시 차단하고,
 * 쿨다운 후 단일 요청을 허용하여 복구를 확인한다.
 * @param options - 서킷 브레이커 설정
 * @returns 서킷 브레이커 인스턴스
 */
export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const ref: { state: CircuitState; failures: number; lastFailureTime: number } = {
    state: 'CLOSED',
    failures: 0,
    lastFailureTime: 0,
  };

  /** 상태를 전환하고 콜백을 호출한다 */
  const transition = (to: CircuitState): void => {
    const from = ref.state;
    ref.state = to;
    options.onStateChange?.(from, to);
  };

  /** 성공 시 상태를 리셋한다 */
  const onSuccess = (): void => {
    ref.failures = 0;
    if (ref.state === 'HALF_OPEN') {
      transition('CLOSED');
    }
  };

  /** 실패 시 카운터를 증가시키고 필요하면 서킷을 연다 */
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
