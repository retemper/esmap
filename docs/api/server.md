# @esmap/server

Import map server for esmap. Exposes a deploy API for publishing new import map entries, rollback support for reverting to previous versions, and a history endpoint for auditing changes.

## Installation

```bash
pnpm add @esmap/server
```

## Classes

### `FileSystemStorage`

```ts
class FileSystemStorage implements ImportMapStorage {
  constructor(dataDir: string)
  read(): Promise<ImportMap | null>
  update(updater: (current: ImportMap) => ImportMap): Promise<ImportMap>
  appendHistory(entry: DeploymentHistoryEntry): Promise<void>
  getHistory(limit?: number): Promise<readonly DeploymentHistoryEntry[]>
}
```

File system based import map storage. Controls concurrency with an in-memory lock. Stores the import map and deployment history as JSON files.

## Functions

### `createImportMapRoutes`

```ts
function createImportMapRoutes(storage: ImportMapStorage): Hono
```

Creates Hono routes for the import map serving and deployment API. Includes endpoints for reading the current map (`GET /`), deploying new entries (`PATCH /:service`), rolling back (`POST /:service/rollback`), viewing history (`GET /history`), and an SSE event stream (`GET /events`).

### `createEventStream`

```ts
function createEventStream(): EventStream
```

Creates an SSE event broadcaster. Multiple clients can connect simultaneously and receive server-pushed events on deploy/rollback.

## Types

### `ImportMapStorage`

| Method | Signature | Description |
| --- | --- | --- |
| `read` | `() => Promise<ImportMap \| null>` | Reads the current import map |
| `update` | `(updater: (current: ImportMap) => ImportMap) => Promise<ImportMap>` | Atomically updates the import map |
| `appendHistory` | `(entry: DeploymentHistoryEntry) => Promise<void>` | Stores a deployment history entry |
| `getHistory` | `(limit?: number) => Promise<DeploymentHistoryEntry[]>` | Retrieves recent deployment history |

### `DeploymentHistoryEntry`

| Property | Type | Description |
| --- | --- | --- |
| `timestamp` | `string` | ISO 8601 timestamp |
| `service` | `string` | Service name |
| `previousUrl` | `string` | URL before the change |
| `newUrl` | `string` | URL after the change |
| `deployedBy` | `string` | Deployer identifier |

### `EventStream`

| Method | Signature | Description |
| --- | --- | --- |
| `connect` | `() => ReadableStream<Uint8Array>` | Handles a new SSE client connection |
| `broadcast` | `(event: SseEvent) => void` | Broadcasts an event to all clients |
| `clientCount` | `number` | Number of connected clients |
| `close` | `() => void` | Terminates all connections |

### `SseEvent`

| Property | Type | Description |
| --- | --- | --- |
| `type` | `string` | Event type name |
| `data` | `string` | Event data payload |
