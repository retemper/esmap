# @esmap/angular

esmap용 Angular 어댑터입니다. esmap 런타임 내에서 Angular 마이크로 프론트엔드 애플리케이션을 등록하고 마운트하는 유틸리티를 제공합니다.

## 설치

```bash
pnpm add @esmap/angular
```

## 함수

### `createAngularMfeApp`

```ts
function createAngularMfeApp(options: AngularMfeAppOptions): MfeApp
```

Angular standalone 컴포넌트를 esmap MfeApp 라이프사이클로 변환합니다. Props는 ESMAP_PROPS 인젝션 토큰을 통해 Signal로 전달됩니다. Angular 17+ standalone 컴포넌트 API가 필요합니다.

## 상수

### `ESMAP_PROPS`

```ts
const ESMAP_PROPS: InjectionToken<Signal<Record<string, unknown>>>
```

셸 애플리케이션에서 전달되는 esmap props를 위한 인젝션 토큰. Angular 컴포넌트에서 이 토큰을 주입하여 크로스 프레임워크 props를 수신합니다.

## 타입

### `AngularMfeAppOptions`

| 속성 | 타입 | 설명 |
| --- | --- | --- |
| `rootComponent` | `Type<unknown>` | 부트스트랩할 루트 Angular standalone 컴포넌트 |
| `providers` | `Provider[]` | 애플리케이션 레벨에서 등록할 추가 프로바이더 |
