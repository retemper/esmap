# @esmap/vite-plugin

esmap용 Vite 플러그인입니다. Import map 배포를 위한 매니페스트 생성을 처리하고, 공유 의존성이 런타임에 import map에서 로드되도록 ESM 외부화를 설정합니다.

## 설치

```bash
pnpm add -D @esmap/vite-plugin
```

## 함수

### `esmapManifest`

```ts
function esmapManifest(options: ManifestPluginOptions): Plugin
```

빌드 후 MFE 매니페스트 JSON을 자동 생성하는 Vite 플러그인. 빌드 출력의 파일명(콘텐츠 해시 포함)을 분석하여 매니페스트를 생성합니다.

### `esmapSharedDeps`

```ts
function esmapSharedDeps(options: SharedDepsPluginOptions): Plugin
```

공유 의존성을 개별 ESM 모듈로 빌드하고 SharedDependencyManifest를 생성하는 Vite 플러그인. 각 의존성을 엔트리 포인트로 설정하고 콘텐츠 해시 파일명으로 출력합니다.

### `esmapCssScope`

```ts
function esmapCssScope(options: CssScopePluginOptions): Plugin
```

빌드 타임에 앱 이름으로 CSS를 스코핑하는 Vite 플러그인. 런타임 스코핑 비용을 제거하고 FOUC(Flash of Unstyled Content)를 방지합니다.

## 타입

### `ManifestPluginOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `name` | `string` | MFE 앱 이름 (예: "@flex/checkout") |
| `version` | `string` | MFE 앱 버전. 미지정 시 package.json에서 읽음 |
| `shared` | `string[]` | 공유 의존성 목록. Vite externals로 설정되고 매니페스트에 기록됨 |
| `internal` | `string[]` | 내부 패키지 의존성 목록 |
| `outputFileName` | `string` | 매니페스트 출력 파일명 (기본값: "esmap-manifest.json") |

### `SharedDepsPluginOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `deps` | `Record<string, string>` | 공유 의존성 항목. 키 = 패키지 이름, 값 = import 스펙파이어 |
| `outDir` | `string` | 빌드 출력 디렉토리 |
| `outputFileName` | `string` | 매니페스트 출력 파일명 (기본값: "shared-deps-manifest.json") |

### `CssScopePluginOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `appName` | `string` | 스코핑에 사용할 앱 이름 |
| `exclude` | `(string \| RegExp)[]` | 스코핑에서 제외할 파일 패턴 |
| `namespaceKeyframes` | `boolean` | @keyframes 네임스페이싱 활성화 여부 (기본값: true) |
