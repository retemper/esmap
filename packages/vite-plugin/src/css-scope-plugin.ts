/**
 * Vite 빌드 타임에 CSS를 앱 이름으로 스코핑하는 플러그인.
 * 런타임 스코핑 비용을 제거하고 FOUC(Flash of Unstyled Content)를 방지한다.
 *
 * 내부적으로 @esmap/guard의 scopeCssText, namespaceCssKeyframes를 사용하여
 * 선택자 프리픽싱과 @keyframes 네임스페이싱을 빌드 시점에 수행한다.
 */

import type { Plugin } from 'vite';
import { scopeCssText, namespaceCssKeyframes, PRESCOPED_MARKER } from '@esmap/guard';

/** CSS 파일 확장자 패턴 */
const CSS_FILE_PATTERN = /\.(css|scss|sass|less|styl|stylus|pcss|postcss)(\?.*)?$/;

/** CSS modules 파일 패턴 */
const CSS_MODULE_PATTERN = /\.module\./;

/** CSS 스코핑 플러그인 옵션 */
export interface CssScopePluginOptions {
  /** 스코프에 사용할 앱 이름 */
  readonly appName: string;
  /**
   * 스코핑에서 제외할 파일 패턴.
   * 문자열이면 파일 경로에 포함 여부로, RegExp이면 매칭으로 판별한다.
   */
  readonly exclude?: readonly (string | RegExp)[];
  /**
   * @keyframes 네임스페이싱 활성화 여부.
   * true이면 @keyframes 이름과 animation 참조에 앱 이름 prefix를 추가한다.
   * @default true
   */
  readonly namespaceKeyframes?: boolean;
}

/**
 * 파일 ID가 CSS 파일인지 판별한다.
 * @param id - Vite 모듈 ID
 */
function isCssFile(id: string): boolean {
  return CSS_FILE_PATTERN.test(id);
}

/**
 * 파일 ID가 CSS Modules 파일인지 판별한다.
 * CSS Modules는 이미 로컬 스코핑이 적용되므로 추가 스코핑이 불필요하다.
 * @param id - Vite 모듈 ID
 */
function isCssModuleFile(id: string): boolean {
  return CSS_MODULE_PATTERN.test(id);
}

/**
 * 파일이 exclude 패턴에 해당하는지 판별한다.
 * @param id - Vite 모듈 ID
 * @param patterns - 제외 패턴 목록
 */
function isExcluded(id: string, patterns: readonly (string | RegExp)[]): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') return id.includes(pattern);
    return pattern.test(id);
  });
}

/**
 * Vite 빌드 타임에 CSS를 앱 이름으로 프리스코핑하는 플러그인.
 *
 * - 선택자에 `[data-esmap-scope="appName"]` 프리픽스를 추가한다.
 * - @keyframes 이름에 앱 이름 네임스페이스를 추가한다 (옵션).
 * - CSS Modules 파일은 자동으로 건너뛴다.
 * - 프리스코핑 마커를 삽입하여 런타임에서 이중 스코핑을 방지한다.
 *
 * @param options - 플러그인 옵션
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
      const result = namespaceKeyframes
        ? namespaceCssKeyframes(scoped, appName)
        : scoped;

      const marked = `${PRESCOPED_MARKER}=${appName} */\n${result}`;

      return { code: marked, map: null };
    },
  };
}
