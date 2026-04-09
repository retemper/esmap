# @esmap/runtime

esmap 마이크로 프론트엔드의 핵심 런타임입니다. Import map 로딩, 애플리케이션 레지스트리, 클라이언트 사이드 라우팅, 에러 바운더리, 리소스 프리페칭을 처리합니다. (8.2 kB gzip)

## 설치

```bash
pnpm add @esmap/runtime
```

## 클래스

### `AppRegistry`

```ts
class AppRegistry {
  constructor(options?: AppRegistryOptions)
  getApps(): readonly RegisteredApp[]
  getApp(name: string): RegisteredApp | undefined
  registerApp(options: RegisterAppOptions): void
  unregisterApp(name: string): Promise<void>
  loadApp(name: string): Promise<void>
  mountApp(name: string): Promise<void>
  unmountApp(name: string): Promise<void>
  setKeepAlive(name: string, enabled: boolean): void
  isKeepAlive(name: string): boolean
  onStatusChange(listener: (event: AppStatusChangeEvent) => void): () => void
  getRetryCount(name: string): number
  destroy(): Promise<void>
}
```

MFE 앱을 관리하는 레지스트리. 앱 등록, 상태 관리, 라이프사이클 실행을 담당합니다.

### `Router`

```ts
class Router {
  constructor(registry: RouterRegistry, options?: RouterOptions)
  start(): Promise<void>
  stop(): void
  push(url: string): void
  replace(url: string): void
  back(): void
  forward(): void
  go(delta: number): void
  get currentRoute(): RouteContext
  beforeRouteChange(guard: BeforeRouteChangeGuard): () => void
  afterRouteChange(guard: AfterRouteChangeGuard): () => void
}
```

URL 변경을 감지하여 적절한 MFE를 마운트/언마운트하는 라우터. History API의 popstate, pushState, replaceState를 모두 감시합니다.

### `TimeoutError`

```ts
class TimeoutError extends Error {
  readonly timeout: number
  constructor(timeout: number)
}
```

타임아웃 발생 시 던져지는 에러.

### `CircuitOpenError`

```ts
class CircuitOpenError extends Error {
  constructor()
}
```

서킷이 열려 있어 요청이 차단될 때 던져지는 에러.

### `SharedVersionConflictError`

```ts
class SharedVersionConflictError extends Error {
  readonly moduleName: string
  constructor(moduleName: string, message: string)
}
```

공유 모듈 버전 협상 실패 시 던져지는 에러.

## 함수

### `loadImportMap`

```ts
function loadImportMap(options: LoaderOptions): Promise<ImportMap>
```

Import map을 로드하고 DOM에 적용합니다. 네이티브 import map이 이미 존재하면 주입을 건너뜁니다.

### `createDefaultFallback`

```ts
function createDefaultFallback(appName: string, error: Error, onRetry: () => void): HTMLElement
```

기본 폴백 DOM 요소를 생성합니다. 에러 메시지와 재시도 버튼을 포함합니다.

### `renderFallback`

```ts
function renderFallback(container: HTMLElement, content: HTMLElement | string): void
```

컨테이너를 비우고 폴백 콘텐츠를 렌더링합니다.

### `mountParcel`

```ts
function mountParcel(options: ParcelOptions): Promise<Parcel>
```

라우팅과 독립적으로 앱을 DOM 요소에 마운트하여 Parcel을 생성합니다.

### `createLifecycleRunner`

```ts
function createLifecycleRunner(options: LifecycleRunnerOptions): LifecycleRunner
```

MfeApp 라이프사이클 러너를 생성합니다. AppRegistry와 Parcel이 공유하는 상태 전환 로직을 캡슐화합니다.

### `createLifecycleHooks`

```ts
function createLifecycleHooks(options?: LifecycleHooksOptions): LifecycleHooks
```

라이프사이클 훅 매니저를 생성합니다. 글로벌 및 앱별 before/after 훅을 등록하고 실행합니다.

### `createPrefetch`

```ts
function createPrefetch(options: PrefetchOptions): PrefetchController
```

