import type { AppConfig, SharedConfig } from '@esmap/shared';
import { AppRegistry, Router, createLifecycleHooks, createPrefetch, createSharedModuleRegistry } from '@esmap/runtime';
import type { SharedModuleRegistry } from '@esmap/runtime';
import { PerfTracker } from '@esmap/monitor';
import { installDevtoolsApi } from '@esmap/devtools';
import type { EsmapOptions, EsmapInstance } from './types.js';
import { installAutoPerf } from './auto-perf.js';
import type { PluginCleanup } from './plugin.js';
import { installPlugins, runCleanups } from './plugin.js';

/**
 * EsmapConfig.apps에서 프리페치용 앱 목록을 추출한다.
 * @param apps - 앱 설정 맵
 * @param importMap - import map (URL 해석용)
 * @returns 프리페치 대상 앱 목록
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
 * esmap 프레임워크의 통합 커널 인스턴스를 생성한다.
 * AppRegistry, Router, LifecycleHooks, PerfTracker, PrefetchController를 생성하고 연결한다.
 * @param options - 커널 생성 옵션
 * @returns 완전히 연결된 EsmapInstance
 */
export function createEsmap(options: EsmapOptions): EsmapInstance {
  const { config, importMap, router: routerOptions, disablePerf = false, disableDevtools = false, plugins = [] } = options;

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

  // 공유 모듈 레지스트리 — config.shared에서 설정된 의존성을 등록한다
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

    /** 프레임워크를 시작한다 (eager 모듈 로드 대기 + 라우터 리스닝 + 초기 라우트 처리) */
    async start(): Promise<void> {
      await sharedModules.waitForEager();
      prefetch.start();
      await router.start();
    },

    /** 프레임워크를 완전히 정리한다 (모든 앱 언마운트 + 라우터 중지 + 플러그인 정리) */
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
 * config.shared의 공유 의존성 설정을 SharedModuleRegistry에 등록한다.
 * URL이 있으면 dynamic import factory를, 없으면 bare specifier import factory를 생성한다.
 * subpaths가 정의되어 있으면 각 subpath에 대한 팩토리도 함께 등록한다.
 * @param registry - 공유 모듈 레지스트리
 * @param shared - 공유 의존성 설정 맵
 * @param cdnBase - CDN 기본 URL (URL 생성용)
 */
function registerSharedModules(
  registry: SharedModuleRegistry,
  shared: Readonly<Record<string, SharedConfig>>,
  cdnBase?: string,
): void {
  for (const [name, sharedConfig] of Object.entries(shared)) {
    const url = sharedConfig.url ?? (cdnBase ? `${cdnBase}/${name}` : undefined);

    // subpath exports 매핑 → 팩토리 맵으로 변환
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
