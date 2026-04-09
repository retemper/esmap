# @esmap/server

esmap Import map 서버입니다. 새로운 import map 항목을 배포하는 Deploy API, 이전 버전으로 되돌리는 롤백 지원, 변경 사항을 감사하는 히스토리 엔드포인트를 제공합니다.

## 설치

```bash
pnpm add @esmap/server
```

## 함수

### `createImportMapRoutes`

```ts
function createImportMapRoutes(storage: ImportMapStorage): Hono;
```

Import map 서빙 및 배포 API 라우트를 생성합니다. GET `/`으로 현재 import map을 반환하고, PATCH `/services/:name`으로 개별 MFE를 업데이트하며, GET `/events`로 SSE 실시간 변경 이벤트를 전달합니다.

### `createEventStream`

```ts
function createEventStream(): EventStream;
```

SSE 이벤트 브로드캐스터를 생성합니다. 여러 클라이언트가 동시에 연결하여 서버에서 푸시하는 이벤트를 수신할 수 있습니다.

## 클래스

### `FileSystemStorage`

```ts
class FileSystemStorage implements ImportMapStorage {
  constructor(dataDir: string);
  read(): Promise<ImportMap | null>;
  update(updater: (current: ImportMap) => ImportMap): Promise<ImportMap>;
  appendHistory(entry: DeploymentHistoryEntry): Promise<void>;
  getHistory(limit?: number): Promise<readonly DeploymentHistoryEntry[]>;
}
```

파일 시스템 기반 import map 스토리지. 인메모리 락으로 동시성을 제어합니다.

## 타입

### `ImportMapStorage`

| 메서드          | 시그니처                                        | 설명                             |
| --------------- | ----------------------------------------------- | -------------------------------- |
| `read`          | `() => Promise<ImportMap \| null>`              | 현재 import map을 읽음           |
| `update`        | `(updater) => Promise<ImportMap>`               | import map을 원자적으로 업데이트 |
| `appendHistory` | `(entry) => Promise<void>`                      | 배포 히스토리 항목을 저장        |
| `getHistory`    | `(limit?) => Promise<DeploymentHistoryEntry[]>` | 최근 배포 히스토리를 조회        |

### `DeploymentHistoryEntry`

| 속성          | 타입     | 설명        |
| ------------- | -------- | ----------- |
| `timestamp`   | `string` | 배포 시각   |
| `service`     | `string` | 서비스 이름 |
| `previousUrl` | `string` | 이전 URL    |
| `newUrl`      | `string` | 새 URL      |
| `deployedBy`  | `string` | 배포자      |

### `EventStream`

| 메서드      | 시그니처                           | 설명                                           |
| ----------- | ---------------------------------- | ---------------------------------------------- |
| `connect`   | `() => ReadableStream<Uint8Array>` | 새 SSE 클라이언트 연결을 처리                  |
| `broadcast` | `(event: SseEvent) => void`        | 연결된 모든 클라이언트에 이벤트를 브로드캐스트 |
| `close`     | `() => void`                       | 모든 연결을 종료                               |

### `SseEvent`

| 속성   | 타입     | 설명          |
| ------ | -------- | ------------- |
| `type` | `string` | 이벤트 타입   |
| `data` | `string` | 이벤트 데이터 |
