import type { ImportMap } from '@esmap/shared';
import { ImportMapError } from '@esmap/shared';
import type { ImportMapResolver } from './types.js';

/**
 * Creates a server-side import map resolver.
 * Implements the W3C import map resolution algorithm for bare specifiers,
 * enabling the same import map used in the browser to resolve modules on the server.
 *
 * @param importMap - W3C import map (same format as browser import maps)
 * @returns resolver that maps bare specifiers to absolute URLs
 */
export function createImportMapResolver(importMap: ImportMap): ImportMapResolver {
  const { imports, scopes } = importMap;

  return {
    resolve(specifier: string, referrerUrl?: string): string {
      if (referrerUrl && scopes) {
        const scopedResult = resolveFromScopes(specifier, referrerUrl, scopes);
        if (scopedResult !== null) return scopedResult;
      }

      const topLevelResult = resolveFromMappings(specifier, imports);
      if (topLevelResult !== null) return topLevelResult;

      if (isAbsoluteUrl(specifier)) return specifier;

      throw new ImportMapError(
        `Cannot resolve specifier "${specifier}"${referrerUrl ? ` (referrer: ${referrerUrl})` : ''}. ` +
          `The specifier is not mapped in the import map.`,
      );
    },
  };
}

/**
 * Resolves a specifier against scoped mappings.
 * Scopes are matched by longest prefix of the referrer URL.
 */
function resolveFromScopes(
  specifier: string,
  referrerUrl: string,
  scopes: Readonly<Record<string, Readonly<Record<string, string>>>>,
): string | null {
  const sortedScopes = Object.keys(scopes).sort((a, b) => b.length - a.length);

  for (const scopePrefix of sortedScopes) {
    if (referrerUrl.startsWith(scopePrefix)) {
      const result = resolveFromMappings(specifier, scopes[scopePrefix]);
      if (result !== null) return result;
    }
  }

  return null;
}

/**
 * Resolves a specifier against a set of import mappings.
 * Supports exact matches and package-path prefix matches (trailing slash).
 */
function resolveFromMappings(
  specifier: string,
  mappings: Readonly<Record<string, string>>,
): string | null {
  if (specifier in mappings) {
    return mappings[specifier];
  }

  const sortedPrefixes = Object.keys(mappings)
    .filter((key) => key.endsWith('/'))
    .sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (specifier.startsWith(prefix)) {
      const suffix = specifier.slice(prefix.length);
      return mappings[prefix] + suffix;
    }
  }

  return null;
}

/** Checks whether a string is an absolute URL */
function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
