import type { ImportMap } from '@esmap/shared';

/**
 * import map 저장소 인터페이스.
 * 구현체는 동시성 안전한 read-write를 보장해야 한다.
 */
export interface ImportMapStorage {
  /** 현재 import map을 읽는다. 없으면 null. */
  read(): Promise<ImportMap | null>;
  /** import map을 원자적으로 갱신한다. updater는 lock 내에서 실행된다. */
  update(updater: (current: ImportMap) => ImportMap): Promise<ImportMap>;
  /** 배포 이력을 저장한다. */
  appendHistory(entry: DeploymentHistoryEntry): Promise<void>;
  /** 최근 배포 이력을 조회한다. */
  getHistory(limit?: number): Promise<readonly DeploymentHistoryEntry[]>;
}

/** 배포 이력 항목 */
export interface DeploymentHistoryEntry {
  readonly timestamp: string;
  readonly service: string;
  readonly previousUrl: string;
  readonly newUrl: string;
  readonly deployedBy?: string;
}
