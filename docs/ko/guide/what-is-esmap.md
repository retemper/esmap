# esmap이란?

**esmap**은 [W3C Import Maps](https://wicg.github.io/import-maps/) 위에 구축된 마이크로 프론트엔드 프레임워크입니다. Import Maps는 모듈 해석을 위한 브라우저 네이티브 표준입니다.

대부분의 마이크로 프론트엔드 솔루션은 특정 번들러에 종속되거나 커스텀 모듈 프로토콜을 만들어냅니다. esmap은 다른 접근 방식을 취합니다. MFE는 브라우저가 네이티브로 해석하는 ESM 모듈일 뿐입니다.

## 비교

|                     | Module Federation | single-spa     | qiankun          | esmap              |
| ------------------- | ----------------- | -------------- | ---------------- | ------------------ |
| **표준**            | Webpack 전용      | 커스텀 로더    | single-spa 래핑  | W3C Import Maps    |
| **번들러**          | Webpack만 가능    | 모두 가능      | 모두 가능        | 모두 가능          |
| **모듈 형식**       | Webpack chunks    | SystemJS / ESM | SystemJS         | 네이티브 ESM       |
| **JS 격리**         | 없음              | 없음           | Proxy sandbox    | Proxy + Snapshot   |
| **CSS 격리**        | 없음              | 없음           | Shadow DOM       | Scoped + detection |
| **배포 서버**       | 없음              | 없음           | 없음             | 내장               |
| **개발자 도구**     | 없음              | Inspector      | 없음             | 내장               |
| **배포 결합도**     | 빌드 시점         | 빌드 시점      | 빌드 시점        | 배포 시점          |

## 아키텍처

```
Browser
┌──────────────────────────────────────────────────────────────┐
│  runtime ──── react        sandbox         guard             │
│  (loader,     (adapter,    (JS isolation)  (CSS isolation)   │
│   router,      hooks,                                        │
│   registry)    Parcel)                                        │
│       │           │                                           │
│  communication    devtools         monitor                    │
│  (event bus,      (import map      (perf tracking)            │
│   global state)    overrides)                                 │
└──────────────────────────────────────────────────────────────┘

Build & Server
┌──────────────────────────────────────────────────────────────┐
│  cli            vite-plugin     server          compat       │
│  (generate,     (manifest,      (deploy API,    (MF →        │
│   deploy)        externals)      storage)        import map) │
│                       │                                       │
│  config (schema, loading, validation)                         │
└──────────────────────────────────────────────────────────────┘

Foundation
┌──────────────────────────────────────────────────────────────┐
│  shared (types, errors, import map utilities)                 │
│  test (mock apps, test registry, matchers)                    │
└──────────────────────────────────────────────────────────────┘
```

**의존성 방향:** Application → `react` → `runtime` → `shared`.

`sandbox`, `guard`, `communication`, `monitor` 같은 패키지는 **교차 의존성이 없습니다** — 필요한 것만 사용하세요.

## 패키지

### 브라우저

| 패키지                 | 크기 (gzip) | 설명                                                    |
| ---------------------- | ----------- | ------------------------------------------------------- |
| `@esmap/runtime`       | 8.2 kB      | Import map 로더, 앱 레지스트리, 라우터, 에러 바운더리, 프리페치 |
| `@esmap/react`         | 1.5 kB      | React 어댑터 — `createReactMfeApp()`, 훅, `<EsmapParcel>` |
| `@esmap/communication` | 1.1 kB      | 타입 안전한 이벤트 버스, 글로벌 상태, 앱 props           |
| `@esmap/sandbox`       | 1.9 kB      | Proxy 샌드박스, Snapshot 샌드박스                        |
| `@esmap/guard`         | 2.7 kB      | CSS 스코핑, 글로벌 오염 감지                             |
| `@esmap/devtools`      | 1.0 kB      | 로컬 개발을 위한 import map 오버라이드                   |
| `@esmap/monitor`       | 1.1 kB      | 라이프사이클 단계별 성능 추적                            |

### 빌드 & 서버

| 패키지               | 설명                                                       |
| -------------------- | ---------------------------------------------------------- |
| `@esmap/cli`         | CLI — generate, deploy, rollback                           |
| `@esmap/vite-plugin` | Vite 플러그인 — 매니페스트 생성, ESM externals             |
| `@esmap/server`      | Import map 서버 — 배포 API, 롤백, 이력 관리               |
| `@esmap/config`      | 설정 스키마, 로딩, 유효성 검사                             |
| `@esmap/compat`      | 마이그레이션 레이어 — Webpack Module Federation에서 import maps로 |
