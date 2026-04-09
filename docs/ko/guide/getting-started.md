---
description: "esmap 패키지 설치, 첫 번째 마이크로 프론트엔드 작성, 빌드 구성, 배포까지 빠르게 시작하세요."
---

# 시작하기

## 설치

필요한 패키지를 설치합니다:

```bash
pnpm add @esmap/runtime @esmap/react
pnpm add -D @esmap/vite-plugin @esmap/cli
```

## 빠른 시작

### 1. 마이크로 프론트엔드 작성

```ts
// apps/checkout/src/index.ts
export async function bootstrap() {}

export async function mount(container: HTMLElement) {
  container.innerHTML = '<div>Checkout App</div>';
}

export async function unmount(container: HTMLElement) {
  container.innerHTML = '';
}
```

React를 사용하는 경우:

```tsx
import { createReactMfeApp } from '@esmap/react';
import { App } from './App';

export const { bootstrap, mount, unmount } = createReactMfeApp({
  rootComponent: App,
});
```

### 2. 빌드 설정

```ts
// vite.config.ts
import { esmapManifest, esmapSharedDeps } from '@esmap/vite-plugin';

export default defineConfig({
  plugins: [
    esmapManifest({ name: '@myorg/checkout' }),
    esmapSharedDeps({ react: '^18.0.0', 'react-dom': '^18.0.0' }),
  ],
  build: { lib: { entry: 'src/index.ts', formats: ['es'] } },
});
```

### 3. 호스트 설정

```ts
import { loadImportMap, AppRegistry, Router } from '@esmap/runtime';

await loadImportMap({ importMapUrl: '/importmap.json' });

const registry = new AppRegistry();
registry.registerApp({
  name: '@myorg/checkout',
  activeWhen: '/checkout',
  container: '#mfe-root',
});

const router = new Router(registry);
await router.start();
```

### 4. 배포

```bash
esmap serve --port 3000

esmap deploy --server http://localhost:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js

# 필요시 롤백
esmap rollback --server http://localhost:3000 --name @myorg/checkout
```

## 다음 단계

- [Import Maps](/ko/guide/import-maps) — esmap의 기반이 되는 핵심 표준 이해하기
- [앱 라이프사이클](/ko/guide/app-lifecycle) — bootstrap, mount, unmount, update
- [라우팅](/ko/guide/routing) — 라우터가 MFE를 활성화하는 방식
- [React 연동](/ko/guide/react) — React 전용 어댑터와 훅
