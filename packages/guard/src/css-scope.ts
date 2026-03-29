/**
 * CSS 스코핑을 위한 유틸리티.
 * MFE 앱의 스타일이 다른 앱에 영향을 주지 않도록 격리한다.
 */

/** CSS 스코프 옵션 */
export interface CssScopeOptions {
  /** 스코프 prefix (예: "mfe-checkout") */
  readonly prefix: string;
  /** Shadow DOM 사용 여부 (기본: false) */
  readonly useShadowDom?: boolean;
}

/**
 * 컨테이너에 스코프를 적용한다.
 * Shadow DOM 모드면 shadow root를 생성하고, 아니면 data attribute를 추가한다.
 * @param container - 스코프를 적용할 DOM 요소
 * @param options - 스코프 옵션
 * @returns 앱이 렌더링할 실제 root 요소
 */
export function applyCssScope(container: HTMLElement, options: CssScopeOptions): HTMLElement {
  if (options.useShadowDom) {
    return createShadowScope(container);
  }
  return createAttributeScope(container, options.prefix);
}

/**
 * 컨테이너의 스코프를 제거한다.
 * @param container - 스코프를 제거할 DOM 요소
 * @param options - 스코프 옵션
 */
export function removeCssScope(container: HTMLElement, options: CssScopeOptions): void {
  if (options.useShadowDom) {
    // Shadow DOM은 자동으로 정리됨
    return;
  }
  container.removeAttribute(`data-esmap-scope`);
}

/** Shadow DOM을 생성하여 스타일을 격리한다. */
function createShadowScope(container: HTMLElement): HTMLElement {
  const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: 'open' });
  const wrapper = document.createElement('div');
  shadowRoot.appendChild(wrapper);
  return wrapper;
}

/** data attribute 기반 스코프를 적용한다. */
function createAttributeScope(container: HTMLElement, prefix: string): HTMLElement {
  container.setAttribute('data-esmap-scope', prefix);
  return container;
}

/** 프리스코핑 마커. 빌드 타임에 이미 스코핑된 CSS임을 표시한다. */
export const PRESCOPED_MARKER = '/* @esmap:scoped';

/**
 * CSS에 프리스코핑 마커가 포함되어 있는지 확인한다.
 * @param css - 검사할 CSS 문자열
 */
export function isPrescopedCss(css: string): boolean {
  return css.trimStart().startsWith(PRESCOPED_MARKER);
}

/** @-규칙 앞에 붙는 키워드 패턴. 이 안의 블록은 재귀적으로 스코핑해야 한다. */
const AT_RULE_PATTERN = /^@(media|supports|layer|container|scope)\b/;

/** @keyframes, @font-face 등 내부를 스코핑하면 안 되는 @-규칙 */
const AT_RULE_PASSTHROUGH_PATTERN = /^@(keyframes|font-face|import|charset|namespace)\b/;

/**
 * CSS 문자열을 토큰(규칙) 단위로 파싱한다.
 * 중첩된 {} 블록을 올바르게 처리한다.
 * @param css - 원본 CSS 문자열
 * @returns 파싱된 규칙 배열 (selector + body 포함)
 */
function parseRules(css: string): readonly string[] {
  const rules: string[] = [];
  const trimmed = css.trim();
  const length = trimmed.length;
  const chars = [...trimmed];

  const collectRule = (start: number): { rule: string; end: number } => {
    const ruleChars: string[] = [];
    const depth = { value: 0 };
    const pos = { value: start };
    const foundBody = { value: false };

    while (pos.value < length) {
      const ch = chars[pos.value];

      if (ch === '{') {
        depth.value++;
        foundBody.value = true;
      } else if (ch === '}') {
        depth.value--;
        if (depth.value === 0) {
          ruleChars.push(ch);
          return { rule: ruleChars.join(''), end: pos.value + 1 };
        }
      }

      ruleChars.push(ch);
      pos.value++;
    }

    return { rule: ruleChars.join(''), end: pos.value };
  };

  const position = { value: 0 };
  while (position.value < length) {
    // 공백 스킵
    while (position.value < length && /\s/.test(chars[position.value])) {
      position.value++;
    }
    if (position.value >= length) break;

    const { rule, end } = collectRule(position.value);
    if (rule.trim().length > 0) {
      rules.push(rule.trim());
    }
    position.value = end;
  }

  return rules;
}

/**
 * 단일 CSS 규칙의 selector 부분과 body 부분을 분리한다.
 * @param rule - 전체 CSS 규칙 문자열
 * @returns selector와 body (중괄호 포함)
 */
function splitSelectorBody(rule: string): { selector: string; body: string } | undefined {
  const firstBrace = rule.indexOf('{');
  if (firstBrace === -1) return undefined;

  return {
    selector: rule.slice(0, firstBrace).trim(),
    body: rule.slice(firstBrace),
  };
}

/**
 * 중괄호 내부의 내용만 추출한다 (가장 바깥 중괄호 제외).
 * @param body - 중괄호 포함 문자열 (예: "{ ... }")
 * @returns 내부 내용
 */
function extractInnerBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * CSS 선택자에 스코프 prefix를 추가한다.
 * @media, @supports 등 중첩 @-규칙을 재귀적으로 처리한다.
 * @keyframes, @font-face는 변경 없이 통과시킨다.
 * @param css - 원본 CSS 문자열
 * @param prefix - 스코프 prefix
 * @returns 스코프가 적용된 CSS
 */
