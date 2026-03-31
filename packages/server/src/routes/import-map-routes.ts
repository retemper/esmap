import { Hono } from 'hono';
import type { ImportMapStorage, DeploymentHistoryEntry } from '../storage/types.js';
import { createEmptyImportMap, mergeImportMaps } from '@esmap/shared';
import type { ImportMap } from '@esmap/shared';
import { createEventStream } from '../sse/event-stream.js';

/** Deploy request body */
interface DeployRequest {
  readonly url: string;
  readonly deployedBy?: string;
}

/**
 * Creates routes for the import map serving and deployment API.
 * @param storage - import map storage implementation
 */
export function createImportMapRoutes(storage: ImportMapStorage): Hono {
  const app = new Hono();
  const eventStream = createEventStream();

  /** GET / -- Returns the current import map JSON. */
  app.get('/', async (c) => {
    const importMap = (await storage.read()) ?? createEmptyImportMap();

    return c.json(importMap, 200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/importmap+json',
    });
  });

  /** GET /events -- Delivers import map change events in real time via SSE stream. */
  app.get('/events', (_c) => {
    const stream = eventStream.connect();
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });

  /** PATCH /services/:name{.+} -- Updates the URL for a specific MFE. Name may contain /. */
  app.patch('/services/:name{.+}', async (c) => {
    const serviceName = decodeURIComponent(c.req.param('name'));

    if (!isValidServiceName(serviceName)) {
      return c.json({ error: `Invalid service name: "${serviceName}"` }, 400);
    }

    const body: unknown = await c.req.json();

    if (!isDeployRequest(body)) {
      return c.json({ error: '"url" field is required' }, 400);
    }

    const currentMap = (await storage.read()) ?? createEmptyImportMap();
    const previousUrl = currentMap.imports[serviceName] ?? '';

    const updated = await storage.update((current) => {
      const overlay: ImportMap = {
        imports: { [serviceName]: body.url },
      };
      return mergeImportMaps(current, overlay, 'override');
    });

    const historyEntry: DeploymentHistoryEntry = {
      timestamp: new Date().toISOString(),
      service: serviceName,
      previousUrl,
      newUrl: body.url,
      deployedBy: body.deployedBy,
    };
    await storage.appendHistory(historyEntry);

    eventStream.broadcast({
      type: 'import-map-update',
      data: JSON.stringify({ service: serviceName, url: body.url, importMap: updated }),
    });

    return c.json({
      service: serviceName,
      url: body.url,
      importMap: updated,
    });
  });

  /** DELETE /services/:name{.+} -- Removes a specific MFE from the import map. */
  app.delete('/services/:name{.+}', async (c) => {
    const serviceName = decodeURIComponent(c.req.param('name'));

    if (!isValidServiceName(serviceName)) {
      return c.json({ error: `Invalid service name: "${serviceName}"` }, 400);
    }

    const updated = await storage.update((current) => {
      const { [serviceName]: _, ...rest } = current.imports;
      return { ...current, imports: rest };
    });

    eventStream.broadcast({
      type: 'import-map-update',
      data: JSON.stringify({ service: serviceName, removed: true, importMap: updated }),
    });

    return c.json({ service: serviceName, removed: true, importMap: updated });
  });

  /** GET /history -- Retrieves deployment history. */
  app.get('/history', async (c) => {
    const limitParam = c.req.query('limit');
    const parsed = limitParam ? Number(limitParam) : NaN;
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 1000) : 50;
    const history = await storage.getHistory(limit);
    return c.json(history);
  });

  /** POST /rollback/:name{.+} -- Rolls back a specific MFE to its previous version. */
  app.post('/rollback/:name{.+}', async (c) => {
    const serviceName = decodeURIComponent(c.req.param('name'));

    if (!isValidServiceName(serviceName)) {
      return c.json({ error: `Invalid service name: "${serviceName}"` }, 400);
    }

    const history = await storage.getHistory(100);
    const lastDeploy = history.find((h) => h.service === serviceName && h.previousUrl);

    if (!lastDeploy) {
      return c.json({ error: `No rollback history found for "${serviceName}"` }, 404);
    }

    const updated = await storage.update((current) => {
      const overlay: ImportMap = {
        imports: { [serviceName]: lastDeploy.previousUrl },
      };
      return mergeImportMaps(current, overlay, 'override');
    });

    await storage.appendHistory({
      timestamp: new Date().toISOString(),
      service: serviceName,
      previousUrl: lastDeploy.newUrl,
      newUrl: lastDeploy.previousUrl,
      deployedBy: 'rollback',
    });

    eventStream.broadcast({
      type: 'import-map-rollback',
      data: JSON.stringify({
        service: serviceName,
        rolledBackTo: lastDeploy.previousUrl,
        importMap: updated,
      }),
    });

    return c.json({
      service: serviceName,
      rolledBackTo: lastDeploy.previousUrl,
      importMap: updated,
    });
  });

  return app;
}

/** Set of dangerous property names that can cause prototype pollution */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validates that a service name is safe.
 * Rejects keys that could cause prototype pollution and empty strings.
 * @param name - service name to validate
 */
function isValidServiceName(name: string): boolean {
  return name.length > 0 && !DANGEROUS_KEYS.has(name);
}

/**
 * Validates that the deploy request body is valid.
 * Checks that the url field is a string with http(s) protocol.
 */
function isDeployRequest(body: unknown): body is DeployRequest {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof body.url !== 'string'
  ) {
    return false;
  }
  try {
    const parsed = new URL(body.url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
