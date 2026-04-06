# Vite 플러그인

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

`@esmap/vite-plugin`은 마이크로 프론트엔드 빌드를 위한 Vite 통합을 제공합니다.

## 설치

```bash
pnpm add -D @esmap/vite-plugin
```

## 사용법

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { esmapManifest, esmapSharedDeps } from '@esmap/vite-plugin';

export default defineConfig({
  plugins: [
    esmapManifest({ name: '@myorg/checkout' }),
    esmapSharedDeps({ react: '^18.0.0', 'react-dom': '^18.0.0' }),
  ],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'] },
  },
});
```

## `esmapManifest`

빌드 시 MFE의 진입점과 에셋을 기술하는 매니페스트 JSON 파일을 생성합니다.

## `esmapSharedDeps`

공유 의존성(예: React)을 번들에 포함하지 않고 import map에서 로드하도록 외부화합니다.
