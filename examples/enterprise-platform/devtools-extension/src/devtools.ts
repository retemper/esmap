/**
 * esmap DevTools Page.
 *
 * Chrome DevTools가 열릴 때 실행되어 "esmap" 커스텀 패널을 생성한다.
 */

chrome.devtools.panels.create(
  'esmap',         // 패널 탭 이름
  '',              // 아이콘 (빈 문자열 = 기본)
  'panel.html',    // 패널 페이지 URL
);
