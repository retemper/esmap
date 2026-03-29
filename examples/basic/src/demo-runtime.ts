/**
 * 브라우저 런타임 데모.
 * import map 로더, 앱 레지스트리, 라우터, devtools, guard를 통합하여 보여준다.
 *
 * 이 파일은 직접 실행이 아닌 참조 코드로, 브라우저 환경에서 esmap 프레임워크를
 * 어떻게 사용하는지 보여준다.
 */

// === 1. Import Map 로딩 ===

import { loadImportMap } from '@esmap/runtime';

// 서버에서 import map을 가져와 DOM에 주입한다.
// 이 함수는 <script type="importmap"> 태그를 자동 생성하고,
// modulepreload 링크도 자동 삽입한다.
async function bootstrapImportMap() {
  const importMap = await loadImportMap({
    importMapUrl: 'https://api.flex.team/importmap',
    // 또는 정적 import map 사용:
    // inlineImportMap: { imports: { ... } },
    injectPreload: true,
  });

  console.log('Import map 로드 완료:', Object.keys(importMap.imports).length, '개 모듈');
  return importMap;
}

// === 2. Devtools Override ===

import { applyOverrides, installDevtoolsApi, hasActiveOverrides } from '@esmap/devtools';

// window.__ESMAP__에 devtools API를 등록한다.
// 개발자가 브라우저 콘솔에서 모듈 URL을 override할 수 있다.
//
// 사용 예시 (브라우저 콘솔):
//   __ESMAP__.override('@flex/checkout', 'http://localhost:5173/checkout.js')
//   __ESMAP__.overrides()     // 현재 override 목록
//   __ESMAP__.clearOverrides() // 모든 override 해제
installDevtoolsApi();

async function loadImportMapWithOverrides() {
  const importMap = await bootstrapImportMap();

  // localStorage에 저장된 override가 있으면 import map에 적용한다.
  // 개발자가 로컬 빌드를 프로덕션 환경에서 테스트할 수 있다.
  if (hasActiveOverrides()) {
    const overridden = applyOverrides(importMap);
    console.warn('[esmap] devtools override 활성화됨');
    return overridden;
  }

  return importMap;
}

// === 3. 앱 등록 및 라우팅 ===

import { AppRegistry, Router } from '@esmap/runtime';

const registry = new AppRegistry();

// 각 MFE 앱을 등록한다.
// activeWhen은 URL 패턴으로, 해당 패턴에 맞는 URL로 이동하면 앱이 마운트된다.
registry.registerApp({
  name: '@flex/people',
  activeWhen: '/people',
  container: '#app-main',
});

registry.registerApp({
  name: '@flex/payroll',
  activeWhen: '/payroll',
  container: '#app-main',
});

registry.registerApp({
  name: '@flex/time-tracking',
  activeWhen: ['/time-tracking', '/attendance'],
  container: '#app-main',
});

// GNB는 모든 페이지에서 항상 활성화
registry.registerApp({
  name: '@flex/gnb',
  activeWhen: () => true,
  container: '#app-gnb',
});

// === 4. 성능 모니터링 ===

import { PerfTracker } from '@esmap/monitor';

const perfTracker = new PerfTracker();

// 앱 상태 변경을 추적하여 성능 데이터를 수집한다.
registry.onStatusChange((event) => {
  if (event.to === 'LOADING') {
    perfTracker.markStart(event.appName, 'load');
  } else if (event.to === 'BOOTSTRAPPING') {
    perfTracker.markEnd(event.appName, 'load');
    perfTracker.markStart(event.appName, 'bootstrap');
  } else if (event.to === 'NOT_MOUNTED' && event.from === 'BOOTSTRAPPING') {
    perfTracker.markEnd(event.appName, 'bootstrap');
  } else if (event.to === 'MOUNTED') {
    perfTracker.markEnd(event.appName, 'mount');
  }
});

// === 5. CSS 격리 ===

import { applyCssScope, removeCssScope } from '@esmap/guard';

// 앱이 마운트될 때 CSS 스코프를 적용하고, 언마운트 시 제거
registry.onStatusChange((event) => {
  const container = document.querySelector<HTMLElement>('#app-main');
  if (!container) return;

  if (event.to === 'MOUNTED') {
    applyCssScope(container, { prefix: event.appName });
  } else if (event.to === 'NOT_MOUNTED' && event.from === 'UNMOUNTING') {
    removeCssScope(container, { prefix: event.appName });
  }
});

// === 6. 전체 부팅 시퀀스 ===

async function boot() {
  // 1) import map 로드
  await loadImportMapWithOverrides();

  // 2) 라우터 시작 — 현재 URL에 맞는 앱을 자동 마운트
  const router = new Router(registry, { mode: 'history' });
  await router.start();

  // 3) 성능 요약 출력
  console.log('[esmap] 부팅 완료');

  // 페이지 로드 완료 후 성능 요약
  window.addEventListener('load', () => {
    const summary = perfTracker.summarize();
    for (const [appName, data] of summary) {
      console.log(`[perf] ${appName}: ${data.total.toFixed(1)}ms (${JSON.stringify(data.phases)})`);
    }
  });
}

// boot() 호출은 HTML에서 수행
export { boot, registry, perfTracker };
