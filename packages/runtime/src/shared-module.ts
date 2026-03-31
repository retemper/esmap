import { satisfiesRange, compareVersions } from './semver.js';

/** Configuration required for shared module registration */
export interface SharedModuleConfig {
  /** Module name (e.g. "react") */
  readonly name: string;
  /** Provided version (e.g. "18.3.1") */
  readonly version: string;
  /** Required version range (e.g. "^18.0.0") */
  readonly requiredVersion?: string;
  /** Whether to enforce a single instance */
  readonly singleton?: boolean;
  /** Whether to load immediately. When true, loading starts at register time. */
  readonly eager?: boolean;
  /** Whether to throw an error on version mismatch */
  readonly strictVersion?: boolean;
  /** Factory function that creates the module instance */
  readonly factory: () => Promise<unknown>;
  /** Fallback factory used when version negotiation fails. Takes priority over strictVersion. */
  readonly fallback?: () => Promise<unknown>;
  /** Subpath exports mapping (e.g. { "./client": factory }) */
  readonly subpaths?: Readonly<Record<string, () => Promise<unknown>>>;
  /** Name of the app that registered this module (for ownership tracking) */
  readonly from?: string;
}

/** Loaded module information */
interface LoadedModule {
  /** Selected version */
  readonly version: string;
  /** Loaded module instance */
  readonly module: unknown;
  /** Registrant that provided the module */
  readonly from?: string;
}

/** Shared module registry interface */
export interface SharedModuleRegistry {
  /** Registers a shared module. Starts loading immediately when eager is true. */
  register(config: SharedModuleConfig): void;
  /** Resolves and loads a shared module by name. Prevents duplicate loading on concurrent calls. */
  resolve(name: string): Promise<unknown>;
  /** Resolves a shared module by subpath (e.g. resolve('react-dom', './client')). */
  resolveSubpath(name: string, subpath: string): Promise<unknown>;
  /** Returns all registered module configurations. */
  getRegistered(): ReadonlyMap<string, readonly SharedModuleConfig[]>;
  /** Returns all already loaded modules. */
  getLoaded(): ReadonlyMap<string, LoadedModule>;
  /** Waits until all eager modules have finished loading. */
  waitForEager(): Promise<void>;
}

/** Error thrown when version negotiation fails */
export class SharedVersionConflictError extends Error {
  /** Name of the module where the conflict occurred */
  readonly moduleName: string;

  /**
   * Creates a version conflict error.
   * @param moduleName - name of the module where the conflict occurred
   * @param message - error message
   */
  constructor(moduleName: string, message: string) {
    super(message);
    this.name = 'SharedVersionConflictError';
    this.moduleName = moduleName;
  }
}

/**
 * Creates a shared module registry.
 * Negotiates versions of shared dependencies registered by multiple MFE apps,
 * selects the optimal version, and shares a single instance.
 * @returns SharedModuleRegistry instance
 */
