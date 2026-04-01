import type { HtmlComposerOptions } from './types.js';

/**
 * Composes a complete HTML document shell with embedded import map, preload hints,
 * rendered app markup, and hydration script.
 *
 * @param options - HTML composition options
 * @returns complete HTML document string
 */
export function composeHtml(options: HtmlComposerOptions): string {
  const {
    importMap,
    appHtml,
    head = '',
    bodyAttrs = '',
    preloadUrls = [],
    hydrationScript = '',
    containerId = 'root',
    title = '',
    lang = 'en',
  } = options;

  const importMapJson = JSON.stringify(importMap, null, 2);
  const preloadTags = preloadUrls
    .map((url) => `    <link rel="modulepreload" href="${escapeAttr(url)}" />`)
    .join('\n');
  const bodyAttrsStr = bodyAttrs ? ` ${bodyAttrs}` : '';
  const titleTag = title ? `    <title>${escapeHtml(title)}</title>` : '';
  const hydrationTag = hydrationScript
    ? `    <script type="module">${hydrationScript}</script>`
    : '';

  const headParts = [
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    titleTag,
    `    <script type="importmap">\n${indent(importMapJson, 6)}\n    </script>`,
    preloadTags,
    head ? indent(head, 4) : '',
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
  <head>
${headParts.join('\n')}
  </head>
  <body${bodyAttrsStr}>
    <div id="${escapeAttr(containerId)}">${appHtml}</div>
${hydrationTag}
  </body>
</html>`;
}

/** Escapes HTML special characters in text content */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escapes characters for safe use in HTML attributes */
function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Indents each line of a multiline string by a given number of spaces */
function indent(text: string, spaces: number): string {
  const padding = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() ? `${padding}${line}` : line))
    .join('\n');
}
