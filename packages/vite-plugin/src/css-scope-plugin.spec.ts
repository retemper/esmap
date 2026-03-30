import { describe, it, expect } from 'vitest';
import { esmapCssScope } from './css-scope-plugin.js';
import type { Plugin } from 'vite';

/** Helper that calls the transform hook */
function callTransform(
  plugin: Plugin,
  code: string,
  id: string,
): { code: string } | null {
  const hook = plugin.transform;
  if (typeof hook !== 'function') throw new Error('transform hook not found');
  return hook.call({} as never, code, id) as { code: string } | null;
}

describe('esmapCssScope', () => {
  describe('plugin metadata', () => {
    it('has plugin name esmap:css-scope', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      expect(plugin.name).toBe('esmap:css-scope');
    });

    it('has enforce set to pre', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      expect(plugin.enforce).toBe('pre');
    });
  });

  describe('CSS file filtering', () => {
    it('transforms CSS files', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.css');
      expect(result).not.toBeNull();
      expect(result?.code).toContain('[data-esmap-scope="checkout"]');
    });

    it('transforms SCSS files', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.scss');
      expect(result).not.toBeNull();
    });

    it('transforms Less files', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.less');
      expect(result).not.toBeNull();
    });

    it('does not transform JS files', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, 'export default {}', '/src/app.js');
      expect(result).toBeNull();
    });

    it('does not transform CSS Modules files', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.module.css');
      expect(result).toBeNull();
    });

    it('excludes files matching string patterns', () => {
      const plugin = esmapCssScope({ appName: 'checkout', exclude: ['global.css'] });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/global.css');
      expect(result).toBeNull();
    });

    it('excludes files matching RegExp patterns', () => {
      const plugin = esmapCssScope({ appName: 'checkout', exclude: [/vendor\//] });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/vendor/reset.css');
      expect(result).toBeNull();
    });
  });

  describe('CSS scoping', () => {
    it('adds a scope attribute prefix to selectors', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.css');
      expect(result?.code).toContain('[data-esmap-scope="checkout"] .btn');
    });

    it('inserts a prescoping marker at the beginning of the CSS', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.css');
      expect(result?.code).toMatch(/^\/\* @esmap:scoped=checkout \*\//);
    });

    it('scopes selectors inside @media rules', () => {
      const plugin = esmapCssScope({ appName: 'app' });
      const css = '@media (max-width: 768px) { .mobile { display: block; } }';
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('[data-esmap-scope="app"] .mobile');
    });
  });

  describe('@keyframes namespacing', () => {
    it('namespaces @keyframes declarations', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('@keyframes checkout__fadeIn');
    });

    it('namespaces animation-name references', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .item { animation-name: fadeIn; }
      `;
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('animation-name: checkout__fadeIn');
    });

    it('namespaces references in the animation shorthand property', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const css = `
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .item { animation: slideIn 0.3s ease; }
      `;
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('animation: checkout__slideIn 0.3s ease');
    });

    it('does not namespace when namespaceKeyframes is false', () => {
      const plugin = esmapCssScope({ appName: 'checkout', namespaceKeyframes: false });
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('@keyframes fadeIn');
      expect(result?.code).not.toContain('checkout__fadeIn');
    });
  });
});
