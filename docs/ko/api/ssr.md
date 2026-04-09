# @esmap/ssr

esmap 서버 사이드 렌더링 지원입니다. 마이크로 프론트엔드 애플리케이션을 서버에서 렌더링하여 초기 로딩 성능과 SEO를 개선합니다.

## 설치

```bash
pnpm add @esmap/ssr
```

## 함수

### `createImportMapResolver`

```ts
function createImportMapResolver(importMap: ImportMap): ImportMapResolver;
```

서버 사이드 import map 리졸버를 생성합니다. W3C import map 해석 알고리즘을 구현하여 브라우저에서 사용하는 동일한 import map으로 서버에서 모듈을 해석합니다.

### `createServerModuleLoader`

```ts
function createServerModuleLoader(options: ServerModuleLoaderOptions): ServerModuleLoader;
```

서버 사이드 모듈 로더를 생성합니다. import map 리졸버로 bare specifier를 해석하고 native fetch로 모듈을 가져옵니다. `externals`에 지정된 스펙파이어는 로컬 node_modules에서 해석됩니다.

### `createSsrRenderer`

```ts
function createSsrRenderer(options: SsrRendererOptions): SsrRenderer;
```

MFE 모듈을 서버에서 로드하고 HTML로 렌더링하는 SSR 렌더러를 생성합니다. 모듈은 HTML 마크업을 반환하는 `ssrRender` 함수를 export해야 합니다.

### `renderReactToString`

```ts
function renderReactToString<P extends Record<string, unknown>>(
  options: ReactSsrOptions<P>,
): string;
```

React 컴포넌트 트리를 서버에서 HTML 문자열로 렌더링합니다.

### `createReactSsrRender`

```ts
function createReactSsrRender<P extends Record<string, unknown>>(
  options: Omit<ReactSsrOptions<P>, 'props'>,
): (props?: P) => string;
```

React MFE 앱의 `ssrRender` 함수를 생성합니다. `@esmap/react`의 `createReactMfeApp`과 쌍으로 사용하여 동일한 MFE 엔트리 모듈에 SSR 기능을 추가합니다.

### `composeHtml`

```ts
function composeHtml(options: HtmlComposerOptions): string;
```

import map, preload 힌트, 렌더링된 앱 마크업, hydration 스크립트를 포함한 완전한 HTML 문서 셸을 구성합니다.

## 타입

### `ImportMapResolver`

| 메서드    | 시그니처                                              | 설명                             |
| --------- | ----------------------------------------------------- | -------------------------------- |
| `resolve` | `(specifier: string, referrerUrl?: string) => string` | bare specifier를 절대 URL로 해석 |

### `ServerModuleLoader`

| 메서드       | 시그니처                                  | 설명                                  |
| ------------ | ----------------------------------------- | ------------------------------------- |
| `load`       | `<T>(specifier: string) => Promise<T>`    | bare specifier 또는 URL로 모듈을 로드 |
| `prefetch`   | `(specifiers: string[]) => Promise<void>` | 모듈을 캐시에 미리 로드               |
| `clearCache` | `() => void`                              | 모듈 캐시를 초기화                    |

### `ServerModuleLoaderOptions`

| 속성        | 타입                     | 설명                                                    |
| ----------- | ------------------------ | ------------------------------------------------------- |
| `resolver`  | `ImportMapResolver`      | bare specifier용 import map 리졸버                      |
| `fetchFn`   | `typeof fetch`           | 커스텀 fetch 함수 (기본값: globalThis.fetch)            |
| `cacheTtl`  | `number`                 | 캐시 TTL ms (0 = 만료 없음, 기본값: 0)                  |
| `externals` | `Record<string, string>` | 원격 fetch 대신 로컬 node_modules에서 해석할 스펙파이어 |

### `SsrRendererOptions`

| 속성           | 타입                     | 설명                                      |
| -------------- | ------------------------ | ----------------------------------------- |
| `importMap`    | `ImportMap`              | 모듈 해석용 import map                    |
| `moduleLoader` | `ServerModuleLoader`     | 사전 구성된 모듈 로더 (생략 시 자동 생성) |
| `externals`    | `Record<string, string>` | 로컬에서 해석할 스펙파이어                |

### `SsrRenderResult`

| 속성          | 타입        | 설명                                  |
| ------------- | ----------- | ------------------------------------- |
| `html`        | `string`    | 렌더링된 HTML 마크업                  |
| `head`        | `string`    | 추가 head 요소 (스타일, 메타 태그 등) |
| `importMap`   | `ImportMap` | HTML 문서에 임베드할 import map       |
| `preloadUrls` | `string[]`  | modulepreload 힌트로 추가할 URL       |

### `RenderAppOptions`

| 속성    | 타입                      | 설명                          |
| ------- | ------------------------- | ----------------------------- |
| `props` | `Record<string, unknown>` | 앱에 전달할 props             |
| `url`   | `string`                  | 현재 URL 경로 (라우트 매칭용) |

### `ReactSsrOptions`

| 속성            | 타입                                     | 설명                         |
| --------------- | ---------------------------------------- | ---------------------------- |
| `rootComponent` | `ComponentType<P>`                       | 렌더링할 루트 React 컴포넌트 |
| `wrapWith`      | `ComponentType<{ children: ReactNode }>` | 래퍼 컴포넌트 (예: Provider) |
| `props`         | `P`                                      | 루트 컴포넌트에 전달할 props |

### `HtmlComposerOptions`

| 속성              | 타입        | 설명                                       |
| ----------------- | ----------- | ------------------------------------------ |
| `importMap`       | `ImportMap` | script 태그로 임베드할 import map          |
| `appHtml`         | `string`    | 렌더링된 앱 HTML 마크업                    |
| `head`            | `string`    | 추가 head 콘텐츠                           |
| `bodyAttrs`       | `string`    | 추가 body 속성                             |
| `preloadUrls`     | `string[]`  | modulepreload link 태그용 URL              |
| `hydrationScript` | `string`    | body 끝에 포함할 인라인 hydration 스크립트 |
| `containerId`     | `string`    | 컨테이너 요소 id (기본값: "root")          |
| `title`           | `string`    | 페이지 제목                                |
| `lang`            | `string`    | html 태그 언어 속성 (기본값: "en")         |
