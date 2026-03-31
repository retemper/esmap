import { readFile } from 'node:fs/promises';
import type { MfeManifest } from '@esmap/shared';
import type { AppDependencyDeclaration } from './analyze-deps.js';

/** File read function type (for test injection) */
type ReadFileFn = (path: string, encoding: BufferEncoding) => Promise<string | Buffer>;

/**
 * Checks whether a value satisfies the MfeManifest structure.
 * @param value - value to validate
 */
function isMfeManifest(value: unknown): value is MfeManifest {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'entry' in value &&
    typeof value.entry === 'string'
  );
}

/**
 * Safely extracts the dependency version map from a manifest object.
 * Assumes it is stored as Record<string, string> in metadata.dependencyVersions.
 * @param manifest - MFE manifest
 */
function extractVersionMap(manifest: MfeManifest): ReadonlyMap<string, string> {
  const result = new Map<string, string>();

  const metadata = manifest.metadata;
  if (metadata === undefined || typeof metadata !== 'object') {
    return result;
  }

  const versions = metadata['dependencyVersions'];
  if (versions === undefined || typeof versions !== 'object' || versions === null) {
    return result;
  }

  for (const [key, value] of Object.entries(versions)) {
    if (typeof value === 'string') {
      result.set(key, value);
    }
  }

  return result;
}

/**
 * Extracts dependency declarations from a list of manifest file paths.
 * @param manifestPaths - list of manifest JSON file paths
 * @param readFn - file read function (for test injection)
 */
export async function extractDeclarationsFromManifests(
  manifestPaths: readonly string[],
  readFn: ReadFileFn = readFile,
): Promise<readonly AppDependencyDeclaration[]> {
  const declarations: AppDependencyDeclaration[] = [];

  for (const manifestPath of manifestPaths) {
    try {
      const content = await readFn(manifestPath, 'utf-8');
      const parsed: unknown = JSON.parse(content.toString());

      if (!isMfeManifest(parsed)) {
        continue;
      }

      const dependencies = extractVersionMap(parsed);

      declarations.push({
        appName: parsed.name,
        dependencies,
      });
    } catch {
      /* Skip if the file cannot be read or JSON parsing fails */
    }
  }

  return declarations;
}