스마트 프리로딩 컨트롤러를 생성합니다. idle 전략은 requestIdleCallback을 사용하고, immediate 전략은 즉시 실행합니다.

### `withTimeout`

```ts
function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T>
```

비동기 함수에 타임아웃을 적용합니다. 지정 시간 내 완료되지 않으면 TimeoutError를 던집니다.

### `withRetry`

```ts
function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>
```

비동기 함수에 재시도를 적용합니다. 실패 시 지정 횟수까지 딜레이를 두고 재시도합니다.

### `withResilience`

```ts
function withResilience<T>(fn: () => Promise<T>, options: ResilienceOptions): Promise<T>
```

비동기 함수에 타임아웃과 재시도를 모두 적용합니다. 각 시도마다 독립적인 타임아웃이 적용됩니다.

### `createCircuitBreaker`

```ts
function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker
```

서킷 브레이커를 생성합니다. 연속 실패가 임계치에 도달하면 서킷을 열어 후속 요청을 즉시 차단하고, 쿨다운 후 단일 요청을 허용하여 복구를 확인합니다.

### `parseSemver`

```ts
function parseSemver(version: string): SemverParts
```

버전 문자열을 major, minor, patch로 파싱합니다.

### `compareVersions`

```ts
function compareVersions(a: string, b: string): -1 | 0 | 1
```

두 버전 문자열을 비교합니다.

### `satisfiesRange`

```ts
function satisfiesRange(version: string, range: string): boolean
```

버전이 주어진 범위를 충족하는지 확인합니다. `^`, `~`, `>=`, 정확한 매칭을 지원합니다.

### `createSharedModuleRegistry`

```ts
function createSharedModuleRegistry(): SharedModuleRegistry
```

공유 모듈 레지스트리를 생성합니다. 여러 MFE 앱이 등록한 공유 의존성의 버전을 협상하고, 최적 버전을 선택하여 단일 인스턴스를 공유합니다.

### `createIntelligentPrefetch`

```ts
function createIntelligentPrefetch(options?: IntelligentPrefetchOptions): IntelligentPrefetchController
```

지능형 프리페치 컨트롤러를 생성합니다. 사용자 내비게이션 패턴을 학습하여 다음에 방문할 가능성이 높은 앱을 우선적으로 프리페치합니다.

### `createResourceLoader`

```ts
function createResourceLoader(options?: ResourceLoaderOptions): ResourceLoader
```

리소스 로딩 파이프라인을 생성합니다. fetch 인터셉터와 JS/CSS 트랜스포머를 등록하여 리소스 로딩을 제어합니다.

### `createNamespaceGuard`

```ts
function createNamespaceGuard(options?: NamespaceGuardOptions): NamespaceGuard
```

전역 리소스에 대한 네임스페이스 충돌 가드를 생성합니다. 공유 모듈, 이벤트, 상태 키 등의 소유권을 추적하여 의도하지 않은 덮어쓰기를 방지합니다.

## 타입

### `LoaderOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `importMapUrl` | `string` | Import map JSON을 가져올 URL |
| `inlineImportMap` | `ImportMap` | 인라인 import map 객체 |
| `injectPreload` | `boolean` | modulepreload 힌트 자동 주입 여부 |

`importMapUrl` 또는 `inlineImportMap` 중 하나를 제공해야 합니다.

### `RegisterAppOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `name` | `string` | 앱 이름 (import map 스펙파이어) |
| `activeWhen` | `string \| string[] \| (location: Location) => boolean` | 활성 라우트 매칭 |
| `container` | `string` | 마운트 대상 DOM 셀렉터 |
| `errorBoundary` | `ErrorBoundaryOptions` | 앱별 에러 바운더리 옵션 |

### `AppRegistryOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `importMap` | `ImportMap` | bare specifier를 URL로 해석하는 import map |
| `errorBoundary` | `ErrorBoundaryOptions` | 글로벌 에러 바운더리 옵션 |

