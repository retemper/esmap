---
description: '@esmap/communication API 레퍼런스 — 타입 안전한 이벤트 버스, 글로벌 상태, 앱 props.'
---

# @esmap/communication

타입 안전한 애플리케이션 간 통신 레이어입니다. 디커플링된 메시징을 위한 이벤트 버스, 글로벌 공유 상태 관리, 애플리케이션 props 전달을 포함합니다. (1.1 kB gzip)

## 설치

```bash
pnpm add @esmap/communication
```

## 함수

### `createEventBus`

```ts
function createEventBus<E extends EventMap>(options?: EventBusOptions): EventBus<E>;
```

타입 안전한 이벤트 버스를 생성합니다. 앱 간 이벤트 기반 통신에 사용됩니다. 핸들러 에러를 내부적으로 격리하여 하나의 핸들러 실패가 다른 핸들러에 영향을 주지 않습니다.

### `createScopedEventBus`

```ts
function createScopedEventBus<E extends EventMap>(bus: EventBus, scope: string): ScopedEventBus<E>;
```

기존 EventBus를 래핑하여 네임스페이스로 격리된 스코프 버스를 생성합니다. MFE 앱 간 이벤트 충돌을 방지합니다.

### `createGlobalState`

```ts
function createGlobalState<T extends Record<string, unknown>>(initial: T): GlobalState<T>;
```

앱 간 공유 가능한 글로벌 상태를 생성합니다.

### `createAppProps`

```ts
function createAppProps<T extends Record<string, unknown>>(initial: T): AppProps<T>;
```

셸에서 리모트 앱으로 전달되는 프로퍼티를 관리합니다.

### `createScopedGlobalState`

```ts
function createScopedGlobalState<T extends Record<string, unknown>, K extends keyof T>(
  options: ScopedGlobalStateOptions<T, K>,
): ScopedGlobalState<T, K>;
```

글로벌 상태의 특정 키만 접근할 수 있는 스코프 뷰를 생성합니다. MFE 앱별 접근 권한을 제한하여 의도하지 않은 상태 변경을 방지합니다.

### `createReadyGate`

```ts
function createReadyGate(options?: ReadyGateOptions): ReadyGate;
```

공유 리소스의 준비 상태를 동기화하는 게이트를 생성합니다. 인증 토큰이나 사용자 정보 같은 필수 공유 상태가 준비되기 전에 의존 앱이 마운트되는 것을 방지합니다.

## 타입

### `EventBus<E>`

| 메서드          | 시그니처                                             | 설명                               |
| --------------- | ---------------------------------------------------- | ---------------------------------- |
| `emit`          | `(event: K, payload?: E[K]) => void`                 | 모든 리스너에 이벤트를 발행        |
| `on`            | `(event: K, handler, options?) => () => void`        | 이벤트를 구독하고 해제 함수를 반환 |
| `once`          | `(event: K, handler) => () => void`                  | 이벤트를 한 번만 구독              |
| `onAny`         | `(pattern: string, handler) => () => void`           | 와일드카드 패턴으로 구독           |
| `off`           | `(event: K) => void`                                 | 특정 이벤트의 모든 리스너를 제거   |
| `clear`         | `() => void`                                         | 모든 리스너를 제거                 |
| `getHistory`    | `(event?: string) => EventRecord[]`                  | 이벤트 히스토리를 조회             |
| `listenerCount` | `(event: K) => number`                               | 특정 이벤트의 리스너 수를 반환     |
| `request`       | `(event: K, payload?, timeout?) => Promise<unknown>` | 요청-응답 패턴                     |

### `EventBusOptions`

| 속성                    | 타입                                      | 설명                                      |
| ----------------------- | ----------------------------------------- | ----------------------------------------- |
| `maxHistory`            | `number`                                  | 최대 이벤트 히스토리 수 (기본값: 100)     |
| `onHandlerError`        | `(event: string, error: unknown) => void` | 핸들러 에러 콜백                          |
| `defaultRequestTimeout` | `number`                                  | 요청-응답 기본 타임아웃 ms (기본값: 5000) |

### `GlobalState<T>`

| 메서드      | 시그니처                        | 설명                                     |
| ----------- | ------------------------------- | ---------------------------------------- |
| `getState`  | `() => Readonly<T>`             | 현재 상태의 동결 복사본을 반환           |
| `setState`  | `(partial: Partial<T>) => void` | 부분 상태를 머지하고 구독자에게 알림     |
| `subscribe` | `(listener) => () => void`      | 상태 변경을 구독                         |
| `reset`     | `() => void`                    | 초기 상태로 복원                         |
| `select`    | `(key, listener) => () => void` | 특정 키의 값이 변경될 때만 리스너를 호출 |

### `AppProps<T>`

| 메서드          | 시그니처                        | 설명                                     |
| --------------- | ------------------------------- | ---------------------------------------- |
| `getProps`      | `() => Readonly<T>`             | 현재 프로퍼티의 동결 복사본을 반환       |
| `setProps`      | `(partial: Partial<T>) => void` | 부분 프로퍼티를 머지하고 구독자에게 알림 |
| `onPropsChange` | `(listener) => () => void`      | 프로퍼티 변경을 구독                     |

### `ScopedGlobalStateOptions<T, K>`

| 속성       | 타입             | 설명                                 |
| ---------- | ---------------- | ------------------------------------ |
| `state`    | `GlobalState<T>` | 부모 글로벌 상태                     |
| `keys`     | `K[]`            | 이 스코프에서 접근할 수 있는 키 목록 |
| `readonly` | `boolean`        | 읽기 전용 모드                       |

### `ReadyGateOptions`

| 속성      | 타입     | 설명                                                            |
| --------- | -------- | --------------------------------------------------------------- |
| `timeout` | `number` | 모든 리소스가 준비될 때까지의 최대 대기 시간 ms (기본값: 10000) |
