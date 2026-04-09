# Vite 플러그인

`@esmap/vite-plugin`은 마이크로 프론트엔드 빌드를 위한 Vite 통합을 제공합니다. 세 가지 플러그인을 제공합니다:

- **`esmapManifest`** — 빌드 후 MFE 매니페스트 JSON 생성
- **`esmapSharedDeps`** — 공유 의존성을 개별 ESM 모듈로 빌드
- **`esmapCssScope`** — 빌드 시점에 앱 이름으로 CSS 스코핑

## 설치

```bash
pnpm add -D @esmap/vite-plugin
```

## 사용법

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { esmapManifest, esmapSharedDeps, esmapCssScope } from '@esmap/vite-plugin';

export default defineConfig({
  plugins: [
    esmapManifest({ name: '@myorg/checkout' }),
    esmapSharedDeps({ deps: { react: 'react', 'react-dom': 'react-dom' } }),
    esmapCssScope({ appName: 'checkout' }),
  ],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'] },
  },
});
```

## `esmapManifest`

빌드 시 MFE의 진입점, 에셋, 의존성을 기술하는 매니페스트 JSON 파일을 생성합니다.

### 옵션

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `name` | `string` | *(필수)* | MFE 앱 이름 (예: `"@myorg/checkout"`) |
| `version` | `string` | `package.json`에서 읽음 | MFE 앱 버전 |
| `shared` | `string[]` | `[]` | 공유 의존성 이름. Vite externals로도 설정됨 |
| `internal` | `string[]` | `[]` | 내부 패키지 의존성 |
| `outputFileName` | `string` | `"esmap-manifest.json"` | 출력 파일명 |

## `esmapSharedDeps`

공유 의존성을 콘텐츠 해시가 포함된 파일명의 개별 ESM 모듈로 빌드하고 `shared-deps-manifest.json`을 생성합니다.

### 옵션

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `deps` | `Record<string, string>` | *(필수)* | 의존성 항목. 키 = 패키지명, 값 = import 지정자 |
| `outDir` | `string` | `"dist"` | 빌드 출력 디렉토리 |
| `outputFileName` | `string` | `"shared-deps-manifest.json"` | 매니페스트 출력 파일명 |

## `esmapCssScope`

빌드 시점에 앱 이름으로 CSS를 스코핑합니다. 셀렉터에 `[data-esmap-scope="appName"]` 접두사를 추가하고, 선택적으로 `@keyframes`를 네임스페이싱합니다. 런타임 스코핑 비용을 제거하고 FOUC를 방지합니다.

CSS Modules 파일(`.module.css`)은 이미 로컬 스코핑이 적용되어 있으므로 자동으로 건너뜁니다.

### 옵션

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `appName` | `string` | *(필수)* | CSS 스코핑에 사용할 앱 이름 |
| `exclude` | `(string \| RegExp)[]` | `[]` | 스코핑에서 제외할 파일 패턴 |
| `namespaceKeyframes` | `boolean` | `true` | `@keyframes` 이름을 네임스페이싱할지 여부 |

### 예시

```ts
esmapCssScope({
  appName: 'checkout',
  exclude: [/node_modules/, 'global.css'],
  namespaceKeyframes: true,
})
```
