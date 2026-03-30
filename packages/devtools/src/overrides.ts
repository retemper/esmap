import type { ImportMap } from '@esmap/shared';

/** Key for the override map stored in localStorage */
const STORAGE_KEY = 'esmap:overrides';

/** Individual override entry */
export interface OverrideEntry {
  /** Original specifier (e.g., "@flex/checkout") */
  readonly specifier: string;
  /** Replacement URL (e.g., "http://localhost:5173/checkout.js") */
  readonly url: string;
}

/**
 * Reads the current override list from localStorage.
 * Returns an empty array on parse failure.
 */
export function getOverrides(): readonly OverrideEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidOverrideEntry);
  } catch {
    return [];
  }
}

/**
 * Adds or updates an override. Overwrites the URL if the same specifier exists.
 * @param specifier - module specifier to override
 * @param url - replacement URL
 */
export function setOverride(specifier: string, url: string): void {
  try {
    const overrides = [...getOverrides()];
    const existingIndex = overrides.findIndex((o) => o.specifier === specifier);

    if (existingIndex >= 0) {
      overrides[existingIndex] = { specifier, url };
    } else {
      overrides.push({ specifier, url });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* Ignore in private browsing or quota exceeded */
  }
}

/**
 * Removes the override for a specific specifier.
 * @param specifier - module specifier to remove
 */
export function removeOverride(specifier: string): void {
  try {
    const overrides = getOverrides().filter((o) => o.specifier !== specifier);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* Ignore in private browsing */
  }
}

/** Removes all overrides. */
export function clearOverrides(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Ignore in private browsing */
  }
}

/**
 * Applies overrides to an import map. Specifiers with overrides have their URLs replaced.
 * @param importMap - original import map
 * @returns new import map with overrides applied
 */
export function applyOverrides(importMap: ImportMap): ImportMap {
  const overrides = getOverrides();
  if (overrides.length === 0) return importMap;

  const overriddenImports = { ...importMap.imports };

  for (const override of overrides) {
    if (override.specifier in overriddenImports) {
      overriddenImports[override.specifier] = override.url;
    }
  }

  return { ...importMap, imports: overriddenImports };
}

/**
 * Checks whether any overrides are currently active.
 * @returns true if at least one override exists
 */
export function hasActiveOverrides(): boolean {
  return getOverrides().length > 0;
}

/** OverrideEntry type guard */
function isValidOverrideEntry(value: unknown): value is OverrideEntry {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'specifier' in value &&
    typeof value.specifier === 'string' &&
    'url' in value &&
    typeof value.url === 'string'
  );
}
