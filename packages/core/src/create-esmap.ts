import type { AppConfig, SharedConfig } from '@esmap/shared';
import {
  AppRegistry,
  Router,
  createLifecycleHooks,
  createPrefetch,
  createSharedModuleRegistry,
} from '@esmap/runtime';
import type { SharedModuleRegistry } from '@esmap/runtime';
import { PerfTracker } from '@esmap/monitor';
import { installDevtoolsApi } from '@esmap/devtools';
import type { EsmapOptions, EsmapInstance } from './types.js';
import { installAutoPerf } from './auto-perf.js';
import type { PluginCleanup } from './plugin.js';
import { installPlugins, runCleanups } from './plugin.js';

/**
 * Extracts the prefetch app list from EsmapConfig.apps.
 * @param apps - app configuration map
 * @param importMap - import map (for URL resolution)
 * @returns list of apps eligible for prefetching
 */
function extractPrefetchApps(
  apps: Readonly<Record<string, AppConfig>>,
  importMap?: { readonly imports: Readonly<Record<string, string>> },
): readonly { readonly name: string; readonly url: string }[] {
  return Object.entries(apps).flatMap(([name]) => {
    const url = importMap?.imports[name];
    if (url === undefined) return [];
    return [{ name, url }];
  });
}

/**
 * Creates the integrated kernel instance of the esmap framework.
 * Creates and connects AppRegistry, Router, LifecycleHooks, PerfTracker, and PrefetchController.
 * @param options - kernel creation options
 * @returns fully connected EsmapInstance
 */
export function createEsmap(options: EsmapOptions): EsmapInstance {
  const {
    config,
    importMap,
    router: routerOptions,
    disablePerf = false,
    disableDevtools = false,
    plugins = [],
  } = options;

  const registry = new AppRegistry({ importMap });
  const router = new Router(registry, routerOptions);
  const hooks = createLifecycleHooks();
  const perf = new PerfTracker();

  if (!disablePerf) {
    installAutoPerf(hooks, perf);
  }

  const prefetchApps = extractPrefetchApps(config.apps, importMap);
  const prefetch = createPrefetch({
    strategy: 'idle',
    apps: prefetchApps,
    importMap,
  });

  // Shared module registry — registers dependencies configured in config.shared
  const sharedModules = createSharedModuleRegistry();
  registerSharedModules(sharedModules, config.shared, config.cdnBase);

  if (!disableDevtools) {
    installDevtoolsApi();
  }

  for (const [name, appConfig] of Object.entries(config.apps)) {
    registry.registerApp({
      name,
      activeWhen: appConfig.activeWhen ?? appConfig.path,
      container: appConfig.container,
    });
  }

  const pluginCleanups: readonly PluginCleanup[] = installPlugins(plugins, {
    registry,
    router,
    hooks,
    perf,
    prefetch,
  });

  return {
    registry,
    router,
    hooks,
    perf,
    prefetch,
    sharedModules,

    /** Starts the framework (waits for eager module loads + starts router listening + handles initial route) */
    async start(): Promise<void> {
      await sharedModules.waitForEager();
      prefetch.start();
      await router.start();
    },

    /** Fully cleans up the framework (unmounts all apps + stops router + cleans up plugins) */
    async destroy(): Promise<void> {
      router.stop();
      prefetch.stop();
      await runCleanups(pluginCleanups);
      await registry.destroy();
      perf.clear();
    },
  };
}

/**
 * Registers shared dependency configurations from config.shared into SharedModuleRegistry.
 * Creates a dynamic import factory if a URL is provided, otherwise creates a bare specifier import factory.
 * If subpaths are defined, registers factories for each subpath as well.
 * @param registry - shared module registry
 * @param shared - shared dependency configuration map
 * @param cdnBase - CDN base URL (for URL generation)
 */
function registerSharedModules(
  registry: SharedModuleRegistry,
  shared: Readonly<Record<string, SharedConfig>>,
  cdnBase?: string,
): void {
  for (const [name, sharedConfig] of Object.entries(shared)) {
    const url = sharedConfig.url ?? (cdnBase ? `${cdnBase}/${name}` : undefined);

    // Convert subpath exports mapping to factory map
    const subpathFactories = sharedConfig.subpaths
      ? Object.fromEntries(
          Object.entries(sharedConfig.subpaths).map(([subpath, specifier]) => [
            subpath,
            () => import(/* @vite-ignore */ specifier),
          ]),
        )
      : undefined;

    registry.register({
      name,
      version: sharedConfig.requiredVersion ?? '*',
      requiredVersion: sharedConfig.requiredVersion,
      singleton: sharedConfig.singleton,
      eager: sharedConfig.eager,
      strictVersion: sharedConfig.strictVersion,
      factory: () => import(/* @vite-ignore */ url ?? name),
      subpaths: subpathFactories,
    });
  }
}
