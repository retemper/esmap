# @esmap/devtools

esmap 개발자 도구입니다. Import map 오버라이드를 활성화하여 호스트 애플리케이션을 재배포하지 않고도 개별 마이크로 프론트엔드를 로컬 개발 서버로 지정할 수 있습니다. (1.0 kB gzip)

## 설치

```bash
pnpm add @esmap/devtools
```

## 오버라이드 함수

### `getOverrides`

```ts
function getOverrides(): readonly OverrideEntry[];
```

localStorage에서 현재 오버라이드 목록을 읽습니다.

### `setOverride`

```ts
function setOverride(specifier: string, url: string): void;
```

오버라이드를 추가하거나 업데이트합니다. 동일한 specifier가 존재하면 URL을 덮어씁니다.

### `removeOverride`

```ts
function removeOverride(specifier: string): void;
```

특정 모듈의 오버라이드를 제거합니다.

### `clearOverrides`

```ts
function clearOverrides(): void;
```

모든 오버라이드를 제거합니다.

### `applyOverrides`

```ts
function applyOverrides(importMap: ImportMap): ImportMap;
```

import map에 활성 오버라이드를 적용하여 수정된 import map을 반환합니다.

### `hasActiveOverrides`

```ts
function hasActiveOverrides(): boolean;
```

활성 오버라이드가 있는지 확인합니다.

## API 함수

### `installDevtoolsApi`

```ts
function installDevtoolsApi(): void;
```

`window.__ESMAP__`에 개발자 도구 API를 설치합니다. 브라우저 콘솔에서 접근할 수 있습니다.

### `createDevtoolsOverlay`

```ts
function createDevtoolsOverlay(options?: OverlayOptions): DevtoolsOverlay;
```

앱 상태를 시각적으로 표시하는 오버레이를 생성합니다. 키보드 단축키로 토글할 수 있습니다.

### `createDevtoolsInspector`

```ts
function createDevtoolsInspector(): DevtoolsInspector;
```

런타임 프레임워크 상태를 검사하는 인스펙터를 생성합니다. `connect()`로 런타임 객체를 연결한 후 이벤트/모듈/앱 상태를 쿼리할 수 있습니다.

## 타입

### `OverrideEntry`

| 속성        | 타입     | 설명                                               |
| ----------- | -------- | -------------------------------------------------- |
| `specifier` | `string` | 원본 스펙파이어 (예: "@flex/checkout")             |
| `url`       | `string` | 대체 URL (예: "http://localhost:5173/checkout.js") |

### `OverlayOptions`

| 속성         | 타입                                                           | 설명                                                |
| ------------ | -------------------------------------------------------------- | --------------------------------------------------- |
| `triggerKey` | `string`                                                       | 오버레이 토글 키보드 단축키 (기본값: 'Alt+Shift+D') |
| `position`   | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | 초기 위치 (기본값: 'bottom-right')                  |

### `DevtoolsOverlay`

| 메서드    | 시그니처                           | 설명                            |
| --------- | ---------------------------------- | ------------------------------- |
| `show`    | `() => void`                       | 오버레이를 표시                 |
| `hide`    | `() => void`                       | 오버레이를 숨김                 |
| `toggle`  | `() => void`                       | 표시/숨김을 토글                |
| `update`  | `(apps: OverlayAppInfo[]) => void` | 앱 정보를 업데이트              |
| `destroy` | `() => void`                       | 오버레이와 이벤트 리스너를 제거 |

### `DevtoolsInspector`

| 메서드      | 시그니처                    | 설명                               |
| ----------- | --------------------------- | ---------------------------------- |
| `connect`   | `(connections) => void`     | 런타임 리소스를 연결               |
| `events`    | `(filter?: string) => void` | 이벤트 버스 히스토리를 콘솔에 출력 |
| `listeners` | `(event: string) => void`   | 특정 이벤트의 리스너 수를 출력     |
| `shared`    | `() => void`                | 공유 모듈 등록/로딩 상태를 출력    |
| `apps`      | `() => void`                | 앱 상태 목록을 출력                |
| `status`    | `() => void`                | 연결 상태를 확인                   |
