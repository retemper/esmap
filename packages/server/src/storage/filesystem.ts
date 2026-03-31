import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ImportMap } from '@esmap/shared';
import { createEmptyImportMap, parseImportMap, serializeImportMap } from '@esmap/shared';
import type { ImportMapStorage, DeploymentHistoryEntry } from './types.js';

/**
 * File system based import map storage.
 * Controls concurrency with a simple in-memory lock.
 */
export class FileSystemStorage implements ImportMapStorage {
  private readonly mapPath: string;
  private readonly historyPath: string;
  private lockPromise: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.mapPath = join(dataDir, 'importmap.json');
    this.historyPath = join(dataDir, 'history.json');
  }

  /** Reads the current import map from the file. */
  async read(): Promise<ImportMap | null> {
    try {
      const content = await readFile(this.mapPath, 'utf-8');
      return parseImportMap(content);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  /** Atomically updates the import map within a lock. */
  async update(updater: (current: ImportMap) => ImportMap): Promise<ImportMap> {
    return this.withLock(async () => {
      const current = (await this.read()) ?? createEmptyImportMap();
      const updated = updater(current);

      await mkdir(dirname(this.mapPath), { recursive: true });
      await writeFile(this.mapPath, serializeImportMap(updated), 'utf-8');

      return updated;
    });
  }

  /** Appends a deployment history entry to the file. */
  async appendHistory(entry: DeploymentHistoryEntry): Promise<void> {
    return this.withLock(async () => {
      const history = await this.readHistory();
      history.unshift(entry);

      const MAX_HISTORY = 1000;
      const trimmed = history.slice(0, MAX_HISTORY);

      await mkdir(dirname(this.historyPath), { recursive: true });
      await writeFile(this.historyPath, JSON.stringify(trimmed, null, 2), 'utf-8');
    });
  }

  /** Retrieves recent deployment history. */
  async getHistory(limit = 50): Promise<readonly DeploymentHistoryEntry[]> {
    const history = await this.readHistory();
    return history.slice(0, limit);
  }

  /** Reads the history file. */
  private async readHistory(): Promise<DeploymentHistoryEntry[]> {
    try {
      const content = await readFile(this.historyPath, 'utf-8');
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isDeploymentHistoryEntry);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return [];
      throw error;
    }
  }

  /**
   * Simple in-memory lock. Serializes concurrent requests.
   * The next operation runs sequentially regardless of whether the previous one failed.
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.lockPromise;
    // Releases the lock and runs the next operation even if the previous one failed
    const current = previous.then(
      () => fn(),
      () => fn(),
    );
    this.lockPromise = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }
}

/** Node.js error type guard */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Checks whether a value satisfies the DeploymentHistoryEntry structure.
 * @param value - value to validate
 */
function isDeploymentHistoryEntry(value: unknown): value is DeploymentHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'timestamp' in value &&
    typeof value.timestamp === 'string' &&
    'service' in value &&
    typeof value.service === 'string' &&
    'previousUrl' in value &&
    typeof value.previousUrl === 'string' &&
    'newUrl' in value &&
    typeof value.newUrl === 'string'
  );
}
