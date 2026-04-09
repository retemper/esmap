# @esmap/guard

마이크로 프론트엔드를 위한 런타임 가드레일입니다. 애플리케이션 간 스타일 누출을 방지하는 CSS 스코핑과 의도하지 않은 부작용을 감지하는 전역 오염 감지를 제공합니다. (2.7 kB gzip)

## 설치

```bash
pnpm add @esmap/guard
```

## CSS 스코핑 함수

### `applyCssScope`

```ts
function applyCssScope(container: HTMLElement, options: CssScopeOptions): HTMLElement;
```

컨테이너에 스코프를 적용합니다. Shadow DOM 모드에서는 shadow root를 생성하고, 그렇지 않으면 data 속성을 추가합니다.

### `removeCssScope`

```ts
function removeCssScope(container: HTMLElement, options: CssScopeOptions): void;
```

컨테이너에서 스코프를 제거합니다.

### `scopeCssText`

```ts
function scopeCssText(css: string, prefix: string): string;
```

CSS 문자열의 모든 셀렉터에 스코프 접두사를 추가합니다.

### `namespaceCssKeyframes`

```ts
function namespaceCssKeyframes(css: string, prefix: string): string;
```

CSS의 @keyframes 이름과 animation 참조에 네임스페이스 접두사를 추가합니다.

### `isPrescopedCss`

```ts
function isPrescopedCss(css: string): boolean;
```

CSS에 빌드 타임 스코핑 마커가 포함되어 있는지 확인합니다.

## 상수

### `PRESCOPED_MARKER`

```ts
const PRESCOPED_MARKER: string; // '/* @esmap:scoped'
```

빌드 타임에 CSS가 이미 스코핑되었음을 나타내는 마커.

## 전역 가드 함수

### `createGlobalGuard`

```ts
function createGlobalGuard(options?: GlobalGuardOptions): GlobalGuardHandle;
```

전역 오염을 감지하고 방지하는 가드를 생성합니다. window 객체에 예상치 못한 프로퍼티가 추가되는 것을 모니터링합니다.

### `snapshotGlobals`

```ts
function snapshotGlobals(): ReadonlySet<string>;
```

현재 전역 변수 이름의 스냅샷을 생성합니다.

### `diffGlobals`

```ts
function diffGlobals(before: ReadonlySet<string>, allowList?: string[]): readonly string[];
```

window 전역 변수의 차이를 한 번 계산합니다 (비동기 폴링 없음).

## 스타일 격리 함수

### `createStyleIsolation`

```ts
function createStyleIsolation(options: StyleIsolationOptions): StyleIsolationHandle;
```

자동 스타일시트 발견 및 스코핑을 생성합니다. MFE 앱이 마운트될 때 컨테이너 내부의 스타일을 자동으로 찾아 격리합니다.

### `createStyleCollector`

```ts
function createStyleCollector(): StyleCollector;
```

앱별 스타일시트 추적 유틸리티를 생성합니다. document head에 추가되는 style 요소를 앱별로 수집하고 관리합니다.

### `createScopedStyleCollector`

```ts
function createScopedStyleCollector(
  options: ScopedStyleCollectorOptions,
): ScopedStyleCollectorHandle;
```

head에 주입되는 style 요소를 감지하고 자동으로 CSS 스코핑을 적용하는 컬렉터를 생성합니다. CSS-in-JS 라이브러리(styled-components, Emotion 등)와의 호환성을 제공합니다.

## 타입

### `CssScopeOptions`

| 속성           | 타입      | 설명                                 |
| -------------- | --------- | ------------------------------------ |
| `prefix`       | `string`  | 스코프 접두사 (예: "mfe-checkout")   |
| `useShadowDom` | `boolean` | Shadow DOM 사용 여부 (기본값: false) |

### `GlobalGuardOptions`

| 속성          | 타입                                   | 설명                        |
| ------------- | -------------------------------------- | --------------------------- |
| `allowList`   | `string[]`                             | 허용된 전역 변수 이름 목록  |
| `onViolation` | `(violation: GlobalViolation) => void` | 위반 발생 시 콜백           |
| `interval`    | `number`                               | 폴링 간격 ms (기본값: 1000) |

### `GlobalViolation`

| 속성       | 타입                | 설명                       |
| ---------- | ------------------- | -------------------------- |
| `property` | `string`            | 추가/수정된 전역 변수 이름 |
| `type`     | `'add' \| 'modify'` | 위반 유형                  |

### `GlobalGuardHandle`

| 메서드    | 시그니처         | 설명                                                |
| --------- | ---------------- | --------------------------------------------------- |
| `dispose` | `() => string[]` | 가드를 해제하고 스냅샷 이후 추가된 전역 변수를 반환 |
| `check`   | `() => void`     | 즉시 검사를 수동으로 트리거                         |

### `StyleIsolationOptions`

| 속성             | 타입                      | 설명                                     |
| ---------------- | ------------------------- | ---------------------------------------- |
| `appName`        | `string`                  | 스코핑에 사용할 앱 이름                  |
| `container`      | `HTMLElement`             | 앱이 렌더링되는 컨테이너 요소            |
| `strategy`       | `'attribute' \| 'shadow'` | 격리 전략                                |
| `observeDynamic` | `boolean`                 | MutationObserver로 동적 스타일 감지 여부 |

### `StyleIsolationHandle`

| 메서드           | 시그니처       | 설명                                    |
| ---------------- | -------------- | --------------------------------------- |
| `destroy`        | `() => void`   | 옵저버를 중지하고 스코핑을 제거         |
| `getScopedCount` | `() => number` | 스코핑된 스타일시트 수를 반환           |
| `refresh`        | `() => void`   | 발견된 모든 스타일을 강제로 다시 스코핑 |

### `ScopedStyleCollectorOptions`

| 속성      | 타입                   | 설명                                          |
| --------- | ---------------------- | --------------------------------------------- |
| `appName` | `string`               | 스코핑에 사용할 앱 이름                       |
| `exclude` | `(element) => boolean` | 스코핑에서 제외할 스타일 요소를 결정하는 함수 |

### `ScopedStyleCollectorHandle`

| 메서드           | 시그니처       | 설명                                                   |
| ---------------- | -------------- | ------------------------------------------------------ |
| `start`          | `() => void`   | 수집 및 스코핑을 시작                                  |
| `stop`           | `() => void`   | 수집을 중지. 이미 스코핑된 스타일은 유지               |
| `destroy`        | `() => void`   | 스코핑된 모든 스타일을 원본으로 복원하고 컬렉터를 해제 |
| `getScopedCount` | `() => number` | 현재 스코핑된 스타일 요소 수를 반환                    |
