import type { MfeManifest } from '../types/manifest.js';
import { ManifestValidationError } from '../errors.js';
import { isRecord } from './type-guards.js';

/**
 * Parses and validates an MFE manifest JSON.
 * @param json - manifest JSON string
 */
export function parseManifest(json: string): MfeManifest {
  const parsed: unknown = JSON.parse(json);
  return validateManifest(parsed);
}

/**
 * Validates a manifest object.
 * @param value - value to validate
 */
export function validateManifest(value: unknown): MfeManifest {
  if (!isRecord(value)) {
    throw new ManifestValidationError(['Manifest must be a JSON object']);
  }

  const errors: string[] = [];

  if (typeof value.name !== 'string' || value.name.length === 0) {
    errors.push('"name" must be a non-empty string');
  }

  if (typeof value.version !== 'string' || value.version.length === 0) {
    errors.push('"version" must be a non-empty string');
  }

  if (typeof value.entry !== 'string' || value.entry.length === 0) {
    errors.push('"entry" must be a non-empty string');
  }

  if (!Array.isArray(value.assets)) {
    errors.push('"assets" must be an array');
  } else if (!value.assets.every((a: unknown) => typeof a === 'string')) {
    errors.push('"assets" must contain only strings');
  }

  if (!isRecord(value.dependencies)) {
    errors.push('"dependencies" must be an object');
  } else {
    if (!Array.isArray(value.dependencies.shared)) {
      errors.push('"dependencies.shared" must be an array');
    }
    if (!Array.isArray(value.dependencies.internal)) {
      errors.push('"dependencies.internal" must be an array');
    }
  }

  if (!Array.isArray(value.modulepreload)) {
    errors.push('"modulepreload" must be an array');
  }

  if (errors.length > 0) {
    throw new ManifestValidationError(errors);
  }

  const deps = value.dependencies;
  if (!isRecord(deps)) {
    throw new ManifestValidationError(['"dependencies" must be an object']);
  }

  return buildValidatedManifest(value, deps);
}

/**
 * Converts an unknown value to a string array. Only use on values already validated by Array.isArray.
 * @param value - unknown value verified to be an array
 */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/**
 * Safely constructs an MfeManifest from validated values.
 * @param value - validated Record
 * @param deps - validated dependencies Record
 */
function buildValidatedManifest(
  value: Record<string, unknown>,
  deps: Record<string, unknown>,
): MfeManifest {
  return {
    name: String(value.name),
    version: String(value.version),
    entry: String(value.entry),
    assets: toStringArray(value.assets),
    dependencies: {
      shared: toStringArray(deps.shared),
      internal: toStringArray(deps.internal),
    },
    modulepreload: toStringArray(value.modulepreload),
    ...(isRecord(value.metadata) ? { metadata: value.metadata } : {}),
  };
}

/**
 * Generates CDN URLs from a manifest.
 * @param manifest - MFE manifest
 * @param cdnBase - CDN base URL (e.g., "https://cdn.flex.team")
 * @param appPath - app path prefix (e.g., "apps/checkout")
 */
export function resolveManifestUrls(
  manifest: MfeManifest,
  cdnBase: string,
  appPath: string,
): {
  readonly entryUrl: string;
  readonly assetUrls: readonly string[];
  readonly preloadUrls: readonly string[];
} {
  const base = cdnBase.replace(/\/$/, '');
  const path = appPath.replace(/^\/|\/$/g, '');

  return {
    entryUrl: `${base}/${path}/${manifest.entry}`,
    assetUrls: manifest.assets.map((asset) => `${base}/${path}/${asset}`),
    preloadUrls: manifest.modulepreload.map((mod) => `${base}/${path}/${mod}`),
  };
}
