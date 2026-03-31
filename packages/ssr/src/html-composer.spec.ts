import { describe, it, expect } from 'vitest';
import { composeHtml } from './html-composer.js';

describe('composeHtml', () => {
  const baseImportMap = {
    imports: { react: 'https://cdn.example.com/react.js' },
  };

  describe('기본 HTML 구조', () => {
    it('유효한 HTML5 문서를 생성한다', () => {
      const html = composeHtml({ importMap: baseImportMap, appHtml: '<div>Hello</div>' });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta charset="utf-8" />');
      expect(html).toContain('</html>');
    });

    it('앱 HTML을 container div 안에 렌더링한다', () => {
      const html = composeHtml({ importMap: baseImportMap, appHtml: '<p>App content</p>' });

      expect(html).toContain('<div id="root"><p>App content</p></div>');
    });

    it('import map을 script 태그로 삽입한다', () => {
      const html = composeHtml({ importMap: baseImportMap, appHtml: '' });

      expect(html).toContain('<script type="importmap">');
      expect(html).toContain('"react": "https://cdn.example.com/react.js"');
      expect(html).toContain('</script>');
    });
  });

  describe('옵션 커스터마이징', () => {
    it('커스텀 container id를 설정할 수 있다', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '<div>App</div>',
        containerId: 'app',
      });

      expect(html).toContain('<div id="app">');
    });

    it('title을 설정할 수 있다', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        title: 'My App',
      });

      expect(html).toContain('<title>My App</title>');
    });

    it('lang 속성을 설정할 수 있다', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        lang: 'ko',
      });

      expect(html).toContain('<html lang="ko">');
    });

    it('modulepreload 링크를 생성한다', () => {
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

    it('hydration 스크립트를 body 끝에 삽입한다', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '<div>SSR</div>',
        hydrationScript: 'import("@myorg/app").then(m => m.hydrate())',
      });

      expect(html).toContain(
        '<script type="module">import("@myorg/app").then(m => m.hydrate())</script>',
      );
    });

    it('추가 head 콘텐츠를 삽입한다', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        head: '<link rel="stylesheet" href="/styles.css" />',
      });

      expect(html).toContain('<link rel="stylesheet" href="/styles.css" />');
    });

    it('body 속성을 추가한다', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        bodyAttrs: 'class="dark-mode"',
      });

      expect(html).toContain('<body class="dark-mode">');
    });
  });

  describe('XSS 방어', () => {
    it('title에서 HTML을 이스케이프한다', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        title: '<script>alert("xss")</script>',
      });

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('containerId에서 특수문자를 이스케이프한다', () => {
      const html = composeHtml({
        importMap: baseImportMap,
        appHtml: '',
        containerId: '" onclick="alert(1)',
      });

      expect(html).toContain('&quot;');
    });
  });
});
