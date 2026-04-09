---
description: '@esmap/sandbox API 레퍼런스 — JS 격리를 위한 프록시 샌드박스와 스냅샷 샌드박스.'
---

# @esmap/sandbox

마이크로 프론트엔드 격리를 위한 JavaScript 샌드박스입니다. 모던 브라우저용 프록시 기반 샌드박싱과 폴백용 스냅샷 샌드박싱을 지원하며, 애플리케이션 간 전역 스코프 오염을 방지합니다. (1.9 kB gzip)

## 설치

```bash
pnpm add @esmap/sandbox
```

## 클래스

### `ProxySandbox`

```ts
class ProxySandbox {
  readonly name: string;
  readonly proxy: Window;
  constructor(options: ProxySandboxOptions);
  activate(): void;
  deactivate(): void;
  getModifiedProps(): ReadonlyArray<PropertyKey>;
  isActive(): boolean;
}
```

Proxy를 사용하여 window 프로퍼티 수정을 격리하는 샌드박스. 실제 window를 오염시키지 않고 프로퍼티를 격리합니다.

## 상수

### `DEFAULT_ALLOW_LIST`

```ts
const DEFAULT_ALLOW_LIST: ReadonlyArray<PropertyKey>;
```

실제 window에서 직접 읽을 프로퍼티 기본 목록. `document`, `location`, `history`, `navigator`, `console`, `setTimeout`, `fetch` 등을 포함합니다.

## 함수

### `createSnapshotSandbox`

```ts
function createSnapshotSandbox(name: string): SnapshotSandbox;
```

스냅샷 기반 샌드박스를 생성합니다. 활성화 시 window의 모든 own 프로퍼티를 스냅샷으로 저장하고, 비활성화 시 변경 사항을 감지하여 복원합니다.

### `createDomIsolation`

```ts
function createDomIsolation(options: DomIsolationOptions): DomIsolationHandle;
```

DOM 쿼리 격리를 생성합니다. document의 쿼리 메서드를 패치하여 앱 컨테이너 범위로 제한합니다.

### `createScopedStorage`

```ts
function createScopedStorage(options: ScopedStorageOptions): ScopedStorage;
```

네임스페이스 Web Storage 래퍼를 생성합니다. 모든 키 접근에 자동으로 스코프 접두사를 추가하여 다른 앱의 키와 충돌을 방지합니다.

## 타입

### `ProxySandboxOptions`

| 속성        | 타입            | 설명                                    |
| ----------- | --------------- | --------------------------------------- |
| `name`      | `string`        | 샌드박스 인스턴스 식별 이름             |
| `allowList` | `PropertyKey[]` | 실제 window에서 직접 읽을 프로퍼티 목록 |

### `DomIsolationOptions`

| 속성              | 타입          | 설명                        |
| ----------------- | ------------- | --------------------------- |
| `name`            | `string`      | 앱 이름 (디버깅용)          |
| `container`       | `HTMLElement` | 앱의 DOM 컨테이너 요소      |
| `globalSelectors` | `string[]`    | 격리에서 제외할 셀렉터 패턴 |

### `DomIsolationHandle`

| 속성        | 타입          | 설명                                        |
| ----------- | ------------- | ------------------------------------------- |
| `dispose`   | `() => void`  | 격리를 해제하고 원본 document 메서드를 복원 |
| `container` | `HTMLElement` | 격리된 컨테이너 요소                        |

### `ScopedStorageOptions`

| 속성        | 타입      | 설명                                 |
| ----------- | --------- | ------------------------------------ |
| `scope`     | `string`  | 키 접두사로 사용할 스코프 이름       |
| `storage`   | `Storage` | 대상 스토리지 (기본값: localStorage) |
| `separator` | `string`  | 키 구분자 (기본값: ":")              |

### `ScopedStorage`

| 메서드       | 시그니처                               | 설명                              |
| ------------ | -------------------------------------- | --------------------------------- |
| `getItem`    | `(key: string) => string \| null`      | 스코프 키로 값을 읽음             |
| `setItem`    | `(key: string, value: string) => void` | 스코프 키로 값을 저장             |
| `removeItem` | `(key: string) => void`                | 스코프 키를 삭제                  |
| `keys`       | `() => string[]`                       | 이 스코프에 속하는 모든 키를 반환 |
| `clear`      | `() => void`                           | 이 스코프의 모든 항목을 삭제      |
