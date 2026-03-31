import type { ImportMap } from '@esmap/shared';
import { ImportMapLoadError } from '@esmap/shared';

/** Common options for the import map loader */
interface LoaderBaseOptions {
  /** Whether to automatically inject modulepreload hints */
  readonly injectPreload?: boolean;
}

/** Server mode options for fetching import map from a URL */
interface LoaderUrlOptions extends LoaderBaseOptions {
  /** URL to fetch the import map JSON from */
  readonly importMapUrl: string;
  readonly inlineImportMap?: never;
}

/** Static mode options using an inline import map object */
interface LoaderInlineOptions extends LoaderBaseOptions {
  readonly importMapUrl?: never;
  /** Inline import map object */
  readonly inlineImportMap: ImportMap;
}

/**
 * Import map loader options.
 * Either importMapUrl or inlineImportMap must be provided.
 */
export type LoaderOptions = LoaderUrlOptions | LoaderInlineOptions;

/**
 * Loads and applies the import map to the DOM.
 * Skips injection if a native import map already exists.
 * @param options - loader options
 */
export async function loadImportMap(options: LoaderOptions): Promise<ImportMap> {
  const importMap = await resolveImportMap(options);

  if (!hasExistingImportMap()) {
    injectImportMapScript(importMap);
  }

  if (options.injectPreload !== false) {
    injectModulePreloadHints(importMap);
  }

  return importMap;
}

/** Fetches the import map from a URL or uses the inline object. */
async function resolveImportMap(options: LoaderOptions): Promise<ImportMap> {
  if (options.inlineImportMap) {
    return options.inlineImportMap;
  }

  if (options.importMapUrl) {
    const response = await fetch(options.importMapUrl);
    if (!response.ok) {
      throw new ImportMapLoadError(
        `Failed to load import map: ${response.status} ${response.statusText}`,
        {
          url: options.importMapUrl,
          status: response.status,
        },
      );
    }
    const json: unknown = await response.json();
    return parseImportMapJson(json, options.importMapUrl);
  }

  throw new ImportMapLoadError('Either importMapUrl or inlineImportMap is required');
}

/** Type guard that checks whether a JSON response is a valid ImportMap structure */
function isImportMap(value: unknown): value is ImportMap {
  if (typeof value !== 'object' || value === null) return false;
  if (!('imports' in value) || typeof value.imports !== 'object' || value.imports === null) {
    return false;
  }
  return Object.values(value.imports).every((v) => typeof v === 'string');
}

/** Parses a JSON response into an ImportMap. Throws an error if invalid. */
function parseImportMapJson(json: unknown, url: string): ImportMap {
  if (isImportMap(json)) {
    return json;
  }
  throw new ImportMapLoadError(`Invalid import map format: ${url}`);
}

/** Checks whether an import map has already been applied. */
function hasExistingImportMap(): boolean {
  return document.querySelector('script[type="importmap"]') !== null;
}

/** Injects the import map JSON into the DOM as a <script type="importmap">. */
function injectImportMapScript(importMap: ImportMap): void {
  const script = document.createElement('script');
  script.type = 'importmap';
  script.textContent = JSON.stringify(importMap);

  const firstScript = document.querySelector('script[type="module"]');
  if (firstScript) {
    firstScript.before(script);
  } else {
    document.head.appendChild(script);
  }
}

/** Injects modulepreload link elements for all modules in the import map. */
function injectModulePreloadHints(importMap: ImportMap): void {
  const existingPreloads = new Set(
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')).map(
      (link) => link.href,
    ),
  );

  for (const url of Object.values(importMap.imports)) {
    if (!existingPreloads.has(url) && url.endsWith('.js')) {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = url;
      document.head.appendChild(link);
    }
  }
}
