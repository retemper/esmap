/**
 * Host 앱 부트스트랩 — @esmap/core 기반.
 *
 * 이전에 340줄이던 수동 wire-up 코드가 @esmap/core 커널 + 플러그인 시스템으로
 * 간결해진 예시. createEsmap() 하나로 전체 프레임워크가 초기화된다.
 */

import {
  createEsmap,
  guardPlugin,
  sandboxPlugin,
  communicationPlugin,
  keepAlivePlugin,
  domIsolationPlugin,
  intelligentPrefetchPlugin,
} from '@esmap/core';
import { createDevtoolsOverlay } from '@esmap/devtools';
import { loadImportMap } from '@esmap/runtime';
import type { ImportMap } from '@esmap/shared';

// ─── 1. 상태 로그 UI ───
const statusLog = document.getElementById('status-log')!;

/** 상태 패널에 로그를 추가한다 */
function log(message: string): void {
  const line = document.createElement('div');
  line.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  statusLog.appendChild(line);

  while (statusLog.children.length > 30) {
    statusLog.removeChild(statusLog.firstChild!);
  }
}

// ─── 2. Import map 정의 ───
const BASE_URL = '/apps';

const importMap: ImportMap = {
  imports: {
    'app-nav': `${BASE_URL}/app-nav/app-nav.js`,
    'app-home': `${BASE_URL}/app-home/app-home.js`,
    'app-settings': `${BASE_URL}/app-settings/app-settings.js`,
    'app-react-dashboard': `${BASE_URL}/app-react-dashboard/app-react-dashboard.js`,
    'app-broken': `${BASE_URL}/app-broken/app-broken.js`,
  },
};

// ─── 3. 플러그인 초기화 ───
const smartPrefetch = intelligentPrefetchPlugin({
  persistKey: 'esmap-demo-prefetch',
  threshold: 0.15,
  maxPrefetch: 2,
});


const comm = communicationPlugin({
  initialState: {
    theme: 'light' as const,
    locale: 'ko',
    currentApp: '',
  },
});

comm.resources.globalState.subscribe((state, prev) => {
  if (state.currentApp !== prev.currentApp) {
    log(`현재 앱: ${state.currentApp}`);
  }
});

comm.resources.eventBus.on('app:message', (payload) => {
  log(`앱 메시지: ${JSON.stringify(payload)}`);
});

// 와일드카드 구독 — 'app:' 접두어를 가진 모든 이벤트를 로깅
comm.resources.eventBus.onAny('app:*', (payload) => {
  log(`[와일드카드] app 이벤트: ${JSON.stringify(payload)}`);
});

// ─── 4. 부팅 ───
async function boot(): Promise<void> {
  log('부팅 시작');

  // import map DOM 주입
  await loadImportMap({
    inlineImportMap: importMap,
    injectPreload: true,
  });
  log('import map 주입 완료');

  // createEsmap — 한 줄로 전체 프레임워크 초기화
  const esmap = createEsmap({
    router: {
      onNoMatch: (ctx) => {
        log(`404: ${ctx.pathname} 에 매칭되는 앱 없음`);
      },
    },
    config: {
      apps: {
        'app-nav': {
          path: '/',
          activeWhen: () => true,
          container: '#app-nav',
        },
        'app-home': {
          path: '/',
          activeWhen: (loc: Location) => loc.pathname === '/' || loc.pathname === '/index.html',
          container: '#app-main',
        },
        'app-settings': {
          path: '/settings',
          container: '#app-main',
        },
        'app-react-dashboard': {
          path: '/react',
          container: '#app-main',
        },
        'app-broken': {
          path: '/broken',
          container: '#app-broken',
        },
      },
      shared: {},
      server: { port: 3000, storage: { type: 'filesystem', path: './data' } },
    },
    importMap,
    plugins: [
      guardPlugin({
        cssStrategy: 'attribute',
        observeDynamic: true,
        onGlobalViolation: (appName, prop) => {
          log(`전역 오염 감지: ${appName} → ${prop}`);
        },
      }),
      sandboxPlugin({
        exclude: ['app-nav'], // nav는 항상 마운트되므로 샌드박스 불필요
      }),
      keepAlivePlugin({
        apps: ['app-home', 'app-settings', 'app-react-dashboard'],
        maxCached: 3,
      }),
      domIsolationPlugin({
        exclude: ['app-nav'], // nav는 글로벌 네비게이션이므로 DOM 격리 불필요
        globalSelectors: ['#status-log', '#app-nav'],
      }),
      smartPrefetch.plugin,
      comm.plugin,
    ],
  });

  // 라이프사이클 로깅 훅
  esmap.hooks.beforeEach('mount', (ctx) => {
    log(`${ctx.appName} 마운트 준비`);
    comm.resources.globalState.setState({ currentApp: ctx.appName });
  });

  esmap.hooks.afterEach('unmount', (ctx) => {
    log(`${ctx.appName} 정리 완료`);
  });

  // 앱 상태 변경 로깅
  esmap.registry.onStatusChange((event) => {
    log(`${event.appName}: ${event.from} → ${event.to}`);
    comm.resources.eventBus.emit('lifecycle', {
      app: event.appName,
      from: event.from,
      to: event.to,
    });
  });

  log(`${esmap.registry.getApps().length}개 앱 등록 완료`);

  // DevTools 오버레이 (Alt+Shift+D)
  const overlay = createDevtoolsOverlay({ position: 'top-right' });

  // 라우트 가드
  esmap.router.beforeRouteChange((from, to) => {
    log(`라우트 가드: ${from.pathname} → ${to.pathname}`);
    return true;
  });

  esmap.router.afterRouteChange((_from, to) => {
    log(`라우트 전환 완료: ${to.pathname}`);

    // 오버레이 앱 목록 업데이트
    overlay.update(
      esmap.registry.getApps().map((app) => ({
        name: app.name,
        status: app.status,
        container: app.container,
      })),
    );
  });

  // 프로그래매틱 네비게이션 API 데모
  // esmap.router.push('/settings')  — 설정 페이지로 이동
  // esmap.router.replace('/react')  — 현재 URL 교체
  // esmap.router.back()             — 뒤로 가기

  // 시작!
  await esmap.start();
  log('라우터 시작');

  // 성능 요약
  setTimeout(() => {
    const summary = esmap.perf.summarize();
    for (const [appName, data] of summary) {
      log(`${appName}: ${data.total.toFixed(0)}ms`);
    }
  }, 500);
}

boot().catch((error) => {
  log(`부팅 실패: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
});
