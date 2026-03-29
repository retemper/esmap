import { describe, it, expect } from 'vitest';
import { esmapCssScope } from './css-scope-plugin.js';
import type { Plugin } from 'vite';

/** transform 훅을 호출하는 헬퍼 */
function callTransform(
  plugin: Plugin,
  code: string,
  id: string,
): { code: string } | null {
  const hook = plugin.transform;
  if (typeof hook !== 'function') throw new Error('transform hook이 없음');
  return hook.call({} as never, code, id) as { code: string } | null;
}

describe('esmapCssScope', () => {
  describe('플러그인 메타데이터', () => {
    it('플러그인 이름이 esmap:css-scope이다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      expect(plugin.name).toBe('esmap:css-scope');
    });

    it('enforce가 pre이다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      expect(plugin.enforce).toBe('pre');
    });
  });

  describe('CSS 파일 필터링', () => {
    it('CSS 파일을 변환한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.css');
      expect(result).not.toBeNull();
      expect(result?.code).toContain('[data-esmap-scope="checkout"]');
    });

    it('SCSS 파일을 변환한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.scss');
      expect(result).not.toBeNull();
    });

    it('Less 파일을 변환한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.less');
      expect(result).not.toBeNull();
    });

    it('JS 파일은 변환하지 않는다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, 'export default {}', '/src/app.js');
      expect(result).toBeNull();
    });

    it('CSS Modules 파일은 변환하지 않는다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.module.css');
      expect(result).toBeNull();
    });

    it('exclude 문자열 패턴으로 제외한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout', exclude: ['global.css'] });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/global.css');
      expect(result).toBeNull();
    });

    it('exclude RegExp 패턴으로 제외한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout', exclude: [/vendor\//] });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/vendor/reset.css');
      expect(result).toBeNull();
    });
  });

  describe('CSS 스코핑', () => {
    it('선택자에 스코프 attribute 프리픽스를 추가한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.css');
      expect(result?.code).toContain('[data-esmap-scope="checkout"] .btn');
    });

    it('프리스코핑 마커를 CSS 시작 부분에 삽입한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const result = callTransform(plugin, '.btn { color: red; }', '/src/styles.css');
      expect(result?.code).toMatch(/^\/\* @esmap:scoped=checkout \*\//);
    });

    it('@media 내부 선택자도 스코핑한다', () => {
      const plugin = esmapCssScope({ appName: 'app' });
      const css = '@media (max-width: 768px) { .mobile { display: block; } }';
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('[data-esmap-scope="app"] .mobile');
    });
  });

  describe('@keyframes 네임스페이싱', () => {
    it('@keyframes 선언을 네임스페이싱한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('@keyframes checkout__fadeIn');
    });

    it('animation-name 참조를 네임스페이싱한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const css = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .item { animation-name: fadeIn; }
      `;
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('animation-name: checkout__fadeIn');
    });

    it('animation 축약 프로퍼티의 참조를 네임스페이싱한다', () => {
      const plugin = esmapCssScope({ appName: 'checkout' });
      const css = `
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .item { animation: slideIn 0.3s ease; }
      `;
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('animation: checkout__slideIn 0.3s ease');
    });

    it('namespaceKeyframes: false이면 네임스페이싱하지 않는다', () => {
      const plugin = esmapCssScope({ appName: 'checkout', namespaceKeyframes: false });
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = callTransform(plugin, css, '/src/styles.css');
      expect(result?.code).toContain('@keyframes fadeIn');
      expect(result?.code).not.toContain('checkout__fadeIn');
    });
  });
});
