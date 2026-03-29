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

  it('attribute 모드에서 data-esmap-scope 속성을 추가한다', () => {
    const container = document.getElementById('app')!;
    const result = applyCssScope(container, { prefix: 'checkout' });

    expect(container.getAttribute('data-esmap-scope')).toBe('checkout');
    expect(result).toBe(container);
  });

  it('Shadow DOM 모드에서 shadow root를 생성하고 wrapper를 반환한다', () => {
    const container = document.getElementById('app')!;
    const result = applyCssScope(container, { prefix: 'checkout', useShadowDom: true });

    expect(container.shadowRoot).not.toBeNull();
    expect(result.tagName).toBe('DIV');
    expect(result).not.toBe(container);
  });

  it('이미 shadow root가 있으면 재사용한다', () => {
    const container = document.getElementById('app')!;
    container.attachShadow({ mode: 'open' });

    const result = applyCssScope(container, { prefix: 'checkout', useShadowDom: true });

    expect(container.shadowRoot!.children).toHaveLength(1);
    expect(result.tagName).toBe('DIV');
  });
});

describe('removeCssScope', () => {
  it('data-esmap-scope 속성을 제거한다', () => {
    const container = document.createElement('div');
    container.setAttribute('data-esmap-scope', 'checkout');

    removeCssScope(container, { prefix: 'checkout' });

    expect(container.hasAttribute('data-esmap-scope')).toBe(false);
  });

  it('Shadow DOM 모드에서는 에러 없이 완료된다', () => {
    const container = document.createElement('div');
    removeCssScope(container, { prefix: 'checkout', useShadowDom: true });
  });
});

describe('scopeCssText', () => {
  describe('기본 선택자 스코핑', () => {
    it('선택자에 스코프 attribute를 추가한다', () => {
      const css = '.button { color: red; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"] .button');
    });

    it(':root 선택자를 스코프 attribute로 대체한다', () => {
      const css = ':root { --color: red; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"]');
      expect(result).not.toContain(':root');
    });

    it('html 선택자를 스코프 attribute로 대체한다', () => {
      const css = 'html { font-size: 16px; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"]');
      expect(result).not.toContain('html');
    });

    it('body 선택자를 스코프 attribute로 대체한다', () => {
      const css = 'body { margin: 0; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"]');
    });

    it('여러 선택자를 모두 스코핑한다', () => {
      const css = '.a, .b { color: red; }';
      const result = scopeCssText(css, 'checkout');

      expect(result).toContain('[data-esmap-scope="checkout"] .a');
      expect(result).toContain('[data-esmap-scope="checkout"] .b');
    });

    it('빈 CSS를 처리한다', () => {
      const result = scopeCssText('', 'checkout');
      expect(result).toBe('');
    });
  });

  describe('@-규칙 처리', () => {
    it('@media 규칙 내부의 선택자를 재귀적으로 스코핑한다', () => {
      const css = '@media (max-width: 768px) { .mobile { display: block; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('@media (max-width: 768px)');
      expect(result).toContain('[data-esmap-scope="app"] .mobile');
    });

    it('@supports 규칙 내부의 선택자를 스코핑한다', () => {
      const css = '@supports (display: grid) { .grid { display: grid; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('@supports (display: grid)');
      expect(result).toContain('[data-esmap-scope="app"] .grid');
    });

    it('@keyframes는 변경하지 않는다', () => {
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('@keyframes fadeIn');
      expect(result).not.toContain('[data-esmap-scope="app"]');
    });

    it('@font-face는 변경하지 않는다', () => {
      const css = '@font-face { font-family: "Custom"; src: url("/font.woff2"); }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('@font-face');
      expect(result).not.toContain('[data-esmap-scope="app"]');
    });

    it('@media 내부에 여러 규칙이 있어도 모두 스코핑한다', () => {
      const css = '@media print { .header { display: none; } .footer { display: none; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('[data-esmap-scope="app"] .header');
      expect(result).toContain('[data-esmap-scope="app"] .footer');
    });

    it('일반 규칙과 @media 규칙이 혼합된 CSS를 처리한다', () => {
      const css = '.main { color: black; } @media (max-width: 600px) { .main { color: white; } }';
      const result = scopeCssText(css, 'app');

      expect(result).toContain('[data-esmap-scope="app"] .main{ color: black; }');
      expect(result).toContain('@media (max-width: 600px)');
      expect(result).toContain('[data-esmap-scope="app"] .main');
    });
  });
});

describe('namespaceCssKeyframes', () => {
  describe('@keyframes 선언 네임스페이싱', () => {
    it('@keyframes 이름에 prefix를 추가한다', () => {
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = namespaceCssKeyframes(css, 'checkout');
      expect(result).toContain('@keyframes checkout__fadeIn');
    });

    it('여러 @keyframes를 각각 네임스페이싱한다', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); } to { transform: translateY(0); } }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('@keyframes app__fadeIn');
      expect(result).toContain('@keyframes app__slideUp');
    });

    it('@keyframes가 없으면 CSS를 그대로 반환한다', () => {
      const css = '.btn { color: red; }';
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toBe(css);
    });
  });

  describe('animation-name 참조 네임스페이싱', () => {
    it('animation-name 프로퍼티 값을 네임스페이싱한다', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .item { animation-name: fadeIn; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('animation-name: app__fadeIn');
    });

    it('여러 animation-name을 콤마 구분으로 네임스페이싱한다', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); } to { transform: translateY(0); } }
        .item { animation-name: fadeIn, slideUp; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('animation-name: app__fadeIn, app__slideUp');
    });

    it('정의되지 않은 keyframe 이름은 변경하지 않는다', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .item { animation-name: unknown; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('animation-name: unknown');
    });
  });

  describe('animation 축약 프로퍼티 네임스페이싱', () => {
    it('animation 축약에서 keyframe 이름을 네임스페이싱한다', () => {
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .item { animation: fadeIn 0.3s ease; }
      `;
      const result = namespaceCssKeyframes(css, 'app');
      expect(result).toContain('animation: app__fadeIn 0.3s ease');
    });

    it('여러 animation을 콤마로 구분하여 처리한다', () => {
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
  it('프리스코핑 마커가 있는 CSS를 감지한다', () => {
    const css = `${PRESCOPED_MARKER}=checkout */\n.btn { color: red; }`;
    expect(isPrescopedCss(css)).toBe(true);
  });

  it('프리스코핑 마커가 없는 CSS를 감지한다', () => {
    const css = '.btn { color: red; }';
    expect(isPrescopedCss(css)).toBe(false);
  });

  it('공백으로 시작해도 마커를 감지한다', () => {
    const css = `  ${PRESCOPED_MARKER}=app */\n.btn { color: red; }`;
    expect(isPrescopedCss(css)).toBe(true);
  });
});
