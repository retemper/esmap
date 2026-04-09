# 통합 커널

`@esmap/core`는 프레임워크의 모든 하위 시스템 -- 레지스트리, 라우터, 라이프사이클 훅, 성능 추적, 프리페칭, 공유 모듈, 플러그인 -- 을 하나의 인스턴스로 연결하는 단일 진입점 `createEsmap`을 제공합니다.

## 기본 사용법

```ts
import { createEsmap } from '@esmap/core';

const esmap = createEsmap({
  config: {
    apps: {
      header: { path: '/', container: '#header' },
      dashboard: { path: '/dashboard', container: '#main' },
      settings: { path: '/settings', container: '#main' },
    },
    shared: {
      react: { requiredVersion: '^18.0.0', singleton: true, eager: true },
      'react-dom': { requiredVersion: '^18.0.0', singleton: true },
    },
  },
  importMap: {
    imports: {
      header: '/apps/header/esmap-manifest.json',
      dashboard: '/apps/dashboard/esmap-manifest.json',
      settings: '/apps/settings/esmap-manifest.json',
    },
  },
  router: { baseUrl: '/' },
});

await esmap.start();
```

## `createEsmap`이 하는 일

`createEsmap(options)` 호출 시 다음 순서로 동작합니다:

1. 전달된 import map으로 **AppRegistry**를 생성하고, `config.apps`의 모든 앱을 등록합니다.
2. 레지스트리에 연결된 **Router**를 생성합니다.
3. **LifecycleHooks**를 생성하고, 레지스트리 상태 전이(load, bootstrap, mount, unmount)에 연결합니다.
4. **PerfTracker**를 생성하고, `disablePerf`가 설정되지 않은 경우 모든 라이프사이클 단계에 자동 성능 계측을 설치합니다.
5. 앱 목록과 import map으로 **PrefetchController**를 생성합니다.
6. **SharedModuleRegistry**를 생성하고, `config.shared`의 모든 의존성을 등록합니다.
7. `disableDevtools`가 설정되지 않은 경우 **devtools**를 설치합니다.
8. **플러그인**을 순서대로 설치하고, 정리 함수를 수집합니다.
9. `EsmapInstance`를 반환합니다.

## EsmapOptions

| 속성 | 타입 | 설명 |
|---|---|---|
| `config` | `EsmapConfig` | 앱 목록, 공유 의존성, CDN 베이스 등. **필수.** |
| `importMap` | `ImportMap` | 인라인으로 로드하거나 URL에서 해석합니다. |
| `router` | `RouterOptions` | `baseUrl`, `onNoMatch` 등 라우터 설정. |
| `disablePerf` | `boolean` | 자동 성능 추적 비활성화. 기본값 `false`. |
| `disableDevtools` | `boolean` | devtools 연동 비활성화. 기본값 `false`. |
| `plugins` | `EsmapPlugin[]` | 설치 순서대로 실행되며, `destroy()` 시 역순으로 정리됩니다. |

## EsmapInstance

반환된 인스턴스는 모든 하위 시스템과 두 개의 라이프사이클 메서드를 노출합니다:

| 속성 | 타입 | 설명 |
|---|---|---|
| `registry` | `AppRegistry` | 앱 등록, 로드, 마운트/언마운트. |
| `router` | `Router` | URL 기반 앱 활성화. |
| `hooks` | `LifecycleHooks` | load, bootstrap, mount, unmount, update에 대한 before/after 훅. |
| `perf` | `PerfTracker` | 자동 라이프사이클 계측. |
| `prefetch` | `PrefetchController` | 리소스 프리페칭 컨트롤러. |
| `sharedModules` | `SharedModuleRegistry` | MFE 간 의존성 공유 및 버전 협상. |
| `start()` | `Promise<void>` | eager 공유 모듈 로드를 대기하고, 프리페칭을 시작하고, 라우터를 시작하여 초기 라우트를 처리합니다. |
| `destroy()` | `Promise<void>` | 라우터와 프리페처를 중지하고, 플러그인 정리를 역순으로 실행하고, 모든 앱을 언마운트하고, 성능 데이터를 초기화합니다. |

## 플러그인 시스템

플러그인은 `PluginContext`를 통해 모든 하위 시스템에 접근하여 프레임워크를 확장합니다.

```ts
import type { EsmapPlugin, PluginContext, PluginCleanup } from '@esmap/core';

const loggingPlugin: EsmapPlugin = {
  name: 'my:logging',

  install(ctx: PluginContext): PluginCleanup {
    ctx.hooks.afterEach('mount', (hookCtx) => {
      console.log(`${hookCtx.appName} mounted`);
    });

    ctx.hooks.afterEach('unmount', (hookCtx) => {
      console.log(`${hookCtx.appName} unmounted`);
    });

    return () => {
      console.log('logging plugin cleaned up');
    };
  },
};

const esmap = createEsmap({
  config,
  plugins: [loggingPlugin],
});
```

`PluginContext`는 `registry`, `router`, `hooks`, `perf`, `prefetch`에 대한 접근을 제공합니다. `install` 메서드가 정리 함수를 반환하면, `destroy()` 시 자동으로 실행됩니다. 정리 함수는 의존성 문제를 방지하기 위해 설치 역순으로 실행됩니다.

중복된 플러그인 이름은 설치 시점에 에러를 발생시킵니다.

## 내장 플러그인

모든 내장 플러그인은 `@esmap/core`에서 export됩니다.

### `guardPlugin`

CSS 스코핑과 전역 오염 감지. 마운트 시 자동으로 격리를 적용하고 언마운트 시 정리합니다.

