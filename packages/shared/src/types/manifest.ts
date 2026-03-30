/**
 * Manifest generated during MFE build.
 * Each MFE declares its module information, serving as input for import map generation.
 */
export interface MfeManifest {
  /** Package name (e.g., "@flex/checkout") */
  readonly name: string;
  /** Build version */
  readonly version: string;
  /** Entry module filename (with content-hash, e.g., "checkout-a1b2c3.js") */
  readonly entry: string;
  /** Full list of build output files */
  readonly assets: readonly string[];
  /** Dependency declarations */
  readonly dependencies: ManifestDependencies;
  /** List of modules to modulepreload */
  readonly modulepreload: readonly string[];
  /** Extension metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Dependency categories in the manifest */
export interface ManifestDependencies {
  /** List of bare specifiers resolved via import map (shared dependencies) */
  readonly shared: readonly string[];
  /** Modules used only within the same MFE */
  readonly internal: readonly string[];
}

/**
 * Manifest for shared dependency build artifacts.
 * Contains URL information for shared dependencies uploaded to CDN.
 */
export interface SharedDependencyManifest {
  /** Package name (e.g., "react") */
  readonly name: string;
  /** Package version (e.g., "18.3.1") */
  readonly version: string;
  /** Subpath to content-hash URL mapping */
  readonly exports: Readonly<Record<string, string>>;
}
