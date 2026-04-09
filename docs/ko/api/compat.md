# @esmap/compat

esmap 마이그레이션 호환성 레이어입니다. 기존 Webpack Module Federation 설정을 전면 재작성 없이 네이티브 import map으로 점진적으로 마이그레이션할 수 있는 어댑터와 유틸리티를 제공합니다.

## 설치

```bash
pnpm add @esmap/compat
```

## 함수

### `convertMfToImportMap`

```ts
function convertMfToImportMap(
  remotes: readonly MfRemoteConfig[],
  options: MfToImportMapOptions,
): ImportMap;
```

Module Federation 리모트 설정을 import map 형식으로 변환합니다. 각 리모트 앱의 scope를 bare specifier로 매핑하여 빌드 아티팩트 URL에 연결합니다.

### `convertMfSharedToImports`

```ts
function convertMfSharedToImports(
  shared: Record<string, string>,
  cdnBase: string,
): Record<string, string>;
```

Module Federation의 shared 설정을 import map의 imports 항목으로 변환합니다.

## 타입

### `MfRemoteConfig`

| 속성             | 타입                | 설명                                  |
| ---------------- | ------------------- | ------------------------------------- |
| `name`           | `string`            | 앱 이름 (예: "flexCheckout")          |
| `scope`          | `string`            | 스코프 이름 (예: "@flex/checkout")    |
| `remoteEntryUrl` | `string`            | 앱 엔트리 포인트 URL (remoteEntry.js) |
| `exposes`        | `MfExposedModule[]` | 노출된 모듈 목록                      |

### `MfExposedModule`

| 속성   | 타입     | 설명                                          |
| ------ | -------- | --------------------------------------------- |
| `key`  | `string` | 노출 키 (예: "./Button")                      |
| `path` | `string` | 파일 경로 (예: "./src/components/Button.tsx") |

### `MfToImportMapOptions`

| 속성          | 타입     | 설명                                                     |
| ------------- | -------- | -------------------------------------------------------- |
| `cdnBase`     | `string` | CDN 기본 URL                                             |
| `pathPattern` | `string` | 앱별 빌드 아티팩트 경로 패턴 (기본값: "{scope}/{entry}") |