```ts
import { createEsmap, guardPlugin } from '@esmap/core';

const esmap = createEsmap({
  config,
  plugins: [
    guardPlugin({
      cssStrategy: 'attribute',    // 'attribute' | 'shadow'
      observeDynamic: true,        // 동적 스타일 추가 감시
      detectGlobalPollution: true, // window 속성 오염 감지
      globalAllowList: ['__MY_GLOBAL__'],
      onGlobalViolation: (appName, property) => {
        console.warn(`${appName} polluted window.${property}`);
      },
    }),
  ],
});
```

### `sandboxPlugin`

프록시 기반 JavaScript 샌드박스. 마운트 시 앱별로 `ProxySandbox`를 활성화하고 언마운트 시 비활성화하여, `window` 속성 수정을 격리합니다.

```ts
import { createEsmap, sandboxPlugin } from '@esmap/core';

const esmap = createEsmap({
  config,
  plugins: [
    sandboxPlugin({
      allowList: ['__webpack_public_path__'],
      exclude: ['shell-app'],  // 신뢰할 수 있는 앱은 샌드박싱 제외
    }),
  ],
});
```

### `communicationPlugin`

`EventBus`와 `GlobalState`를 통한 타입 안전 앱 간 통신. `{ plugin, resources }`를 반환하여 플러그인 라이프사이클 외부에서도 이벤트 버스와 상태에 접근할 수 있습니다.

```ts
import { createEsmap, communicationPlugin } from '@esmap/core';

interface MyEvents {
  'user:login': { id: string };
  'user:logout': undefined;
}

interface MyState {
  user: { name: string } | null;
}

const comm = communicationPlugin<MyEvents, MyState>({
  maxEventHistory: 50,
  initialState: { user: null },
  onEventError: (event, error) => console.error(event, error),
});

const esmap = createEsmap({
  config,
  plugins: [comm.plugin],
});

// 어디서든 사용 가능
comm.resources.eventBus.emit('user:login', { id: '123' });
comm.resources.globalState.set('user', { name: 'Alice' });
```

### `keepAlivePlugin`

라우트 전환 시 지정된 앱의 DOM 상태를 보존합니다. 언마운트 대신 컨테이너를 숨기고(FROZEN 상태), 재방문 시 즉시 복원합니다. 스크롤 위치, 폼 값, 컴포넌트 상태가 모두 보존됩니다.

```ts
import { createEsmap, keepAlivePlugin } from '@esmap/core';

const esmap = createEsmap({
  config,
  plugins: [
    keepAlivePlugin({
      apps: ['dashboard', 'settings'],  // 필수
      maxCached: 3,  // 초과 시 LRU 방식으로 제거; 기본값 Infinity
    }),
  ],
});
```

### `domIsolationPlugin`

마운트 시 `document.querySelector` 등 DOM 쿼리 메서드를 앱 컨테이너로 스코핑합니다. 앱이 자신의 경계 밖 요소를 실수로 조회하는 것을 방지합니다.

```ts
import { createEsmap, domIsolationPlugin } from '@esmap/core';

const esmap = createEsmap({
  config,
  plugins: [
    domIsolationPlugin({
      exclude: ['gnb'],  // 전체 document 접근이 필요한 앱
      globalSelectors: ['#global-modal', '[data-esmap-global]'],
    }),
  ],
});
```

### `intelligentPrefetchPlugin`

네비게이션 패턴 기반 예측 프리페칭. 라우트 전환을 기록하고, 다음에 방문할 가능성이 높은 앱을 프리페치합니다. `{ plugin, controller }`를 반환하여 외부에서 학습 데이터에 접근할 수 있습니다.

```ts
import { createEsmap, intelligentPrefetchPlugin } from '@esmap/core';

const prefetch = intelligentPrefetchPlugin({
  prefetchDelay: 1000,  // 네비게이션 후 프리페칭까지 대기 시간(ms)
  excludeContainers: ['#header'],  // 현재 앱 판단 시 제외할 컨테이너
});

const esmap = createEsmap({
  config,
  plugins: [prefetch.plugin],
});

// 학습된 우선순위 조회
const priorities = prefetch.controller.getPriorities('dashboard');
```

## 플러그인 조합

플러그인은 나열된 순서대로 실행됩니다. 격리 플러그인을 통신 플러그인보다 먼저 배치하여, 이벤트 발생 시 샌드박스가 활성화된 상태를 보장하세요.

```ts
import {
  createEsmap,
  guardPlugin,
  sandboxPlugin,
  communicationPlugin,
  keepAlivePlugin,
  domIsolationPlugin,
  intelligentPrefetchPlugin,
} from '@esmap/core';

const comm = communicationPlugin({ initialState: { theme: 'light' } });
const prefetch = intelligentPrefetchPlugin({ prefetchDelay: 2000 });

const esmap = createEsmap({
  config,
  importMap,
  plugins: [
    guardPlugin({ cssStrategy: 'attribute' }),
    sandboxPlugin({ exclude: ['shell'] }),
    domIsolationPlugin({ exclude: ['shell'] }),
    comm.plugin,
    keepAlivePlugin({ apps: ['dashboard'], maxCached: 5 }),
    prefetch.plugin,
  ],
});

await esmap.start();
```

## 정리

`destroy()`를 호출하여 완전히 정리합니다:

```ts
await esmap.destroy();
```

라우터와 프리페처를 중지하고, 모든 플러그인 정리를 설치 역순으로 실행하고, 모든 앱을 언마운트하고, 성능 데이터를 초기화합니다.
