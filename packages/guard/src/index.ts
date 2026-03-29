export {
  applyCssScope,
  removeCssScope,
  scopeCssText,
  namespaceCssKeyframes,
  isPrescopedCss,
  PRESCOPED_MARKER,
} from './css-scope.js';
export type { CssScopeOptions } from './css-scope.js';

export { createGlobalGuard, snapshotGlobals, diffGlobals } from './global-guard.js';
export type { GlobalGuardOptions, GlobalGuardHandle, GlobalViolation } from './global-guard.js';

export { createStyleIsolation } from './style-isolation.js';
export type { StyleIsolationOptions, StyleIsolationHandle } from './style-isolation.js';

export { createStyleCollector } from './style-collector.js';
export type { StyleCollector } from './style-collector.js';

export { createScopedStyleCollector } from './scoped-style-collector.js';
export type {
  ScopedStyleCollectorOptions,
  ScopedStyleCollectorHandle,
} from './scoped-style-collector.js';
