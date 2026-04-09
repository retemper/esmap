---
description: '이벤트 버스, 글로벌 상태, 앱 props를 활용한 타입 안전한 앱 간 통신 방법을 알아보세요.'
---

# 통신

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

`@esmap/communication`은 타입 안전한 MFE 간 통신을 제공합니다.

## 이벤트 버스

```ts
import { createEventBus } from '@esmap/communication';

interface Events {
  'cart:updated': { itemCount: number };
  'user:logged-in': { userId: string };
}

const bus = createEventBus<Events>();

// 구독
bus.on('cart:updated', ({ itemCount }) => {
  console.log(`Cart now has ${itemCount} items`);
});

// 발행
bus.emit('cart:updated', { itemCount: 3 });
```

## 글로벌 상태

```ts
import { createGlobalState } from '@esmap/communication';

const state = createGlobalState({ theme: 'light' });

// 읽기
console.log(state.get().theme);

// 업데이트
state.set({ theme: 'dark' });

// 변경 구독
state.subscribe((next) => console.log(next.theme));
```
