import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyCssScope,
  removeCssScope,
  scopeCssText,
  namespaceCssKeyframes,
  isPrescopedCss,
  PRESCOPED_MARKER,
} from './css-scope.js';

describe('applyCssScope', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('adds data-esmap-scope attribute in attribute mode', () => {
    const container = document.getElementById('app')!;
    const result = applyCssScope(container, { prefix: 'checkout' });

    expect(container.getAttribute('data-esmap-scope')).toBe('checkout');
    expect(result).toBe(container);
  });

  it('creates a shadow root and returns a wrapper in Shadow DOM mode', () => {
    const container = document.getElementById('app')!;
    const result = applyCssScope(container, { prefix: 'checkout', useShadowDom: true });

    expect(container.shadowRoot).not.toBeNull();
    expect(result.tagName).toBe('DIV');
    expect(result).not.toBe(container);
  });

  it('reuses the existing shadow root if one exists', () => {
    const container = document.getElementById('app')!;
    container.attachShadow({ mode: 'open' });

    const result = applyCssScope(container, { prefix: 'checkout', useShadowDom: true });

    expect(container.shadowRoot!.children).toHaveLength(1);
    expect(result.tagName).toBe('DIV');
  });
});

describe('removeCssScope', () => {
  it('removes the data-esmap-scope attribute', () => {
    const container = document.createElement('div');
    container.setAttribute('data-esmap-scope', 'checkout');

    removeCssScope(container, { prefix: 'checkout' });

    expect(container.hasAttribute('data-esmap-scope')).toBe(false);
  });

  it('completes without errors in Shadow DOM mode', () => {
    const container = document.createElement('div');
    removeCssScope(container, { prefix: 'checkout', useShadowDom: true });
  });
});

describe('scopeCssText', () => {
  describe('basic selector scoping', () => {
    it('adds the scope attribute to selectors', () => {
      const css = '.button { color: red; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"] .button');
    });

    it('replaces :root selector with the scope attribute', () => {
      const css = ':root { --color: red; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"]');
      expect(result).not.toContain(':root');
    });

    it('replaces html selector with the scope attribute', () => {
      const css = 'html { font-size: 16px; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"]');
      expect(result).not.toContain('html');
    });

    it('replaces body selector with the scope attribute', () => {
      const css = 'body { margin: 0; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"]');
    });

    it('scopes all selectors in a comma-separated list', () => {
      const css = '.a, .b { color: red; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"] .a');
      expect(result).toContain('[data-esmap-scope="checkout"] .b');
    });

    it('handles empty CSS', () => {
      const result = scopeCssText('', 'checkout');
      expect(result).toBe('');
    });
  });

  describe('@-rule handling', () => {
    it('recursively scopes selectors inside @media rules', () => {
      const css = '@media (max-width: 768px) { .mobile { display: block; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('@media (max-width: 768px)');
      expect(result).toContain('[data-esmap-scope="app"] .mobile');
    });

    it('scopes selectors inside @supports rules', () => {
      const css = '@supports (display: grid) { .grid { display: grid; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('@supports (display: grid)');
      expect(result).toContain('[data-esmap-scope="app"] .grid');
    });

    it('does not modify @keyframes', () => {
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('@keyframes fadeIn');
      expect(result).not.toContain('[data-esmap-scope="app"]');
    });

    it('does not modify @font-face', () => {
      const css = '@font-face { font-family: "Custom"; src: url("/font.woff2"); }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('@font-face');
      expect(result).not.toContain('[data-esmap-scope="app"]');
    });

    it('scopes all rules inside @media even when there are multiple', () => {
      const css = '@media print { .header { display: none; } .footer { display: none; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('[data-esmap-scope="app"] .header');
      expect(result).toContain('[data-esmap-scope="app"] .footer');
    });

    it('handles CSS with a mix of regular rules and @media rules', () => {
      const css = '.main { color: black; } @media (max-width: 600px) { .main { color: white; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('[data-esmap-scope="app"] .main{ color: black; }');
      expect(result).toContain('@media (max-width: 600px)');
      expect(result).toContain('[data-esmap-scope="app"] .main');
    });
  });
});

describe('namespaceCssKeyframes', () => {
  describe('@keyframes declaration namespacing', () => {
    it('adds prefix to @keyframes names', () => {
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = namespaceCssKeyframes(css, 'checkout');
      expect(result).toContain('@keyframes checkout__fadeIn');
    });

    it('namespaces each @keyframes individually', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); } to { transform: translateY(0); } }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('@keyframes app__fadeIn');
      expect(result).toContain('@keyframes app__slideUp');
    });

    it('returns CSS unchanged when there are no @keyframes', () => {
      const css = '.btn { color: red; }';
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toBe(css);
    });
  });

  describe('animation-name reference namespacing', () => {
    it('namespaces animation-name property values', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .item { animation-name: fadeIn; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('animation-name: app__fadeIn');
    });

    it('namespaces multiple comma-separated animation-names', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); } to { transform: translateY(0); } }
        .item { animation-name: fadeIn, slideUp; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('animation-name: app__fadeIn, app__slideUp');
    });

    it('does not modify undefined keyframe names', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .item { animation-name: unknown; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('animation-name: unknown');
    });
  });

  describe('animation shorthand property namespacing', () => {
    it('namespaces keyframe names in animation shorthand', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .item { animation: fadeIn 0.3s ease; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('animation: app__fadeIn 0.3s ease');
    });

    it('handles multiple comma-separated animations', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); } to { transform: translateY(0); } }
        .item { animation: fadeIn 0.3s ease, slideUp 0.5s ease-out; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('app__fadeIn 0.3s ease');
      expect(result).toContain('app__slideUp 0.5s ease-out');
    });
  });
});

describe('isPrescopedCss', () => {
  it('detects CSS with a prescoping marker', () => {
    const css = `${PRESCOPED_MARKER}=checkout */\n.btn { color: red; }`;
    expect(isPrescopedCss(css)).toBe(true);
  });

  it('detects CSS without a prescoping marker', () => {
    const css = '.btn { color: red; }';
    expect(isPrescopedCss(css)).toBe(false);
  });

  it('detects the marker even when preceded by whitespace', () => {
    const css = `  ${PRESCOPED_MARKER}=app */\n.btn { color: red; }`;
    expect(isPrescopedCss(css)).toBe(true);
  });
});
