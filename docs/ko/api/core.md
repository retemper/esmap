# @esmap/core

esmap의 모든 하위 시스템 -- 레지스트리, 라우터, 라이프사이클 훅, 성능 추적, 프리페칭, 공유 모듈 -- 을 연결하고 확장을 위한 플러그인 시스템을 제공하는 통합 커널입니다.

## 설치

```bash
pnpm add @esmap/core
```

`@esmap/core`는 `@esmap/runtime`, `@esmap/monitor`, `@esmap/shared`, `@esmap/guard`, `@esmap/sandbox`, `@esmap/communication`, `@esmap/devtools`에 의존합니다. 이 패키지들은 의존성으로 자동 설치됩니다.

## 함수

### `createEsmap`

통합 커널 인스턴스를 생성합니다.

```ts
function createEsmap(options: EsmapOptions): EsmapInstance;
```

`AppRegistry`, `Router`, `LifecycleHooks`, `PerfTracker`, `PrefetchController`, `SharedModuleRegistry`를 생성하고 연결합니다. `config.apps`의 모든 앱을 등록하고, 플러그인을 순서대로 설치한 뒤, `start()`와 `destroy()` 메서드를 가진 `EsmapInstance`를 반환합니다.

### `installAutoPerf`

자동 계측을 위해 `PerfTracker`를 `LifecycleHooks`에 연결합니다.

```ts
function installAutoPerf(hooks: LifecycleHooks, perf: PerfTracker): void;
```

추적 대상 라이프사이클 단계(`load`, `bootstrap`, `mount`, `unmount`, `update`)에 before/after 훅을 등록하여 `perf.markStart`와 `perf.markEnd`를 자동 호출합니다.

### `installPlugins`

플러그인 목록을 순서대로 설치하고 정리 함수를 수집합니다.

```ts
function installPlugins(
  plugins: readonly EsmapPlugin[],
  ctx: PluginContext,
): readonly PluginCleanup[];
```

중복 플러그인 이름이 감지되면 에러를 발생시킵니다.

### `runCleanups`

정리 함수를 역순으로 실행합니다.

```ts
function runCleanups(cleanups: readonly PluginCleanup[]): Promise<void>;
```

의존성 문제를 방지하기 위해 설치 역순으로 정리를 실행합니다.

## 내장 플러그인

### `guardPlugin`

CSS 스코핑과 전역 오염 감지.

```ts
function guardPlugin(options?: GuardPluginOptions): EsmapPlugin;
```

앱 마운트 시 자동으로 CSS 격리와 전역 가드를 적용하고, 언마운트 시 정리합니다.

### `sandboxPlugin`

프록시 기반 JavaScript 샌드박스.

```ts
function sandboxPlugin(options?: SandboxPluginOptions): EsmapPlugin;
```

마운트 시 앱별 `ProxySandbox`를 활성화하고, 언마운트 시 비활성화합니다.

### `communicationPlugin`

타입 안전 앱 간 통신.

```ts
function communicationPlugin<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
>(
  options?: CommunicationPluginOptions<TEvents, TState>,
): { readonly plugin: EsmapPlugin; readonly resources: CommunicationResources<TEvents, TState> };
```

`{ plugin, resources }`를 반환하며, `resources`는 `EventBus`와 `GlobalState`에 대한 접근을 제공합니다.

### `keepAlivePlugin`

라우트 전환 시 DOM 상태 보존.

```ts
function keepAlivePlugin(options: KeepAlivePluginOptions): EsmapPlugin;
```

언마운트 대신 컨테이너를 숨기고(FROZEN 상태), 재방문 시 즉시 복원합니다. `maxCached` 초과 시 LRU 방식으로 제거합니다.

### `domIsolationPlugin`

DOM 쿼리 메서드를 앱 컨테이너로 스코핑.

```ts
function domIsolationPlugin(options?: DomIsolationPluginOptions): EsmapPlugin;
```

마운트 시 `document.querySelector` 등의 메서드를 앱 컨테이너로 스코핑합니다.

### `intelligentPrefetchPlugin`

네비게이션 패턴 기반 예측 프리페칭.

```ts
function intelligentPrefetchPlugin(
  options?: IntelligentPrefetchPluginOptions,
): IntelligentPrefetchPluginResult;
```

`{ plugin, controller }`를 반환하며, `controller`는 학습된 네비게이션 우선순위에 대한 접근을 제공합니다.

## 타입

### `EsmapOptions`

```ts
interface EsmapOptions {
  readonly config: EsmapConfig;
  readonly importMap?: ImportMap;
  readonly router?: RouterOptions;
  readonly disablePerf?: boolean;
  readonly disableDevtools?: boolean;
  readonly plugins?: readonly EsmapPlugin[];
}
```

| 속성              | 타입                     | 설명                                                        |
| ----------------- | ------------------------ | ----------------------------------------------------------- |
| `config`          | `EsmapConfig`            | 앱 목록, 공유 의존성, CDN 베이스 등. **필수.**              |
| `importMap`       | `ImportMap`              | 인라인으로 로드하거나 URL에서 해석합니다.                   |
| `router`          | `RouterOptions`          | `baseUrl`, `onNoMatch` 등 라우터 설정.                      |
| `disablePerf`     | `boolean`                | 자동 성능 추적 비활성화. 기본값 `false`.                    |
| `disableDevtools` | `boolean`                | devtools 연동 비활성화. 기본값 `false`.                     |
| `plugins`         | `readonly EsmapPlugin[]` | 설치 순서대로 실행되며, `destroy()` 시 역순으로 정리됩니다. |

### `EsmapInstance`

