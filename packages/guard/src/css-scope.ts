/**
 * CSS scoping utilities.
 * Isolates MFE app styles so they do not affect other apps.
 */

/** CSS scope options */
export interface CssScopeOptions {
  /** Scope prefix (e.g., "mfe-checkout") */
  readonly prefix: string;
  /** Whether to use Shadow DOM (default: false) */
  readonly useShadowDom?: boolean;
}

/**
 * Applies scope to a container.
 * Creates a shadow root in Shadow DOM mode, otherwise adds a data attribute.
 * @param container - DOM element to apply scope to
 * @param options - scope options
 * @returns the actual root element where the app should render
 */
export function applyCssScope(container: HTMLElement, options: CssScopeOptions): HTMLElement {
  if (options.useShadowDom) {
    return createShadowScope(container);
  }
  return createAttributeScope(container, options.prefix);
}

/**
 * Removes scope from a container.
 * @param container - DOM element to remove scope from
 * @param options - scope options
 */
export function removeCssScope(container: HTMLElement, options: CssScopeOptions): void {
  if (options.useShadowDom) {
    // Shadow DOM is cleaned up automatically
    return;
  }
  container.removeAttribute(`data-esmap-scope`);
}

/** Creates a Shadow DOM to isolate styles. */
function createShadowScope(container: HTMLElement): HTMLElement {
  const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: 'open' });
  const wrapper = document.createElement('div');
  shadowRoot.appendChild(wrapper);
  return wrapper;
}

/** Applies data attribute-based scope. */
function createAttributeScope(container: HTMLElement, prefix: string): HTMLElement {
  container.setAttribute('data-esmap-scope', prefix);
  return container;
}

/** Prescoping marker. Indicates that CSS was already scoped at build time. */
export const PRESCOPED_MARKER = '/* @esmap:scoped';

/**
 * Checks whether the CSS contains a prescoping marker.
 * @param css - CSS string to check
 */
export function isPrescopedCss(css: string): boolean {
  return css.trimStart().startsWith(PRESCOPED_MARKER);
}

/** @-rule keyword pattern. Blocks inside these must be recursively scoped. */
const AT_RULE_PATTERN = /^@(media|supports|layer|container|scope)\b/;

/** @-rules whose contents must not be scoped, such as @keyframes and @font-face */
const AT_RULE_PASSTHROUGH_PATTERN = /^@(keyframes|font-face|import|charset|namespace)\b/;

/**
 * Parses a CSS string into individual rules (tokens).
 * Correctly handles nested {} blocks.
 * @param css - original CSS string
 * @returns array of parsed rules (including selector + body)
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
    // Skip whitespace
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
 * Splits a single CSS rule into its selector and body parts.
 * @param rule - complete CSS rule string
 * @returns selector and body (including braces)
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
 * Extracts only the inner content of braces (excluding the outermost braces).
 * @param body - string including braces (e.g., "{ ... }")
 * @returns inner content
 */
function extractInnerBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Adds a scope prefix to CSS selectors.
 * Recursively processes nested @-rules like @media and @supports.
 * Passes through @keyframes and @font-face unchanged.
 * @param css - original CSS string
 * @param prefix - scope prefix
 * @returns scoped CSS
 */
export function scopeCssText(css: string, prefix: string): string {
  const scopeAttr = `[data-esmap-scope="${prefix}"]`;
  const rules = parseRules(css);

  const scopedParts = rules.map((rule) => {
    const parts = splitSelectorBody(rule);
    if (!parts) return rule;

    const { selector, body } = parts;

    // @keyframes, @font-face, etc. pass through unchanged
    if (AT_RULE_PASSTHROUGH_PATTERN.test(selector)) {
      return rule;
    }

    // @media, @supports, etc. are recursively scoped internally
    if (AT_RULE_PATTERN.test(selector)) {
      const inner = extractInnerBody(body);
      const scopedInner = scopeCssText(inner, prefix);
      return `${selector} { ${scopedInner} }`;
    }

    // Regular selectors: add scope attribute
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

/** Pattern matching @keyframes declarations */
const KEYFRAME_DECL_PATTERN = /@keyframes\s+([a-zA-Z_][\w-]*)/g;

/** Pattern matching animation-name property values */
const ANIMATION_NAME_PATTERN = /animation-name\s*:\s*([^;}\n]+)/g;

/** Pattern matching animation shorthand property values (excluding animation-*) */
const ANIMATION_SHORTHAND_PATTERN = /(^|[{;\s])animation\s*:\s*([^;}\n]+)/gm;

/**
 * Adds a prefix to @keyframes names in CSS to prevent inter-app collisions.
 * Updates both @keyframes declarations and animation-name/animation shorthand references.
 *
 * @param css - original CSS string
 * @param prefix - namespace prefix (app name)
 * @returns CSS with namespaced @keyframes
 */
export function namespaceCssKeyframes(css: string, prefix: string): string {
  const keyframeNames = collectKeyframeNames(css);
  if (keyframeNames.size === 0) return css;

  const namespaced = applyKeyframeNamespace(css, keyframeNames, prefix);
  return namespaced;
}

/**
 * Collects @keyframes declaration names from CSS.
 * @param css - CSS string
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
 * Finds and namespaces keyframe names in individual tokens of animation shorthand values.
 * @param valueStr - animation shorthand value string
 * @param keyframeNames - collected set of keyframe names
 * @param prefix - namespace prefix
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
 * Applies @keyframes namespacing to CSS.
 * @param css - original CSS
 * @param keyframeNames - collected set of keyframe names
 * @param prefix - namespace prefix
 */
function applyKeyframeNamespace(
  css: string,
  keyframeNames: ReadonlySet<string>,
  prefix: string,
): string {
  // 1. Namespace @keyframes declarations
  const declPattern = new RegExp(KEYFRAME_DECL_PATTERN.source, 'g');
  const step1 = css.replace(declPattern, (_full, name: string) => {
    if (keyframeNames.has(name)) return `@keyframes ${prefix}__${name}`;
    return _full;
  });

  // 2. Namespace animation-name properties
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

  // 3. Namespace animation shorthand properties
  const shorthandPattern = new RegExp(ANIMATION_SHORTHAND_PATTERN.source, 'gm');
  const step3 = step2.replace(shorthandPattern, (_full, before: string, valueStr: string) => {
    const namespaced = namespaceAnimationValue(valueStr, keyframeNames, prefix);
    return `${before}animation: ${namespaced}`;
  });

  return step3;
}
