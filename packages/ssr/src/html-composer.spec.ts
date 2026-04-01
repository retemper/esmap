import { describe, it, expect } from 'vitest';
import { composeHtml } from './html-composer.js';

describe('composeHtml', () => {
  const baseImportMap = {
    imports: { react: 'https://cdn.example.com/react.js' },
  };

  describe('basic HTML structure', () => {
    it('generates a valid HTML5 document', () => {
      const html = composeHtml({ importMap: baseImportMap, appHtml: '<div>Hello</div>' });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta charset="utf-8" />');
      expect(html).toContain('</html>');
    });

    it('renders app HTML inside the container div', () => {
      const html = composeHtml({ importMap: baseImportMap, appHtml: '<p>App content</p>' });

      expect(html).toContain('<div id="root"><p>App content</p></div>');
    });

    it('embeds the import map as a script tag', () => {
      const html = composeHtml({ importMap: baseImportMap, appHtml: '' });

      expect(html).toContain('<script type="importmap">');
      expect(html).toContain('"react": "https://cdn.example.com/react.js"');
      expect(html).toContain('</script>');
    });
  });

  describe('option customization', () => {
    it('sets a custom container id', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '<div>App</div>',
        containerId: 'app',
      });

      expect(html).toContain('<div id="app">');
    });

    it('sets the page title', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        title: 'My App',
      });

      expect(html).toContain('<title>My App</title>');
    });

    it('sets the lang attribute', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        lang: 'ko',
      });

      expect(html).toContain('<html lang="ko">');
    });

    it('generates modulepreload links', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        preloadUrls: ['https://cdn.example.com/app.js', 'https://cdn.example.com/vendor.js'],
      });

      expect(html).toContain('<link rel="modulepreload" href="https://cdn.example.com/app.js" />');
      expect(html).toContain(
        '<link rel="modulepreload" href="https://cdn.example.com/vendor.js" />',
      );
    });

    it('inserts the hydration script at the end of body', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '<div>SSR</div>',
        hydrationScript: 'import("@myorg/app").then(m => m.hydrate())',
      });

      expect(html).toContain(
        '<script type="module">import("@myorg/app").then(m => m.hydrate())</script>',
      );
    });

    it('inserts additional head content', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        head: '<link rel="stylesheet" href="/styles.css" />',
      });

      expect(html).toContain('<link rel="stylesheet" href="/styles.css" />');
    });

    it('adds body attributes', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        bodyAttrs: 'class="dark-mode"',
      });

      expect(html).toContain('<body class="dark-mode">');
    });
  });

  describe('XSS prevention', () => {
    it('escapes HTML in the title', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        title: '<script>alert("xss")</script>',
      });

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes special characters in containerId', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        containerId: '" onclick="alert(1)',
      });

      expect(html).toContain('&quot;');
    });
  });
});
