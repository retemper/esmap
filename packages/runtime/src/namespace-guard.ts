/**
 * 전역 자원의 네임스페이스 충돌을 감지하고 방지하는 가드.
 * 공유 모듈, 이벤트, 상태 키 등 여러 MFE 앱이 접근하는 자원에
 * 소유권을 추적하여 의도치 않은 덮어쓰기를 차단한다.
 */

/** 네임스페이스 가드 이벤트 종류 */
type ConflictAction = 'warn' | 'error' | 'skip';

/** 네임스페이스 가드 옵션 */
interface NamespaceGuardOptions {
  /** 충돌 감지 시 동작. 기본값: 'warn' */
  readonly onConflict?: ConflictAction;
  /** 허용된 공유 키 목록. 이 키들은 여러 앱이 등록해도 충돌로 간주하지 않는다 */
  readonly allowedSharedKeys?: ReadonlyArray<string>;
}

/** 키 소유권 정보 */
interface OwnershipRecord {
  /** 키를 최초 등록한 앱 이름 */
  readonly owner: string;
  /** 등록 시점 */
  readonly registeredAt: number;
}

/** 네임스페이스 가드 인터페이스 */
interface NamespaceGuard {
  /** 키 등록을 시도한다. 이미 다른 앱이 소유한 키면 충돌 정책에 따라 동작한다. */
  claim: (key: string, owner: string) => boolean;
  /** 키 소유권을 해제한다. */
  release: (key: string, owner: string) => void;
  /** 특정 앱이 소유한 모든 키를 해제한다. */
  releaseAll: (owner: string) => void;
  /** 키의 현재 소유자를 조회한다. */
  getOwner: (key: string) => string | undefined;
  /** 등록된 모든 키-소유자 매핑을 반환한다. */
  getAll: () => ReadonlyMap<string, OwnershipRecord>;
  /** 특정 앱이 소유한 키 목록을 반환한다. */
  getOwnedBy: (owner: string) => readonly string[];
}

/**
 * 전역 자원의 네임스페이스 충돌 가드를 생성한다.
 *
 * @example
 * ```ts
 * const guard = createNamespaceGuard({ onConflict: 'error' });
 * guard.claim('theme', 'app-a');     // true — 등록 성공
 * guard.claim('theme', 'app-b');     // throws — 충돌
 * guard.claim('theme', 'app-a');     // true — 같은 소유자의 재등록은 허용
 * ```
 *
 * @param options - 가드 설정
 * @returns 네임스페이스 가드 인스턴스
 */
function createNamespaceGuard(options?: NamespaceGuardOptions): NamespaceGuard {
  const onConflict = options?.onConflict ?? 'warn';
  const allowedSharedKeys = new Set(options?.allowedSharedKeys ?? []);
  const registry = new Map<string, OwnershipRecord>();

  /**
   * 충돌 발생 시 설정된 정책에 따라 처리한다.
   * @param key - 충돌된 키
   * @param existingOwner - 기존 소유자
   * @param newOwner - 새 등록 시도자
   * @returns claim 성공 여부
   */
  function handleConflict(key: string, existingOwner: string, newOwner: string): boolean {
    const message =
      `[esmap] 네임스페이스 충돌: 키 "${key}"는 "${existingOwner}"이(가) 소유 중. ` +
      `"${newOwner}"이(가) 등록을 시도했습니다.`;

    switch (onConflict) {
      case 'error':
        throw new Error(message);
      case 'skip':
        return false;
      case 'warn':
        console.warn(message);
        return false;
      default: {
        const _exhaustive: never = onConflict;
        return _exhaustive;
      }
    }
  }

  return {
    claim(key: string, owner: string): boolean {
      // 공유 허용된 키는 항상 성공
      if (allowedSharedKeys.has(key)) {
        if (!registry.has(key)) {
          registry.set(key, { owner, registeredAt: Date.now() });
        }
        return true;
      }

      const existing = registry.get(key);

      // 미등록 키
      if (existing === undefined) {
        registry.set(key, { owner, registeredAt: Date.now() });
        return true;
      }

      // 같은 소유자의 재등록
      if (existing.owner === owner) {
        return true;
      }

      // 다른 소유자의 충돌
      return handleConflict(key, existing.owner, owner);
    },

    release(key: string, owner: string): void {
      const existing = registry.get(key);
      if (existing !== undefined && existing.owner === owner) {
        registry.delete(key);
      }
    },

    releaseAll(owner: string): void {
      for (const [key, record] of registry) {
        if (record.owner === owner) {
          registry.delete(key);
        }
      }
    },

    getOwner(key: string): string | undefined {
      return registry.get(key)?.owner;
    },

    getAll(): ReadonlyMap<string, OwnershipRecord> {
      return registry;
    },

    getOwnedBy(owner: string): readonly string[] {
      const keys: string[] = [];
      for (const [key, record] of registry) {
        if (record.owner === owner) {
          keys.push(key);
        }
      }
      return keys;
    },
  };
}

export { createNamespaceGuard };
export type { NamespaceGuard, NamespaceGuardOptions, OwnershipRecord, ConflictAction };
