import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ImportMapError } from '@esmap/shared';
import type { ImportMapResolver, ServerModuleLoader, ServerModuleLoaderOptions } from './types.js';

/** Cached module entry with expiry tracking */
interface CacheEntry {
  readonly module: unknown;
  readonly loadedAt: number;
}

/**
 * Creates a server-side module loader that fetches and evaluates ESM modules.
 * Uses the import map resolver for bare specifier resolution and native fetch for retrieval.
 * Modules from `externals` are resolved from local node_modules via dynamic import.
 *
 * Fetched ESM sources are written to temporary files and evaluated via native `import()`,
 * preserving full ESM semantics without requiring `--experimental-vm-modules`.
 *
 * @param options - loader configuration including resolver and optional externals
 * @returns server module loader instance
 */
export function createServerModuleLoader(options: ServerModuleLoaderOptions): ServerModuleLoader {
  const { resolver, fetchFn = globalThis.fetch, cacheTtl = 0, externals = {} } = options;
  const cache = new Map<string, CacheEntry>();

  return {
    async load<T = unknown>(specifier: string): Promise<T> {
      if (specifier in externals) {
        return importLocal(externals[specifier]) as Promise<T>;
      }

      const url = resolveToUrl(specifier, resolver);
      const cached = getCached(url, cacheTtl, cache);
      if (cached !== undefined) return cached as T;

      const module = await fetchAndEvaluate(url, fetchFn, resolver, externals);
      cache.set(url, { module, loadedAt: Date.now() });
      return module as T;
    },

    async prefetch(specifiers: readonly string[]): Promise<void> {
      await Promise.all(
        specifiers.map(async (specifier) => {
          if (specifier in externals) return;

          const url = resolveToUrl(specifier, resolver);
          if (getCached(url, cacheTtl, cache) !== undefined) return;

          const module = await fetchAndEvaluate(url, fetchFn, resolver, externals);
          cache.set(url, { module, loadedAt: Date.now() });
        }),
      );
    },

    clearCache(): void {
      cache.clear();
    },
  };
}

/** Resolves a specifier to an absolute URL, passing through absolute URLs as-is */
function resolveToUrl(specifier: string, resolver: ImportMapResolver): string {
  try {
    new URL(specifier);
    return specifier;
  } catch {
    return resolver.resolve(specifier);
  }
}

/** Returns a cached module if valid, or undefined */
function getCached(
  url: string,
  cacheTtl: number,
  cache: Map<string, CacheEntry>,
): unknown | undefined {
  const entry = cache.get(url);
  if (entry === undefined) return undefined;
  if (cacheTtl > 0 && Date.now() - entry.loadedAt > cacheTtl) {
    cache.delete(url);
    return undefined;
  }
  return entry.module;
}

/** Fetches ESM source from a URL and evaluates it by writing to a temp file */
async function fetchAndEvaluate(
  url: string,
  fetchFn: typeof globalThis.fetch,
  resolver: ImportMapResolver,
  externals: Readonly<Record<string, string>>,
): Promise<unknown> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new ImportMapError(
      `Failed to fetch module from "${url}": ${response.status} ${response.statusText}`,
    );
  }

  const source = await response.text();
  return evaluateEsmViaTempFile(source, resolver, externals);
}

/**
 * Evaluates ESM source code by writing it to a temporary file and importing it.
 * Rewrites bare import specifiers to their resolved URLs before evaluation.
 */
async function evaluateEsmViaTempFile(
  source: string,
  resolver: ImportMapResolver,
  externals: Readonly<Record<string, string>>,
): Promise<unknown> {
  const rewritten = rewriteImports(source, resolver, externals);
  const tempDir = join(tmpdir(), 'esmap-ssr');
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `${randomUUID()}.mjs`);

  try {
    await writeFile(tempPath, rewritten, 'utf-8');
    const module = await import(tempPath);
    return module;
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

/**
 * Rewrites bare import specifiers in ESM source to absolute URLs.
 * Handles static imports (import ... from 'specifier') and dynamic imports (import('specifier')).
 */
function rewriteImports(
  source: string,
  resolver: ImportMapResolver,
  externals: Readonly<Record<string, string>>,
): string {
  // Rewrite static imports: import ... from 'specifier' and export ... from 'specifier'
  const staticImportRegex = /((?:import|export)\s+(?:[\s\S]*?\s+from\s+))(['"])([^'"]+)\2/g;
  // Rewrite dynamic imports: import('specifier')
  const dynamicImportRegex = /(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g;

  const rewriteSpecifier = (specifier: string): string => {
    if (specifier in externals) return externals[specifier];
    if (isAbsoluteUrlOrRelative(specifier)) return specifier;
    try {
      return resolver.resolve(specifier);
    } catch {
      return specifier;
    }
  };

  return source
    .replace(staticImportRegex, (_match, prefix, quote, specifier) => {
      return `${prefix}${quote}${rewriteSpecifier(specifier)}${quote}`;
    })
    .replace(dynamicImportRegex, (_match, prefix, quote, specifier, suffix) => {
      return `${prefix}${quote}${rewriteSpecifier(specifier)}${quote}${suffix}`;
    });
}

/** Checks whether a string is an absolute URL or a relative path */
function isAbsoluteUrlOrRelative(value: string): boolean {
  if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/')) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Imports a module from local node_modules */
async function importLocal(moduleId: string): Promise<unknown> {
  return import(moduleId);
}
