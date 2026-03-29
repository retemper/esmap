import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ImportMap } from '@esmap/shared';
import { createEmptyImportMap, parseImportMap, serializeImportMap } from '@esmap/shared';
import type { ImportMapStorage, DeploymentHistoryEntry } from './types.js';

/**
 * 파일 시스템 기반 import map 저장소.
 * 간단한 인메모리 lock으로 동시성을 제어한다.
 */
export class FileSystemStorage implements ImportMapStorage {
  private readonly mapPath: string;
  private readonly historyPath: string;
  private lockPromise: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.mapPath = join(dataDir, 'importmap.json');
    this.historyPath = join(dataDir, 'history.json');
  }

  /** 현재 import map을 파일에서 읽는다. */
  async read(): Promise<ImportMap | null> {
    try {
      const content = await readFile(this.mapPath, 'utf-8');
      return parseImportMap(content);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  /** import map을 lock 내에서 원자적으로 갱신한다. */
  async update(updater: (current: ImportMap) => ImportMap): Promise<ImportMap> {
    return this.withLock(async () => {
      const current = (await this.read()) ?? createEmptyImportMap();
      const updated = updater(current);

      await mkdir(dirname(this.mapPath), { recursive: true });
      await writeFile(this.mapPath, serializeImportMap(updated), 'utf-8');

      return updated;
    });
  }

  /** 배포 이력을 파일에 추가한다. */
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

  /** 최근 배포 이력을 조회한다. */
  async getHistory(limit = 50): Promise<readonly DeploymentHistoryEntry[]> {
    const history = await this.readHistory();
    return history.slice(0, limit);
  }

  /** 이력 파일을 읽는다. */
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
   * 간단한 인메모리 lock. 동시 요청을 직렬화한다.
   * 이전 작업 실패 여부와 관계없이 다음 작업은 순차적으로 실행된다.
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.lockPromise;
    // 이전 작업이 실패해도 lock을 해제하고 다음 작업을 실행한다
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

/** Node.js 에러 타입 가드 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * 값이 DeploymentHistoryEntry 구조를 만족하는지 확인한다.
 * @param value - 검증할 값
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
