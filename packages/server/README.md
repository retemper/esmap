# @esmap/server

Import map serving server — deploy API, concurrency-safe updates, and deployment history.

Provides [Hono](https://hono.dev/)-based HTTP routes. Can run as a standalone server or mount into an existing one.

## Installation

```bash
pnpm add @esmap/server
```

## Quick Start

```ts
import { Hono } from 'hono';
import { createImportMapRoutes, FileSystemStorage } from '@esmap/server';

const app = new Hono();
const storage = new FileSystemStorage('./data');
const routes = createImportMapRoutes(storage);

app.route('/', routes);

export default { port: 3000, fetch: app.fetch };
```

## API Endpoints

### GET /

Returns the current import map:

```bash
curl http://localhost:3000/
# -> { "imports": { "@myorg/checkout": "https://cdn/checkout.js" }, "scopes": {} }
```

### PATCH /services/:name

Updates a service URL (deployment):

```bash
curl -X PATCH http://localhost:3000/services/@myorg/checkout \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://cdn/checkout-v2.js"}'
```

### DELETE /services/:name

Removes a service from the import map:

```bash
curl -X DELETE http://localhost:3000/services/@myorg/checkout
```

### POST /rollback/:name

Rolls back to the previous deployment:

```bash
curl -X POST http://localhost:3000/rollback/@myorg/checkout
```

### GET /history

Queries deployment history:

```bash
curl http://localhost:3000/history?limit=20
```

## Storage

### FileSystemStorage

File system-based storage. Uses an in-memory lock for concurrency control:

```ts
import { FileSystemStorage } from '@esmap/server';

const storage = new FileSystemStorage('./data');
// -> ./data/importmap.json (current import map)
// -> ./data/history.json (deployment history, max 1000 entries)
```

### Custom Storage

Implement the `ImportMapStorage` interface to use other backends like S3 or Redis:

```ts
import type { ImportMapStorage, DeploymentHistoryEntry } from '@esmap/server';
import type { ImportMap } from '@esmap/shared';

class RedisStorage implements ImportMapStorage {
  async read(): Promise<ImportMap | null> {
    /* ... */
  }
  async update(updater: (current: ImportMap) => ImportMap): Promise<ImportMap> {
    /* ... */
  }
  async appendHistory(entry: DeploymentHistoryEntry): Promise<void> {
    /* ... */
  }
  async getHistory(limit?: number): Promise<readonly DeploymentHistoryEntry[]> {
    /* ... */
  }
}
```

## Concurrency Safety

`FileSystemStorage.update()` is serialized via an in-memory lock. Multiple concurrent deploy requests maintain a consistent import map state.