```ts
interface EsmapInstance {
  readonly registry: AppRegistry;
  readonly router: Router;
  readonly hooks: LifecycleHooks;
  readonly perf: PerfTracker;
  readonly prefetch: PrefetchController;
  readonly sharedModules: SharedModuleRegistry;
  start(): Promise<void>;
  destroy(): Promise<void>;
}
```

### `EsmapPlugin`

```ts
interface EsmapPlugin {
  readonly name: string;
  install(ctx: PluginContext): PluginCleanup | void;
}
```

### `PluginContext`

```ts
interface PluginContext {
  readonly registry: AppRegistry;
  readonly router: Router;
  readonly hooks: LifecycleHooks;
  readonly perf: PerfTracker;
  readonly prefetch: PrefetchController;
}
```

### `PluginCleanup`

```ts
type PluginCleanup = () => void | Promise<void>;
```

### `GuardPluginOptions`

```ts
interface GuardPluginOptions {
  readonly cssStrategy?: 'attribute' | 'shadow';
  readonly observeDynamic?: boolean;
  readonly detectGlobalPollution?: boolean;
  readonly globalAllowList?: readonly string[];
  readonly onGlobalViolation?: (appName: string, property: string) => void;
}
```

| 속성                    | 타입                                          | 기본값        | 설명                                      |
| ----------------------- | --------------------------------------------- | ------------- | ----------------------------------------- |
| `cssStrategy`           | `'attribute' \| 'shadow'`                     | `'attribute'` | CSS 격리 전략.                            |
| `observeDynamic`        | `boolean`                                     | `true`        | MutationObserver로 동적 스타일 추가 감시. |
| `detectGlobalPollution` | `boolean`                                     | `true`        | 전역 오염 감지 활성화.                    |
| `globalAllowList`       | `readonly string[]`                           | `[]`          | 오염 감지에서 제외할 속성 목록.           |
| `onGlobalViolation`     | `(appName: string, property: string) => void` | —             | 오염 감지 시 호출되는 콜백.               |

### `SandboxPluginOptions`

```ts
interface SandboxPluginOptions {
  readonly allowList?: readonly PropertyKey[];
  readonly exclude?: readonly string[];
}
```

| 속성        | 타입                     | 기본값              | 설명                              |
| ----------- | ------------------------ | ------------------- | --------------------------------- |
| `allowList` | `readonly PropertyKey[]` | ProxySandbox 기본값 | 프록시 샌드박스 허용 목록.        |
| `exclude`   | `readonly string[]`      | `[]`                | 샌드박싱에서 제외할 앱 이름 목록. |

### `CommunicationPluginOptions`

```ts
interface CommunicationPluginOptions<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly maxEventHistory?: number;
  readonly initialState?: TState;
  readonly onEventError?: (event: string, error: unknown) => void;
  readonly _events?: TEvents;
}
```

| 속성              | 타입                                      | 기본값 | 설명                                      |
| ----------------- | ----------------------------------------- | ------ | ----------------------------------------- |
| `maxEventHistory` | `number`                                  | `100`  | 유지할 최대 이벤트 히스토리 수.           |
| `initialState`    | `TState`                                  | `{}`   | 초기 전역 상태 값.                        |
| `onEventError`    | `(event: string, error: unknown) => void` | —      | 이벤트 핸들러 에러 콜백.                  |
| `_events`         | `TEvents`                                 | —      | 타입 추론용 이벤트 맵 (런타임 영향 없음). |

### `CommunicationResources`

```ts
interface CommunicationResources<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly eventBus: EventBus<TEvents>;
  readonly globalState: GlobalState<TState>;
}
```

### `KeepAlivePluginOptions`

```ts
interface KeepAlivePluginOptions {
  readonly apps: readonly string[];
  readonly maxCached?: number;
}
```

| 속성        | 타입                | 기본값     | 설명                                                         |
| ----------- | ------------------- | ---------- | ------------------------------------------------------------ |
| `apps`      | `readonly string[]` | —          | keep-alive를 적용할 앱 이름 목록. **필수.**                  |
| `maxCached` | `number`            | `Infinity` | 최대 캐시 앱 수. 초과 시 가장 오래된 FROZEN 앱이 제거됩니다. |

### `DomIsolationPluginOptions`

```ts
interface DomIsolationPluginOptions {
  readonly exclude?: readonly string[];
  readonly globalSelectors?: readonly string[];
}
```

| 속성              | 타입                | 기본값 | 설명                                    |
| ----------------- | ------------------- | ------ | --------------------------------------- |
| `exclude`         | `readonly string[]` | `[]`   | DOM 격리에서 제외할 앱 이름 목록.       |
| `globalSelectors` | `readonly string[]` | `[]`   | 컨테이너 스코핑을 우회하는 셀렉터 패턴. |

### `IntelligentPrefetchPluginOptions`

```ts
interface IntelligentPrefetchPluginOptions extends IntelligentPrefetchOptions {
  readonly prefetchDelay?: number;
  readonly excludeContainers?: readonly string[];
}
```

| 속성                | 타입                | 기본값 | 설명                                           |
| ------------------- | ------------------- | ------ | ---------------------------------------------- |
| `prefetchDelay`     | `number`            | `1000` | 네비게이션 후 프리페칭 시작까지 대기 시간(ms). |
| `excludeContainers` | `readonly string[]` | `[]`   | 현재 앱 판단 시 제외할 컨테이너 셀렉터.        |

### `IntelligentPrefetchPluginResult`

```ts
interface IntelligentPrefetchPluginResult {
  readonly plugin: EsmapPlugin;
  readonly controller: IntelligentPrefetchController;
}
```