### `ErrorBoundaryOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `fallback` | `(appName: string, error: Error) => HTMLElement \| string` | 폴백 UI 생성 함수 |
| `retryLimit` | `number` | 최대 자동 재시도 횟수 (기본값: 3) |
| `retryDelay` | `number` | 재시도 간 딜레이 ms (기본값: 1000) |
| `onError` | `(appName: string, error: Error) => void` | 에러 발생 시 콜백 |

### `AppStatusChangeEvent`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `appName` | `string` | 앱 이름 |
| `from` | `MfeAppStatus` | 이전 상태 |
| `to` | `MfeAppStatus` | 새 상태 |

### `RouterOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `mode` | `'history' \| 'hash'` | 라우트 변경 감지 방식 |
| `baseUrl` | `string` | 모든 라우트에 앞에 붙는 기본 경로 |
| `onNoMatch` | `NoMatchHandler` | 등록된 앱이 없을 때 호출되는 핸들러 |

### `RouteContext`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `pathname` | `string` | URL 경로명 |
| `search` | `string` | 쿼리 문자열 |
| `hash` | `string` | 해시 |

### `ParcelOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `app` | `MfeApp \| (() => Promise<MfeApp>)` | 마운트할 MfeApp 또는 로더 |
| `domElement` | `HTMLElement` | 마운트 대상 DOM 요소 |
| `props` | `Record<string, unknown>` | 앱에 전달할 초기 props |

### `RetryOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `retries` | `number` | 최대 재시도 횟수 |
| `delay` | `number` | 재시도 간 딜레이 ms |

### `ResilienceOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `retries` | `number` | 최대 재시도 횟수 |
| `delay` | `number` | 재시도 간 딜레이 ms |
| `timeout` | `number` | 시도당 타임아웃 ms |

### `CircuitBreakerOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `failureThreshold` | `number` | OPEN 전환까지의 연속 실패 횟수 |
| `cooldownMs` | `number` | OPEN에서 HALF_OPEN으로 전환하기까지의 대기 시간 ms |
| `onStateChange` | `(from: CircuitState, to: CircuitState) => void` | 상태 전환 콜백 |

### `SemverParts`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `major` | `number` | 메이저 버전 |
| `minor` | `number` | 마이너 버전 |
| `patch` | `number` | 패치 버전 |

### `SharedModuleConfig`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `name` | `string` | 모듈 이름 (예: "react") |
| `version` | `string` | 제공 버전 |
| `requiredVersion` | `string` | 필수 버전 범위 |
| `singleton` | `boolean` | 단일 인스턴스 강제 여부 |
| `eager` | `boolean` | 즉시 로딩 여부 |
| `strictVersion` | `boolean` | 버전 불일치 시 에러 throw 여부 |
| `factory` | `() => Promise<unknown>` | 모듈 인스턴스 생성 팩토리 |
| `fallback` | `() => Promise<unknown>` | 버전 협상 실패 시 사용할 팩토리 |
| `subpaths` | `Record<string, () => Promise<unknown>>` | 서브패스 exports 매핑 |
| `from` | `string` | 등록한 앱 이름 |

### `IntelligentPrefetchOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `maxHistory` | `number` | 최대 내비게이션 기록 수 (기본값: 200) |
| `threshold` | `number` | 프리페치 트리거 확률 임계치 (기본값: 0.1) |
| `maxPrefetch` | `number` | 최대 프리페치 앱 수 (기본값: 3) |
| `persistKey` | `string` | localStorage 키. 브라우저 세션 간 데이터를 유지합니다 |

### `ResourceLoaderOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `enableCache` | `boolean` | 캐싱 활성화 여부 (기본값: true) |
| `cacheTtl` | `number` | 캐시 TTL ms (기본값: 5분) |
| `fetchTimeout` | `number` | fetch 타임아웃 ms (기본값: 30초) |

### `NamespaceGuardOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `onConflict` | `'warn' \| 'error' \| 'skip'` | 충돌 감지 시 동작 (기본값: 'warn') |
| `allowedSharedKeys` | `string[]` | 충돌을 허용하는 공유 키 목록 |