export function createSharedModuleRegistry(): SharedModuleRegistry {
  const registered = new Map<string, SharedModuleConfig[]>();
  const loaded = new Map<string, LoadedModule>();
  /** Inflight cache to prevent duplicate concurrent resolve calls */
  const inflight = new Map<string, Promise<unknown>>();
  /** Eager loading Promise tracking */
  const eagerPromises: Array<Promise<void>> = [];
  /** Per-subpath loaded module cache */
  const loadedSubpaths = new Map<string, unknown>();

  /**
   * Generates a subpath cache key.
   * @param name - module name
   * @param subpath - subpath (e.g. "./client")
   */
  function subpathKey(name: string, subpath: string): string {
    return `${name}::${subpath}`;
  }

  /**
   * Registers a shared module in the registry. Starts loading immediately when eager is true.
   * @param config - module configuration to register
   */
  function register(config: SharedModuleConfig): void {
    const existing = registered.get(config.name) ?? [];
    registered.set(config.name, [...existing, config]);

    // Start loading immediately when eager is true
    if (config.eager) {
      const promise = resolve(config.name)
        .then(() => undefined)
        .catch(() => undefined);
      eagerPromises.push(promise);
    }
  }

  /**
   * Selects the optimal version from registered candidates and loads the module.
   * Uses inflight cache to prevent duplicate loading when the same module is resolved concurrently.
   * @param name - module name to resolve
   * @returns loaded module instance
   */
  async function resolve(name: string): Promise<unknown> {
    // 1. Return already loaded module
    const cachedModule = loaded.get(name);
    if (cachedModule) {
      return cachedModule.module;
    }

    // 2. Return the same Promise if already loading (dedup)
    const existing = inflight.get(name);
    if (existing) {
      return existing;
    }

    // 3. Start new loading
    const promise = doResolve(name);
    inflight.set(name, promise);

    try {
      return await promise;
    } finally {
      inflight.delete(name);
    }
  }

  /**
   * Actual module resolution logic. Version negotiation -> factory call -> cache storage.
   * @param name - module name to resolve
   */
  async function doResolve(name: string): Promise<unknown> {
    const candidates = registered.get(name);
    if (!candidates || candidates.length === 0) {
      throw new SharedVersionConflictError(name, `Shared module "${name}" is not registered`);
    }

    const selected = selectBestCandidate(name, candidates);
    const module = await selected.factory();

    loaded.set(name, { version: selected.version, module, from: selected.from });

    return module;
  }

  /**
   * Resolves a subpath of a shared module.
   * Finds and loads the factory from the parent module's subpaths mapping.
   * @param name - module name (e.g. "react-dom")
   * @param subpath - subpath (e.g. "./client")
   */
  async function resolveSubpath(name: string, subpath: string): Promise<unknown> {
    const key = subpathKey(name, subpath);

    // Check cache
    const cached = loadedSubpaths.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Search for subpath factory in parent module candidates
    const candidates = registered.get(name);
    if (!candidates || candidates.length === 0) {
      throw new SharedVersionConflictError(name, `Shared module "${name}" is not registered`);
    }

    // Find the subpath factory from the selected best candidate's subpaths
    const selected = selectBestCandidate(name, candidates);
    const subpathFactory = selected.subpaths?.[subpath];

    if (!subpathFactory) {
      throw new SharedVersionConflictError(
        name,
        `Shared module "${name}" does not have subpath "${subpath}" registered. ` +
          `Registered subpaths: [${Object.keys(selected.subpaths ?? {}).join(', ')}]`,
      );
    }

    const module = await subpathFactory();
    loadedSubpaths.set(key, module);
    return module;
  }

  /**
   * Returns all registered module configurations as a read-only Map.
   * @returns registered module Map
   */
  function getRegistered(): ReadonlyMap<string, readonly SharedModuleConfig[]> {
    return registered;
  }

  /**
   * Returns all already loaded modules as a read-only Map.
   * @returns loaded module Map
   */
  function getLoaded(): ReadonlyMap<string, LoadedModule> {
    return loaded;
  }

  /**
   * Waits until all modules marked as eager have finished loading.
   * Individual eager load failures are ignored (caught at register time).
   */
  async function waitForEager(): Promise<void> {
    await Promise.all(eagerPromises);
  }

  return { register, resolve, resolveSubpath, getRegistered, getLoaded, waitForEager };
}

/**
 * Selects the optimal version from the candidate list that satisfies all requiredVersion constraints.
 * When no satisfying version exists, processes in order: fallback -> strictVersion -> warning.
 * @param name - module name
 * @param candidates - list of registered candidate configurations
 * @returns selected candidate configuration
 */
function selectBestCandidate(
  name: string,
  candidates: readonly SharedModuleConfig[],
): SharedModuleConfig {
  const requiredVersions = collectRequiredVersions(candidates);
  const isStrict = candidates.some((c) => c.strictVersion);

  // Sort by version descending
  const sorted = [...candidates].sort((a, b) => compareVersions(b.version, a.version));

  // Find candidates that satisfy all requiredVersion constraints
  const compatible = sorted.filter((candidate) =>
    requiredVersions.every((range) => satisfiesRange(candidate.version, range)),
  );

  if (compatible.length > 0) {
    return compatible[0];
  }

  // No compatible version — check for candidates with fallback factory
  const withFallback = candidates.find((c) => c.fallback !== undefined);
  if (withFallback?.fallback) {
    console.warn(`[esmap] Shared module "${name}" version conflict — using fallback factory.`);
    return {
      ...withFallback,
      factory: withFallback.fallback,
    };
  }

  // No fallback — strict or warn
  const highestCandidate = sorted[0];
  const message =
    `Shared module "${name}" version conflict: ` +
    `available versions [${sorted.map((c) => c.version).join(', ')}], ` +
    `required ranges [${requiredVersions.join(', ')}]. ` +
    `Using highest version ${highestCandidate.version}.`;

  if (isStrict) {
    throw new SharedVersionConflictError(name, message);
  }

  console.warn(`[esmap] ${message}`);
  return highestCandidate;
}

/**
 * Collects all unique requiredVersion ranges from the candidate list.
 * @param candidates - list of candidate configurations
 * @returns array of unique requiredVersion ranges
 */
function collectRequiredVersions(candidates: readonly SharedModuleConfig[]): readonly string[] {
  const versions = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.requiredVersion) {
      versions.add(candidate.requiredVersion);
    }
  }
  return [...versions];
}
