---
description: '@esmap/vue API 레퍼런스 — esmap 마이크로 프론트엔드용 Vue 어댑터.'
---

# @esmap/vue

esmap용 Vue 어댑터입니다. esmap 런타임 내에서 Vue 마이크로 프론트엔드 애플리케이션을 등록하고 마운트하는 유틸리티를 제공합니다.

## 설치

```bash
pnpm add @esmap/vue
```

## 함수

### `createVueMfeApp`

```ts
function createVueMfeApp(options: VueMfeAppOptions): MfeApp;
```

Vue 3 컴포넌트를 esmap MfeApp 라이프사이클로 변환합니다. createApp/unmount를 자동 관리하여 메모리 누수를 방지합니다.

## 타입

### `VueMfeAppOptions`

| 속성            | 타입        | 설명                                                                      |
| --------------- | ----------- | ------------------------------------------------------------------------- |
| `rootComponent` | `Component` | 마운트할 Vue 컴포넌트                                                     |
| `wrapWith`      | `Component` | 래퍼 컴포넌트 (예: 플러그인 프로바이더). default 슬롯을 렌더링해야 합니다 |
