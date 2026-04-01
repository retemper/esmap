import type { ImportMap } from '@esmap/shared';
import { AppLifecycleError } from '@esmap/shared';
import { createImportMapResolver } from './import-map-resolver.js';
import { createServerModuleLoader } from './module-loader.js';
import type {
  ImportMapResolver,
  RenderAppOptions,
  ServerModuleLoader,
  SsrMfeModule,
  SsrRenderResult,
  SsrRenderer,
  SsrRendererOptions,
} from './types.js';

/**
 * Creates an SSR renderer that loads MFE modules on the server and renders them to HTML.
 * Modules must export an `ssrRender` function that returns HTML markup.
 *
 * @param options - renderer configuration with import map and optional module loader
 * @returns SSR renderer instance
 */
export function createSsrRenderer(options: SsrRendererOptions): SsrRenderer {
  const { importMap, externals = {} } = options;
  const resolver = createImportMapResolver(importMap);
  const moduleLoader = options.moduleLoader ?? createServerModuleLoader({ resolver, externals });

  return {
    async renderApp(appName: string, renderOptions?: RenderAppOptions): Promise<SsrRenderResult> {
      const module = await loadSsrModule(appName, moduleLoader);
      const html = await module.ssrRender(renderOptions?.props);

      const preloadUrls = collectPreloadUrls(appName, importMap, resolver);

      return {
        html,
        head: '',
        importMap,
        preloadUrls,
      };
    },
    moduleLoader,
    resolver,
  };
}

/** Loads a module and validates it has an ssrRender export */
async function loadSsrModule(appName: string, loader: ServerModuleLoader): Promise<SsrMfeModule> {
  const module: unknown = await loader.load(appName);

  if (!isRecord(module)) {
    throw new AppLifecycleError(appName, 'load', new Error('Module does not export an object.'));
  }

  if (hasSsrRender(module)) return module;

  const defaultExport = module.default;
  if (isRecord(defaultExport) && hasSsrRender(defaultExport)) return defaultExport;

  throw new AppLifecycleError(
    appName,
    'load',
    new Error(
      `Module does not export an ssrRender() function. ` +
        `For SSR support, the MFE module must export ssrRender(props?) returning HTML.`,
    ),
  );
}

/** Collects modulepreload URLs for the app entry and its mapped dependencies */
function collectPreloadUrls(
  appName: string,
  importMap: ImportMap,
  resolver: ImportMapResolver,
): readonly string[] {
  const urls: string[] = [];
  try {
    const entryUrl = resolver.resolve(appName);
    urls.push(entryUrl);
  } catch {
    // App might not be in the import map (loaded by URL directly)
  }
  return urls;
}

/** Type guard for record objects */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Type guard for SsrMfeModule */
function hasSsrRender(
  value: Record<string, unknown>,
): value is Record<string, unknown> & SsrMfeModule {
  return typeof value.ssrRender === 'function';
}