export function scopeCssText(css: string, prefix: string): string {
  const scopeAttr = `[data-esmap-scope="${prefix}"]`;
  const rules = parseRules(css);

  const scopedParts = rules.map((rule) => {
    const parts = splitSelectorBody(rule);
    if (!parts) return rule;

    const { selector, body } = parts;

    // @keyframes, @font-face 등은 변경 없이 통과
    if (AT_RULE_PASSTHROUGH_PATTERN.test(selector)) {
      return rule;
    }

    // @media, @supports 등은 재귀적으로 내부를 스코핑
    if (AT_RULE_PATTERN.test(selector)) {
      const inner = extractInnerBody(body);
      const scopedInner = scopeCssText(inner, prefix);
      return `${selector} { ${scopedInner} }`;
    }

    // 일반 선택자: 스코프 attribute 추가
    const scopedSelectors = selector
      .split(',')
      .map((sel: string) => {
        const trimmed = sel.trim();
        if (trimmed.length === 0) return trimmed;
        if (trimmed === ':root' || trimmed === 'html' || trimmed === 'body') {
          return `${scopeAttr}`;
        }
        return `${scopeAttr} ${trimmed}`;
      })
      .join(', ');

    return `${scopedSelectors}${body}`;
  });

  return scopedParts.join('\n');
}

/** @keyframes 선언을 매칭하는 패턴 */
const KEYFRAME_DECL_PATTERN = /@keyframes\s+([a-zA-Z_][\w-]*)/g;

/** animation-name 프로퍼티 값을 매칭하는 패턴 */
const ANIMATION_NAME_PATTERN = /animation-name\s*:\s*([^;}\n]+)/g;

/** animation 축약 프로퍼티 값을 매칭하는 패턴 (animation-* 제외) */
const ANIMATION_SHORTHAND_PATTERN = /(^|[{;\s])animation\s*:\s*([^;}\n]+)/gm;

/**
 * CSS 내 @keyframes 이름에 prefix를 추가하여 앱 간 충돌을 방지한다.
 * @keyframes 선언과 animation-name, animation 축약 프로퍼티의 참조를 모두 갱신한다.
 *
 * @param css - 원본 CSS 문자열
 * @param prefix - 네임스페이스 prefix (앱 이름)
 * @returns @keyframes가 네임스페이싱된 CSS
 */
export function namespaceCssKeyframes(css: string, prefix: string): string {
  const keyframeNames = collectKeyframeNames(css);
  if (keyframeNames.size === 0) return css;

  const namespaced = applyKeyframeNamespace(css, keyframeNames, prefix);
  return namespaced;
}

/**
 * CSS에서 @keyframes 선언의 이름을 수집한다.
 * @param css - CSS 문자열
 */
function collectKeyframeNames(css: string): ReadonlySet<string> {
  const names = new Set<string>();
  const pattern = new RegExp(KEYFRAME_DECL_PATTERN.source, 'g');
  const matches = css.matchAll(pattern);
  for (const match of matches) {
    names.add(match[1]);
  }
  return names;
}

/**
 * animation 축약 값의 개별 토큰에서 keyframe 이름을 찾아 네임스페이싱한다.
 * @param valueStr - animation 축약 값 문자열
 * @param keyframeNames - 수집된 keyframe 이름 집합
 * @param prefix - 네임스페이스 prefix
 */
function namespaceAnimationValue(
  valueStr: string,
  keyframeNames: ReadonlySet<string>,
  prefix: string,
): string {
  return valueStr
    .split(',')
    .map((single) => {
      const tokens = single.trim().split(/\s+/);
      return tokens
        .map((token) => {
          if (keyframeNames.has(token)) return `${prefix}__${token}`;
          return token;
        })
        .join(' ');
    })
    .join(', ');
}

/**
 * CSS에 @keyframes 네임스페이싱을 적용한다.
 * @param css - 원본 CSS
 * @param keyframeNames - 수집된 keyframe 이름 집합
 * @param prefix - 네임스페이스 prefix
 */
function applyKeyframeNamespace(
  css: string,
  keyframeNames: ReadonlySet<string>,
  prefix: string,
): string {
  // 1. @keyframes 선언 네임스페이싱
  const declPattern = new RegExp(KEYFRAME_DECL_PATTERN.source, 'g');
  const step1 = css.replace(declPattern, (_full, name: string) => {
    if (keyframeNames.has(name)) return `@keyframes ${prefix}__${name}`;
    return _full;
  });

  // 2. animation-name 프로퍼티 네임스페이싱
  const namePattern = new RegExp(ANIMATION_NAME_PATTERN.source, 'g');
  const step2 = step1.replace(namePattern, (_full, valueStr: string) => {
    const names = valueStr
      .split(',')
      .map((n) => {
        const trimmed = n.trim();
        return keyframeNames.has(trimmed) ? `${prefix}__${trimmed}` : trimmed;
      })
      .join(', ');
    return `animation-name: ${names}`;
  });

  // 3. animation 축약 프로퍼티 네임스페이싱
  const shorthandPattern = new RegExp(ANIMATION_SHORTHAND_PATTERN.source, 'gm');
  const step3 = step2.replace(shorthandPattern, (_full, before: string, valueStr: string) => {
    const namespaced = namespaceAnimationValue(valueStr, keyframeNames, prefix);
    return `${before}animation: ${namespaced}`;
  });

  return step3;
}
