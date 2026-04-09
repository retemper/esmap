# @esmap/react

esmap용 React 어댑터입니다. React 마이크로 프론트엔드를 등록하는 `createReactMfeApp()`, 라이프사이클 훅, 자식 애플리케이션을 임베드하는 `EsmapParcel` 컴포넌트를 제공합니다. (1.5 kB gzip)

## 설치

```bash
pnpm add @esmap/react
```

## 함수

### `createReactMfeApp`

```ts
function createReactMfeApp<P extends Record<string, unknown>>(
  options: ReactMfeAppOptions<P>,
): MfeApp;
```

React 컴포넌트를 esmap MfeApp 라이프사이클로 변환합니다. createRoot/unmount를 자동 관리하여 메모리 누수를 방지합니다.

### `useParcel`

```ts
function useParcel(
  appOrLoader: MfeApp | (() => Promise<MfeApp>),
  props?: Record<string, unknown>,
): { ref: RefObject<HTMLDivElement | null>; status: MfeAppStatus; error: Error | null };
```

esmap Parcel을 명령적으로 마운트하는 훅. ref를 DOM 요소에 연결하면 자동으로 마운트/클린업합니다.

### `useGlobalState`

```ts
function useGlobalState<T extends Record<string, unknown>>(store: GlobalState<T>): Readonly<T>;
function useGlobalState<T extends Record<string, unknown>, S>(
  store: GlobalState<T>,
  selector: (state: Readonly<T>) => S,
): S;
```

esmap GlobalState를 React 상태로 구독하는 훅. concurrent mode 안전성을 위해 useSyncExternalStore를 사용합니다.

### `useAppStatus`

```ts
function useAppStatus(registry: AppRegistry, appName: string): MfeAppStatus;
```

AppRegistry에서 앱 상태를 구독하는 훅.

## 컴포넌트

### `EsmapParcel`

```ts
function EsmapParcel(props: EsmapParcelProps): JSX.Element;
```

다른 MFE 앱을 React 트리 안에 임베드하는 컴포넌트.

## 타입

### `ReactMfeAppOptions`

| 속성            | 타입                                     | 설명                         |
| --------------- | ---------------------------------------- | ---------------------------- |
| `rootComponent` | `ComponentType<P>`                       | 마운트할 React 컴포넌트      |
| `wrapWith`      | `ComponentType<{ children: ReactNode }>` | 래퍼 컴포넌트 (예: Provider) |
| `errorBoundary` | `ComponentType<{ error: Error }>`        | 에러 바운더리 폴백 UI        |

### `EsmapParcelProps`

| 속성    | 타입                                | 설명                      |
| ------- | ----------------------------------- | ------------------------- |
| `app`   | `MfeApp \| (() => Promise<MfeApp>)` | 마운트할 MfeApp 또는 로더 |
| `props` | `Record<string, unknown>`           | 앱에 전달할 props         |
