---
description: '@esmap/cli API 레퍼런스 — 매니페스트 생성, 배포, 롤백 명령어.'
---

# @esmap/cli

esmap 커맨드라인 인터페이스입니다. 새로운 마이크로 프론트엔드 스캐폴딩 생성, import map 배포, 이전 버전으로의 롤백 명령을 제공합니다.

## 설치

```bash
pnpm add -D @esmap/cli
```

## 프로그래매틱 API

### `generateImportMap`

```ts
function generateImportMap(input: GenerateInput): GenerateResult;
```

매니페스트 정보를 기반으로 import map을 생성합니다.

### `analyzeDependencyConflicts`

```ts
function analyzeDependencyConflicts(
  apps: readonly AppDependencyDeclaration[],
): DependencyAnalysisResult;
```

여러 앱의 의존성 선언을 분석하여 버전 충돌을 감지합니다.

### `extractDeclarationsFromManifests`

```ts
function extractDeclarationsFromManifests(
  manifests: Record<string, unknown>[],
): AppDependencyDeclaration[];
```

매니페스트 파일들에서 의존성 선언을 추출합니다.

## 타입

### `GenerateInput`

| 속성        | 타입            | 설명                |
| ----------- | --------------- | ------------------- |
| `manifests` | `MfeManifest[]` | MFE 매니페스트 목록 |
| `cdnBase`   | `string`        | CDN 기본 URL        |

### `GenerateResult`

| 속성        | 타입        | 설명              |
| ----------- | ----------- | ----------------- |
| `importMap` | `ImportMap` | 생성된 import map |

### `AppDependencyDeclaration`

| 속성           | 타입                     | 설명               |
| -------------- | ------------------------ | ------------------ |
| `appName`      | `string`                 | 앱 이름            |
| `dependencies` | `Record<string, string>` | 의존성과 버전 범위 |

### `DependencyAnalysisResult`

| 속성        | 타입                   | 설명             |
| ----------- | ---------------------- | ---------------- |
| `conflicts` | `DependencyConflict[]` | 감지된 충돌 목록 |

## CLI 명령어

### `esmap generate`

매니페스트 파일들로부터 import map을 생성합니다.

```bash
esmap generate --manifests ./apps/*/esmap-manifest.json --cdn https://cdn.example.com
```

### `esmap deploy`

MFE 앱의 새 버전을 import map 서버에 배포합니다.

```bash
esmap deploy --service @flex/checkout --url https://cdn.example.com/checkout/v2.1.0/index.js
```

### `esmap rollback`

특정 MFE 앱을 이전 버전으로 롤백합니다.

```bash
esmap rollback --service @flex/checkout
```

### `esmap status`

현재 import map의 상태와 배포 히스토리를 조회합니다.

```bash
esmap status
```

### `esmap analyze`

여러 앱의 공유 의존성 버전 충돌을 분석합니다.

```bash
esmap analyze --manifests ./apps/*/esmap-manifest.json
```
