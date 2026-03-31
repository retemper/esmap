import {
  getOverrides,
  setOverride,
  removeOverride,
  clearOverrides,
  hasActiveOverrides,
} from './overrides.js';
import { createDevtoolsInspector } from './inspector.js';
import type { DevtoolsInspector } from './inspector.js';

/**
 * Devtools API accessible from the browser console.
 * Access via `window.__ESMAP__`.
 */
export interface EsmapDevtoolsApi {
  /** Prints the list of currently active overrides. */
  readonly overrides: () => void;
  /** Overrides a module URL. Takes effect after page reload. */
  readonly override: (specifier: string, url: string) => void;
  /** Removes the override for a specific module. */
  readonly removeOverride: (specifier: string) => void;
  /** Removes all overrides. */
  readonly clearOverrides: () => void;
  /** Returns whether any overrides are currently active. */
  readonly isOverriding: () => boolean;
  /** Runtime state inspector. Query events/modules/app state after calling connect(). */
  readonly inspect: DevtoolsInspector;
}

/** Creates the devtools API singleton instance. */
function createDevtoolsApi(): EsmapDevtoolsApi {
  return {
    inspect: createDevtoolsInspector(),

    overrides() {
      const entries = getOverrides();
      if (entries.length === 0) {
        console.log('[esmap] No active overrides');
        return;
      }
      console.group(`[esmap] Active overrides (${entries.length})`);
      for (const entry of entries) {
        console.log(`${entry.specifier} → ${entry.url}`);
      }
      console.groupEnd();
    },

    override(specifier: string, url: string) {
      setOverride(specifier, url);
      console.log(`[esmap] Override set: ${specifier} → ${url}`);
      console.log('[esmap] Reload the page to apply changes.');
    },

    removeOverride(specifier: string) {
      removeOverride(specifier);
      console.log(`[esmap] Override removed: ${specifier}`);
    },

    clearOverrides() {
      clearOverrides();
      console.log('[esmap] All overrides cleared');
    },

    isOverriding() {
      return hasActiveOverrides();
    },
  };
}

/** Type augmentation for adding the __ESMAP__ property to globalThis */
declare global {
  /** Devtools API instance. Access via window.__ESMAP__. */
  var __ESMAP__: EsmapDevtoolsApi | undefined;
}

/**
 * Registers the devtools API on window.__ESMAP__.
 * Skips registration if already present.
 */
export function installDevtoolsApi(): void {
  if (globalThis.__ESMAP__) return;

  globalThis.__ESMAP__ = createDevtoolsApi();
}
