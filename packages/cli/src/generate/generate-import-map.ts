import type { ImportMap, MfeManifest, EsmapConfig, SharedDependencyManifest } from '@esmap/shared';
import { serializeImportMap } from '@esmap/shared';

/** Input required for import map generation */
export interface GenerateInput {
  /** Framework configuration */
  readonly config: EsmapConfig;
  /** Manifests for each MFE (app name -> manifest) */
  readonly manifests: Readonly<Record<string, MfeManifest>>;
  /** Shared dependency manifests (package name -> manifest) */
  readonly sharedManifests?: Readonly<Record<string, SharedDependencyManifest>>;
}

/** Import map generation result */
export interface GenerateResult {
  /** Generated import map object */
  readonly importMap: ImportMap;
  /** JSON string (pretty-printed) */
  readonly json: string;
  /** modulepreload target URL list (app name -> URL list) */
  readonly preloadHints: Readonly<Record<string, readonly string[]>>;
}

/**
 * Generates import map JSON from config and manifests.
 * @param input - config and manifest data required for generation
 */
export function generateImportMap(input: GenerateInput): GenerateResult {
  const { config, manifests, sharedManifests } = input;
  const cdnBase = (config.cdnBase ?? '').replace(/\/$/, '');

  const imports: Record<string, string> = {};
  const scopes: Record<string, Record<string, string>> = {};
  const preloadHints: Record<string, string[]> = {};

  addSharedImports(imports, config, sharedManifests, cdnBase);
  addAppImports(imports, scopes, preloadHints, config, manifests, cdnBase);

  const importMap: ImportMap = {
    imports,
    ...(Object.keys(scopes).length > 0 ? { scopes } : {}),
  };

  return {
    importMap,
    json: serializeImportMap(importMap),
    preloadHints,
  };
}

/** Adds shared dependency imports entries. */
function addSharedImports(
  imports: Record<string, string>,
  config: EsmapConfig,
  sharedManifests: Readonly<Record<string, SharedDependencyManifest>> | undefined,
  cdnBase: string,
): void {
  for (const [name, sharedConfig] of Object.entries(config.shared)) {
    if (sharedConfig.url) {
      imports[name] = sharedConfig.url;
      continue;
    }

    const manifest = sharedManifests?.[name];
    if (manifest) {
      for (const [subpath, url] of Object.entries(manifest.exports)) {
        const specifier = subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`;
        imports[specifier] = url.startsWith('http') ? url : `${cdnBase}/${url}`;
      }
      continue;
    }

    if (sharedConfig.subpaths) {
      for (const [subpath, target] of Object.entries(sharedConfig.subpaths)) {
        const specifier = `${name}/${subpath.replace(/^\.\//, '')}`;
        imports[specifier] = target.startsWith('http') ? target : `${cdnBase}/${target}`;
      }
    }
  }
}

/** Adds MFE app imports and scopes entries. */
function addAppImports(
  imports: Record<string, string>,
  scopes: Record<string, Record<string, string>>,
  preloadHints: Record<string, string[]>,
  config: EsmapConfig,
  manifests: Readonly<Record<string, MfeManifest>>,
  cdnBase: string,
): void {
  for (const [appName, appConfig] of Object.entries(config.apps)) {
    const manifest = manifests[appName];
    if (!manifest) continue;

    const appBase = `${cdnBase}/${appConfig.path.replace(/^\/|\/$/g, '')}`;
    const entryUrl = `${appBase}/${manifest.entry}`;

    imports[appName] = entryUrl;

    preloadHints[appName] = (manifest.modulepreload ?? []).map((mod) => `${appBase}/${mod}`);
  }
}
