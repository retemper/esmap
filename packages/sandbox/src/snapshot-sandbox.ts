/** 스냅샷 샌드박스의 공개 인터페이스 */
interface SnapshotSandbox {
  /** 샌드박스 이름 */
  readonly name: string;
  /** 샌드박스를 활성화하고, 이전 변경사항이 있으면 재적용한다 */
  activate(): void;
  /** 샌드박스를 비활성화하고, 변경사항을 되돌린다 */
  deactivate(): void;
  /** 현재 활성 상태인지 반환한다 */
  isActive(): boolean;
}

/**
 * 스냅샷 방식의 샌드박스를 생성하는 팩토리 함수.
 * activate 시 window의 모든 own property를 스냅샷으로 저장하고,
 * deactivate 시 변경사항을 감지하여 되돌린 뒤 diff로 보관한다.
 * @param name - 샌드박스 식별 이름
 * @returns 스냅샷 샌드박스 인스턴스
 */
function createSnapshotSandbox(name: string): SnapshotSandbox {
  /** 활성화 시점의 window 속성 스냅샷 */
  const snapshot = new Map<PropertyKey, unknown>();

  /** 비활성화 시 저장된 변경사항 diff */
  const diff = new Map<PropertyKey, unknown>();

  /** 스냅샷에 있었지만 deactivate 시 삭제된 속성 */
  const addedProps = new Set<PropertyKey>();

  /** 현재 활성 상태 */
  const state = { active: false };

  /** 쓰기 가능한 속성인지 확인한다 */
  function isWritable(key: string): boolean {
    const descriptor = Object.getOwnPropertyDescriptor(window, key);
    return descriptor?.writable === true || descriptor?.set !== undefined;
  }

  /** window의 모든 writable own property를 스냅샷에 저장한다 */
  function captureSnapshot(): void {
    snapshot.clear();
    const keys = Object.getOwnPropertyNames(window);
    for (const key of keys) {
      if (!isWritable(key)) {
        continue;
      }
      snapshot.set(key, (window as unknown as Record<PropertyKey, unknown>)[key]);
    }
  }

  /** 현재 window와 스냅샷의 차이를 감지하여 diff에 저장하고 되돌린다 */
  function restoreAndCaptureDiff(): void {
    diff.clear();
    addedProps.clear();

    const currentKeys = Object.getOwnPropertyNames(window);
    const windowRecord = window as unknown as Record<PropertyKey, unknown>;

    for (const key of currentKeys) {
      if (!isWritable(key)) {
        continue;
      }
      const currentValue = windowRecord[key];
      if (!snapshot.has(key)) {
        diff.set(key, currentValue);
        addedProps.add(key);
        deleteWindowProp(key);
      } else if (currentValue !== snapshot.get(key)) {
        diff.set(key, currentValue);
        try {
          windowRecord[key] = snapshot.get(key);
        } catch {
          // read-only 속성은 복원 불가
        }
      }
    }
  }

  /** window에서 속성을 안전하게 삭제한다 */
  function deleteWindowProp(key: PropertyKey): void {
    try {
      delete (window as unknown as Record<PropertyKey, unknown>)[key];
    } catch {
      // configurable: false인 속성은 삭제 불가
    }
  }

  /** 저장된 diff를 window에 재적용한다 */
  function applyDiff(): void {
    const windowRecord = window as unknown as Record<PropertyKey, unknown>;
    for (const [key, value] of diff) {
      try {
        windowRecord[key] = value;
      } catch {
        // read-only 속성은 재적용 불가
      }
    }
  }

  return {
    name,

    activate(): void {
      if (state.active) {
        return;
      }
      state.active = true;

      if (diff.size > 0) {
        applyDiff();
      }

      captureSnapshot();
    },

    deactivate(): void {
      if (!state.active) {
        return;
      }
      state.active = false;
      restoreAndCaptureDiff();
    },

    isActive(): boolean {
      return state.active;
    },
  };
}

export { createSnapshotSandbox };
export type { SnapshotSandbox };
