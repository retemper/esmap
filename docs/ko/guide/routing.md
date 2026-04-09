---
description: "esmap 라우터가 URL 패턴에 따라 마이크로 프론트엔드를 활성화하고 비활성화하는 방법을 알아보세요."
---

# 라우팅

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

esmap의 라우터는 브라우저 URL에 따라 MFE를 활성화하고 비활성화합니다.

## 기본 사용법

```ts
import { AppRegistry, Router } from '@esmap/runtime';

const registry = new AppRegistry();

registry.registerApp({
  name: '@myorg/checkout',
  activeWhen: '/checkout',
  container: '#mfe-root',
});

const router = new Router(registry);
await router.start();
```

## 라우트 매칭

`activeWhen` 옵션은 다음을 지원합니다:

- **문자열 접두사** — `'/checkout'`은 `/checkout`, `/checkout/step-1` 등과 매칭됩니다.
- **함수** — `(url) => url.pathname.startsWith('/checkout')`
- **배열** — `['/checkout', '/cart']`

## 경쟁 조건 안전성

오래된 내비게이션은 자동으로 무시됩니다. 사용자가 `/a`로 이동한 후 빠르게 `/b`로 이동하면, `/a`의 마운트가 취소되어 `/b`가 깔끔하게 마운트됩니다.
