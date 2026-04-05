# React

::: warning 작성 중
이 페이지는 작성 중입니다.
:::

`@esmap/react`는 esmap 마이크로 프론트엔드를 위한 React 어댑터를 제공합니다.

## React MFE 만들기

```tsx
import { createReactMfeApp } from '@esmap/react';
import { App } from './App';

export const { bootstrap, mount, unmount } = createReactMfeApp({
  rootComponent: App,
});
```

## Parcel 컴포넌트

React 컴포넌트 안에 다른 MFE를 임베드합니다:

```tsx
import { EsmapParcel } from '@esmap/react';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <EsmapParcel name="@myorg/chart-widget" />
    </div>
  );
}
```
