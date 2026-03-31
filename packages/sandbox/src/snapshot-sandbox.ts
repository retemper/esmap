/** Public interface for the snapshot sandbox */
interface SnapshotSandbox {
  /** Sandbox name */
  readonly name: string;
  /** Activates the sandbox and reapplies previous changes if any */
  activate(): void;
  /** Deactivates the sandbox and reverts changes */
  deactivate(): void;
  /** Returns whether the sandbox is currently active */
  isActive(): boolean;
}

/**
 * Factory function that creates a snapshot-based sandbox.
 * On activate, takes a snapshot of all window own properties,
 * and on deactivate, detects changes, reverts them, and stores the diff.
 * @param name - identifying name for the sandbox
 * @returns snapshot sandbox instance
 */
function createSnapshotSandbox(name: string): SnapshotSandbox {
  /** Snapshot of window properties at activation time */
  const snapshot = new Map<PropertyKey, unknown>();

  /** Change diff stored on deactivation */
  const diff = new Map<PropertyKey, unknown>();

  /** Properties added during activation that were removed on deactivate */
  const addedProps = new Set<PropertyKey>();

  /** Current active state */
  const state = { active: false };

  /** Checks whether a property is writable */
  function isWritable(key: string): boolean {
    const descriptor = Object.getOwnPropertyDescriptor(window, key);
    return descriptor?.writable === true || descriptor?.set !== undefined;
  }

  /** Captures all writable own properties of window into the snapshot */
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

  /** Detects differences between current window and snapshot, stores them in diff, and reverts */
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
          // Cannot restore read-only properties
        }
      }
    }
  }

  /** Safely deletes a property from window */
  function deleteWindowProp(key: PropertyKey): void {
    try {
      delete (window as unknown as Record<PropertyKey, unknown>)[key];
    } catch {
      // Cannot delete properties with configurable: false
    }
  }

  /** Reapplies the stored diff to window */
  function applyDiff(): void {
    const windowRecord = window as unknown as Record<PropertyKey, unknown>;
    for (const [key, value] of diff) {
      try {
        windowRecord[key] = value;
      } catch {
        // Cannot reapply read-only properties
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
