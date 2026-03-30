import type { ImportMap } from '@esmap/shared';

/**
 * Import map storage interface.
 * Implementations must guarantee concurrency-safe read-write operations.
 */
export interface ImportMapStorage {
  /** Reads the current import map. Returns null if none exists. */
  read(): Promise<ImportMap | null>;
  /** Atomically updates the import map. The updater runs within a lock. */
  update(updater: (current: ImportMap) => ImportMap): Promise<ImportMap>;
  /** Stores a deployment history entry. */
  appendHistory(entry: DeploymentHistoryEntry): Promise<void>;
  /** Retrieves recent deployment history. */
  getHistory(limit?: number): Promise<readonly DeploymentHistoryEntry[]>;
}

/** Deployment history entry */
export interface DeploymentHistoryEntry {
  readonly timestamp: string;
  readonly service: string;
  readonly previousUrl: string;
  readonly newUrl: string;
  readonly deployedBy?: string;
}
