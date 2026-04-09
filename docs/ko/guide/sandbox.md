---
description: '프록시 샌드박스와 스냅샷 샌드박스로 마이크로 프론트엔드 간 JavaScript 전역 변수를 격리하세요.'
---

# JS 샌드박스

`@esmap/sandbox`는 마이크로 프론트엔드 간 JavaScript 격리를 제공합니다.

## Proxy 샌드박스

`Proxy`를 사용하여 전역 변수 접근을 가로채고, 각 MFE에 격리된 `window` 유사 환경을 제공합니다.

```ts
import { ProxySandbox } from '@esmap/sandbox';

const sandbox = new ProxySandbox({ name: 'my-app' });
sandbox.activate();

// sandbox.proxy를 격리된 window로 사용합니다
const scopedWindow = sandbox.proxy;
scopedWindow.myGlobal = 'scoped to this MFE';

sandbox.deactivate();
// 외부 스코프에서 window.myGlobal은 undefined입니다
```

### 옵션

| 옵션        | 타입            | 설명                                                                                                       |
| ----------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `name`      | `string`        | 샌드박스 인스턴스 식별 이름                                                                                |
| `allowList` | `PropertyKey[]` | 실제 `window`에서 직접 읽을 속성 목록 (기본값: `document`, `location`, `navigator`, `console`, `fetch` 등) |

### 인스턴스 메서드

| 메서드               | 반환값          | 설명                                        |
| -------------------- | --------------- | ------------------------------------------- |
| `activate()`         | `void`          | 샌드박스를 활성화합니다                     |
| `deactivate()`       | `void`          | 샌드박스를 비활성화합니다                   |
| `isActive()`         | `boolean`       | 샌드박스의 활성 상태를 반환합니다           |
| `getModifiedProps()` | `PropertyKey[]` | 지금까지 수정된 속성 이름 목록을 반환합니다 |

### `proxy`

`proxy` 속성은 격리된 `Window` 유사 객체를 노출합니다. 샌드박스가 활성 상태일 때, 쓰기 작업은 실제 `window` 대신 내부 맵에 저장됩니다.

```ts
sandbox.activate();

sandbox.proxy.MY_CONFIG = { debug: true };
console.log(window.MY_CONFIG); // undefined — 실제 window는 변경되지 않음

sandbox.deactivate();
```

## Snapshot 샌드박스

마운트 전에 `window`의 스냅샷을 찍고 언마운트 시 복원합니다. 더 단순하지만 느립니다. `Proxy`를 지원하지 않는 환경에서 폴백으로 유용합니다.

```ts
import { createSnapshotSandbox } from '@esmap/sandbox';

const sandbox = createSnapshotSandbox('legacy-app');
sandbox.activate();

// 변경 사항이 window에 직접 적용되지만 추적됩니다
window.legacyFlag = true;

sandbox.deactivate();
// window.legacyFlag가 복원됩니다
```

## DOM 격리

`document.querySelector`, `getElementById` 등의 DOM 쿼리를 앱 컨테이너 범위로 제한하여, MFE 간 DOM 접근을 방지합니다.

```ts
import { createDomIsolation } from '@esmap/sandbox';

const isolation = createDomIsolation({
  name: 'my-app',
  container: document.getElementById('my-app-root')!,
  globalSelectors: ['#global-modal'], // 이 셀렉터는 격리를 우회
});

// document.querySelector('.btn')이 #my-app-root 내에서만 검색합니다
isolation.dispose(); // 원래 document 메서드를 복원합니다
```

## 스코프 스토리지

MFE 간 키 충돌을 방지하는 네임스페이스 기반 `localStorage`/`sessionStorage` 래퍼입니다.

```ts
import { createScopedStorage } from '@esmap/sandbox';

const storage = createScopedStorage({ scope: 'checkout' });
storage.setItem('cart', '[]'); // 실제 키: "checkout:cart"
storage.getItem('cart'); // "checkout:cart"를 읽음
storage.keys(); // "checkout:" 스코프의 모든 키
storage.clear(); // "checkout:*" 키만 삭제
```
