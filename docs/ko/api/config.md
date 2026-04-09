# @esmap/config

esmap 설정 유틸리티입니다. 설정 스키마를 정의하고, 여러 소스에서 설정을 로딩하며, 시작 시 설정을 검증하여 잘못된 구성을 조기에 발견합니다.

## 설치

```bash
pnpm add @esmap/config
```

## 함수

### `defineConfig`

```ts
function defineConfig(config: EsmapConfig): EsmapConfig;
```

타입 안전한 설정 객체를 생성하는 헬퍼. `esmap.config.ts`에서 사용됩니다.

### `resolveConfig`

```ts
function resolveConfig(config: EsmapConfig): ResolvedConfig;
```

사용자 설정에 기본값을 머지하여 완전히 해석된 설정을 반환합니다.

### `validateConfig`

```ts
function validateConfig(config: unknown): readonly ConfigFieldError[];
```

설정 객체를 검증합니다. 에러 목록을 반환합니다.

### `assertValidConfig`

```ts
function assertValidConfig(config: unknown): asserts config is EsmapConfig;
```

설정이 유효하지 않으면 ConfigValidationError를 던지는 타입 가드.

### `loadConfig`

```ts
function loadConfig(cwd?: string): Promise<EsmapConfig>;
```

프로젝트 디렉토리에서 설정 파일을 검색하고 로드합니다. `esmap.config.ts`, `esmap.config.js`, `esmap.config.mjs`, `esmap.config.json` 순서로 탐색합니다.

### `loadConfigFile`

```ts
function loadConfigFile(filePath: string): Promise<EsmapConfig>;
```

지정된 경로의 설정 파일을 로드합니다.

## 타입

### `ResolvedConfig`

| 속성       | 타입                       | 설명                                |
| ---------- | -------------------------- | ----------------------------------- |
| `apps`     | `EsmapConfig['apps']`      | 앱 설정                             |
| `shared`   | `EsmapConfig['shared']`    | 공유 의존성 설정                    |
| `cdnBase`  | `string`                   | CDN 기본 URL                        |
| `server`   | `Required<ServerConfig>`   | 서버 설정 (모든 기본값 적용)        |
| `devtools` | `Required<DevtoolsConfig>` | 개발자 도구 설정 (모든 기본값 적용) |

### `ConfigFieldError`

| 속성      | 타입     | 설명                         |
| --------- | -------- | ---------------------------- |
| `path`    | `string` | 에러가 발생한 설정 필드 경로 |
| `message` | `string` | 에러 메시지                  |
