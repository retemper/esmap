import type { EsmapConfig, ImportMap } from '@esmap/shared';
import type {
  AppRegistry,
  Router,
  LifecycleHooks,
  PrefetchController,
  RouterOptions,
  SharedModuleRegistry,
} from '@esmap/runtime';
import type { PerfTracker } from '@esmap/monitor';
import type { EsmapPlugin } from './plugin.js';

/** Configuration passed to createEsmap */
export interface EsmapOptions {
  /** esmap configuration (app list, shared dependencies, etc.) */
  readonly config: EsmapConfig;
  /** Import map. Loaded inline or from URL. */
  readonly importMap?: ImportMap;
  /** Router options (baseUrl, onNoMatch, etc.) */
  readonly router?: RouterOptions;
  /** Whether to disable performance tracking */
  readonly disablePerf?: boolean;
  /** Whether to disable devtools */
  readonly disableDevtools?: boolean;
  /** Plugin list. Executed in install order and cleaned up in reverse order during destroy. */
  readonly plugins?: readonly EsmapPlugin[];
}

/** Integrated instance returned by createEsmap */
export interface EsmapInstance {
  /** App registry — registers, loads, mounts/unmounts apps */
  readonly registry: AppRegistry;
  /** Router — URL-based app activation */
  readonly router: Router;
  /** Lifecycle hooks — before/after global/per-app hooks */
  readonly hooks: LifecycleHooks;
  /** Performance tracker — automatic lifecycle instrumentation */
  readonly perf: PerfTracker;
  /** Prefetch controller */
  readonly prefetch: PrefetchController;
  /** Shared module registry — dependency sharing and version negotiation between MFEs */
  readonly sharedModules: SharedModuleRegistry;
  /** Starts the framework (router listening + initial route handling) */
  start(): Promise<void>;
  /** Fully cleans up the framework (unmounts all apps + stops router) */
  destroy(): Promise<void>;
}
