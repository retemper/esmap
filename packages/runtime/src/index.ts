export { loadImportMap } from './loader.js';
export type { LoaderOptions } from './loader.js';

export { AppRegistry } from './app-registry.js';
export type {
  RegisterAppOptions,
  AppRegistryOptions,
  AppStatusChangeEvent,
  ErrorBoundaryOptions,
} from './app-registry.js';

export { createDefaultFallback, renderFallback } from './error-boundary.js';

export { Router } from './router.js';
export type {
  RouterRegistry,
  RouterOptions,
  RouteContext,
  BeforeRouteChangeGuard,
  AfterRouteChangeGuard,
  NoMatchHandler,
} from './router.js';

export { mountParcel } from './parcel.js';
export type { ParcelOptions, Parcel } from './parcel.js';

export { createLifecycleRunner } from './lifecycle-runner.js';
export type { LifecycleRunnerOptions, LifecycleRunner } from './lifecycle-runner.js';

export { createLifecycleHooks } from './hooks.js';
export type { LifecyclePhase, LifecycleHook, HookContext, LifecycleHooks } from './hooks.js';

export { createPrefetch } from './prefetch.js';
export type {
  PrefetchStrategy,
  PrefetchAppConfig,
  PrefetchOptions,
  PrefetchController,
} from './prefetch.js';

export { withTimeout, withRetry, withResilience, TimeoutError, createCircuitBreaker, CircuitOpenError } from './resilience.js';
export type { RetryOptions, ResilienceOptions, CircuitBreakerOptions, CircuitBreaker, CircuitState } from './resilience.js';

export { parseSemver, compareVersions, satisfiesRange } from './semver.js';
export type { SemverParts } from './semver.js';

export { createSharedModuleRegistry, SharedVersionConflictError } from './shared-module.js';
export type { SharedModuleConfig, SharedModuleRegistry } from './shared-module.js';

export { createIntelligentPrefetch } from './intelligent-prefetch.js';
export type {
  NavigationRecord,
  TransitionStats,
  PrefetchPriority,
  IntelligentPrefetchOptions,
  IntelligentPrefetchController,
} from './intelligent-prefetch.js';

export { createResourceLoader } from './resource-loader.js';
export type {
  ResourceLoader,
  ResourceLoaderOptions,
  FetchInterceptor,
  JsTransformer,
  CssTransformer,
} from './resource-loader.js';

export { createNamespaceGuard } from './namespace-guard.js';
export type {
  NamespaceGuard,
  NamespaceGuardOptions,
  OwnershipRecord,
  ConflictAction,
} from './namespace-guard.js';
