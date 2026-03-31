/**
 * Vite plugin that scopes CSS by app name at build time.
 * Eliminates runtime scoping cost and prevents FOUC (Flash of Unstyled Content).
 *
 * Internally uses scopeCssText and namespaceCssKeyframes from @esmap/guard
 * to perform selector prefixing and @keyframes namespacing at build time.
 */

import type { Plugin } from 'vite';
import { scopeCssText, namespaceCssKeyframes, PRESCOPED_MARKER } from '@esmap/guard';

/** CSS file extension pattern */
const CSS_FILE_PATTERN = /\.(css|scss|sass|less|styl|stylus|pcss|postcss)(\?.*)?$/;

/** CSS modules file pattern */
const CSS_MODULE_PATTERN = /\.module\./;

/** CSS scoping plugin options */
export interface CssScopePluginOptions {
  /** App name to use for scoping */
  readonly appName: string;
  /**
   * File patterns to exclude from scoping.
   * Strings are checked for inclusion in the file path; RegExps are tested against it.
   */
  readonly exclude?: readonly (string | RegExp)[];
  /**
   * Whether to enable @keyframes namespacing.
   * When true, adds app name prefix to @keyframes names and animation references.
   * @default true
   */
  readonly namespaceKeyframes?: boolean;
}

/**
 * Determines whether the file ID is a CSS file.
 * @param id - Vite module ID
 */
function isCssFile(id: string): boolean {
  return CSS_FILE_PATTERN.test(id);
}

/**
 * Determines whether the file ID is a CSS Modules file.
 * CSS Modules already have local scoping applied, so additional scoping is unnecessary.
 * @param id - Vite module ID
 */
function isCssModuleFile(id: string): boolean {
  return CSS_MODULE_PATTERN.test(id);
}

/**
 * Determines whether a file matches the exclude patterns.
 * @param id - Vite module ID
 * @param patterns - list of exclude patterns
 */
function isExcluded(id: string, patterns: readonly (string | RegExp)[]): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') return id.includes(pattern);
    return pattern.test(id);
  });
}

/**
 * Vite plugin that prescopes CSS by app name at build time.
 *
 * - Adds `[data-esmap-scope="appName"]` prefix to selectors.
 * - Optionally adds app name namespace to @keyframes names.
 * - Automatically skips CSS Modules files.
 * - Inserts a prescoping marker to prevent double-scoping at runtime.
 *
 * @param options - plugin options
 */
export function esmapCssScope(options: CssScopePluginOptions): Plugin {
  const { appName, exclude = [], namespaceKeyframes = true } = options;

  return {
    name: 'esmap:css-scope',
    enforce: 'pre',

    transform(code, id) {
      if (!isCssFile(id)) return null;
      if (isCssModuleFile(id)) return null;
      if (isExcluded(id, exclude)) return null;

      const scoped = scopeCssText(code, appName);
      const result = namespaceKeyframes ? namespaceCssKeyframes(scoped, appName) : scoped;

      const marked = `${PRESCOPED_MARKER}=${appName} */\n${result}`;

      return { code: marked, map: null };
    },
  };
}
