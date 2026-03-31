import type { ImportMap, ImportMapMergeStrategy } from '../types/import-map.js';
import { ImportMapError, ImportMapConflictError } from '../errors.js';
import { isRecord } from './type-guards.js';

/**
 * Creates an empty import map.
 */
export function createEmptyImportMap(): ImportMap {
  return { imports: {} };
}

/**
 * Merges two import maps.
 * @param base - base import map
 * @param overlay - import map to overlay
 * @param strategy - conflict resolution strategy
 */
export function mergeImportMaps(
  base: ImportMap,
  overlay: ImportMap,
  strategy: ImportMapMergeStrategy = 'override',
): ImportMap {
  const mergedImports = mergeRecords(base.imports, overlay.imports, strategy);
  const mergedScopes = mergeScopes(base.scopes, overlay.scopes, strategy);
  const mergedIntegrity = mergeOptionalRecords(base.integrity, overlay.integrity, strategy);

  return {
    imports: mergedImports,
    ...(mergedScopes ? { scopes: mergedScopes } : {}),
    ...(mergedIntegrity ? { integrity: mergedIntegrity } : {}),
  };
}

/**
 * Parses and validates an import map JSON string.
 * @param json - import map JSON string
 */
export function parseImportMap(json: string): ImportMap {
  const parsed: unknown = JSON.parse(json);

  if (!isRecord(parsed)) {
    throw new ImportMapError('Import map must be a JSON object');
  }

  if (!('imports' in parsed) || !isRecord(parsed.imports)) {
    throw new ImportMapError('Import map must have an "imports" object');
  }

  validateStringRecord(parsed.imports, 'imports');
  const imports: Record<string, string> = parsed.imports;

  const scopes = parseScopes(parsed);
  const integrity = parseIntegrity(parsed);

  return {
    imports,
    ...(scopes ? { scopes } : {}),
    ...(integrity ? { integrity } : {}),
  };
}

/**
 * Parses and validates scopes from an import map object.
 * @param parsed - parsed import map object
 */
function parseScopes(
  parsed: Record<string, unknown>,
): Record<string, Record<string, string>> | undefined {
  if (!('scopes' in parsed) || parsed.scopes === undefined) return undefined;

  if (!isRecord(parsed.scopes)) {
    throw new ImportMapError('"scopes" must be an object');
  }

  const scopes: Record<string, Record<string, string>> = {};
  for (const [scopeKey, scopeValue] of Object.entries(parsed.scopes)) {
    if (!isRecord(scopeValue)) {
      throw new ImportMapError(`"scopes.${scopeKey}" must be an object`);
    }
    validateStringRecord(scopeValue, `scopes.${scopeKey}`);
    scopes[scopeKey] = scopeValue;
  }
  return scopes;
}

/**
 * Parses and validates integrity from an import map object.
 * @param parsed - parsed import map object
 */
function parseIntegrity(parsed: Record<string, unknown>): Record<string, string> | undefined {
  if (!('integrity' in parsed) || parsed.integrity === undefined) return undefined;

  if (!isRecord(parsed.integrity)) {
    throw new ImportMapError('"integrity" must be an object');
  }

  validateStringRecord(parsed.integrity, 'integrity');
  return parsed.integrity;
}

/**
 * Serializes an import map to a sorted JSON string.
 * @param importMap - import map to serialize
 * @param indent - indentation size
 */
export function serializeImportMap(importMap: ImportMap, indent = 2): string {
  const sorted: ImportMap = {
    imports: sortRecord(importMap.imports),
    ...(importMap.scopes
      ? {
          scopes: Object.fromEntries(
            Object.entries(importMap.scopes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, sortRecord(value)]),
          ),
        }
      : {}),
    ...(importMap.integrity ? { integrity: sortRecord(importMap.integrity) } : {}),
  };
  return JSON.stringify(sorted, null, indent);
}

/**
 * Validates that all values in a Record are strings and returns a type-safe Record.
 * @param record - Record to validate
 * @param path - path for error messages
 */
function validateStringRecord(
  record: Record<string, unknown>,
  path: string,
): asserts record is Record<string, string> {
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'string') {
      throw new ImportMapError(`"${path}.${key}" must be a string, got ${typeof value}`);
    }
  }
}

/**
 * Sorts a Record alphabetically by key.
 * @param record - Record to sort
 */
function sortRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Merges two string Records. Handles conflicts according to the strategy.
 * @param base - base record
 * @param overlay - overlay record
 * @param strategy - conflict resolution strategy
 */
function mergeRecords(
  base: Readonly<Record<string, string>>,
  overlay: Readonly<Record<string, string>>,
  strategy: ImportMapMergeStrategy,
): Record<string, string> {
  const result = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    if (key in result) {
      switch (strategy) {
        case 'override':
          result[key] = value;
          break;
        case 'skip':
          break;
        case 'error':
          throw new ImportMapConflictError(key);
        default: {
          const _exhaustive: never = strategy;
          return _exhaustive;
        }
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Merges two nullable Records. Returns undefined if both are absent.
 * @param base - base record (optional)
 * @param overlay - overlay record (optional)
 * @param strategy - conflict resolution strategy
 */
function mergeOptionalRecords(
  base: Readonly<Record<string, string>> | undefined,
  overlay: Readonly<Record<string, string>> | undefined,
  strategy: ImportMapMergeStrategy,
): Record<string, string> | undefined {
  if (!base && !overlay) return undefined;
  if (!base) return overlay ? { ...overlay } : undefined;
  if (!overlay) return { ...base };
  return mergeRecords(base, overlay, strategy);
}

/**
 * Merges import map scopes. Merges inner Records for the same scope key.
 * @param base - base scopes (optional)
 * @param overlay - overlay scopes (optional)
 * @param strategy - conflict resolution strategy
 */
function mergeScopes(
  base: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined,
  overlay: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined,
  strategy: ImportMapMergeStrategy,
): Record<string, Record<string, string>> | undefined {
  if (!base && !overlay) return undefined;
  if (!base) {
    return overlay
      ? Object.fromEntries(Object.entries(overlay).map(([k, v]) => [k, { ...v }]))
      : undefined;
  }
  if (!overlay) {
    return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { ...v }]));
  }

  const result: Record<string, Record<string, string>> = {};

  for (const [key, value] of Object.entries(base)) {
    result[key] = { ...value };
  }

  for (const [key, value] of Object.entries(overlay)) {
    if (key in result) {
      result[key] = mergeRecords(result[key], value, strategy);
    } else {
      result[key] = { ...value };
    }
  }

  return result;
}
