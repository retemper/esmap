---
description: '프록시 샌드박스와 스냅샷 샌드박스로 마이크로 프론트엔드 간 JavaScript 전역 변수를 격리하세요.'
---

# JS 샌드박스

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

`@esmap/sandbox`는 마이크로 프론트엔드 간 JavaScript 격리를 제공합니다.

## Proxy 샌드박스

`Proxy`를 사용하여 전역 변수 접근을 가로채고, 각 MFE에 격리된 `window` 유사 환경을 제공합니다.

```ts
import { createProxySandbox } from '@esmap/sandbox';

const sandbox = createProxySandbox();
sandbox.activate();

// MFE 코드가 격리된 전역 스코프에서 실행됩니다
sandbox.exec(() => {
  window.myGlobal = 'scoped to this MFE';
});

sandbox.deactivate();
// 외부 스코프에서 window.myGlobal은 undefined입니다
```

## Snapshot 샌드박스

마운트 전에 `window`의 스냅샷을 찍고 언마운트 시 복원합니다. 더 단순하지만 느립니다. `Proxy`를 지원하지 않는 환경에서 폴백으로 유용합니다.
