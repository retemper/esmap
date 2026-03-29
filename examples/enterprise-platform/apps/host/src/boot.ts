/**
 * Enterprise Platform Host — 통합 부트스트랩.
 *
 * 시연 포인트:
 * 1. createEsmap 전체 플러그인 조합 (guard, sandbox, keepAlive, domIsolation, prefetch, communication)
 * 2. ReadyGate로 인증 완료 전까지 보호된 라우트 차단
 * 3. SSE로 import map 서버 변경사항 실시간 반영
 * 4. 공유 의존성 버전 협상 (SharedModuleRegistry)
 * 5. DevTools 패널 + 성능 추적
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
import { loadImportMap } from '@esmap/runtime';
import { createReadyGate } from '@esmap/communication';
import type { ImportMap } from '@esmap/shared';
import { auditLogPlugin } from './plugins/audit-log-plugin.js';
import { createDevtoolsPanel } from './devtools-panel.js';
import { createDevtoolsBridge } from './devtools-bridge.js';

// ─── DevTools 패널 참조 (boot 완료 전에는 콘솔로 폴백) ───
const devtoolsRef: { panel: { log: (msg: string) => void } | null } = { panel: null };

/** DevTools 패널 또는 콘솔에 로그를 출력한다 */
function log(message: string): void {
  if (devtoolsRef.panel) {
    devtoolsRef.panel.log(message);
  } else {
    console.log(`[esmap] ${message}`);
  }
}

/** 플랫폼 전체에서 사용하는 이벤트 맵. 인증, 활동, 라이프사이클, 워크스페이스 이벤트를 정의한다 */
type PlatformEvents = {
  'auth:login': { userId: string; name: string };
  'auth:logout': Record<string, never>;
  'activity:new': { type: string; message: string };
  'lifecycle': { app: string; from: string; to: string };
  'workspace:context-change': { projectId: string; view: string };
  'team:member-select': { memberId: string; memberName: string };
  'team:member-deselect': Record<string, never>;
  'task:select': { taskId: string; title: string; assigneeId: string };
  'task:deselect': Record<string, never>;
  'task:status-change': { taskId: string; from: string; to: string; assigneeId: string };
  'notification:click': { type: string; targetId: string };
};

/** 워크스페이스 영역의 상태. 프로젝트, 멤버, 태스크 선택 및 알림 카운트를 추적한다 */
type WorkspaceState = {
  selectedProject: string | null;
  selectedMemberId: string | null;
  selectedTaskId: string | null;
  unreadNotifications: number;
};

/** 글로벌 상태 스키마. 모든 MFE가 communication 플러그인을 통해 공유한다 */
type PlatformState = {
  theme: 'light' | 'dark';
  locale: string;
  currentApp: string;
  user: { id: string; name: string } | null;
  isAuthenticated: boolean;
  workspace: WorkspaceState;
};

// ─── Import map: 서버에서 fetch하고, 실패 시 로컬 fallback 사용 ───
const IMPORT_MAP_SERVER = 'http://localhost:3200';

/** import map 서버에서 현재 import map을 가져온다. pnpm dev가 서버를 자동으로 시작한다 */
async function fetchImportMap(): Promise<ImportMap> {
  const res = await fetch(IMPORT_MAP_SERVER);
  if (!res.ok) {
    throw new Error(`import map 서버 응답 실패: ${res.status}`);
  }
  const data: ImportMap = await res.json();
  log('[import map] 서버에서 로드');
  return data;
}

// ─── ReadyGate: 인증 완료 전 앱 마운트 차단 ───
const gate = createReadyGate({ timeout: 30000 });
gate.register('auth');

// ─── 플러그인 초기화 ───

// 커스텀 플러그인: 감사 로그 (플러그인 작성법 시연)
const audit = auditLogPlugin({
  maxEntries: 100,
  onLog: (entry) => {
    log(`[audit] ${entry.type}: ${entry.appName} — ${entry.detail}`);
  },
});

const smartPrefetch = intelligentPrefetchPlugin({
  persistKey: 'enterprise-prefetch',
  threshold: 0.15,
  maxPrefetch: 3,
});

const comm = communicationPlugin<PlatformEvents, PlatformState>({
  initialState: {
    theme: 'light',
    locale: 'ko',
    currentApp: '',
    user: null,
    isAuthenticated: false,
    workspace: {
      selectedProject: null,
      selectedMemberId: null,
      selectedTaskId: null,
      unreadNotifications: 0,
    },
  },
});

// Auth MFE → Host 브릿지: CustomEvent를 eventBus로 전달
// MFE 간 느슨한 결합을 위해 window CustomEvent를 브릿지로 사용한다.
window.addEventListener('esmap:auth:login', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('auth:login', e.detail);
  }
});

// Workspace 이벤트 브릿지: MFE의 CustomEvent를 eventBus + globalState로 전달
window.addEventListener('esmap:team:member-select', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('team:member-select', e.detail);
    comm.resources.globalState.setState({
      workspace: {
        ...comm.resources.globalState.getState().workspace,
        selectedMemberId: e.detail.memberId,
      },
    });
  }
});

window.addEventListener('esmap:team:member-deselect', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('team:member-deselect', e.detail);
    comm.resources.globalState.setState({
      workspace: {
        ...comm.resources.globalState.getState().workspace,
        selectedMemberId: null,
      },
    });
  }
});

window.addEventListener('esmap:task:select', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('task:select', e.detail);
    comm.resources.globalState.setState({
      workspace: {
        ...comm.resources.globalState.getState().workspace,
        selectedTaskId: e.detail.taskId,
      },
    });
  }
});

window.addEventListener('esmap:task:deselect', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('task:deselect', e.detail);
    comm.resources.globalState.setState({
      workspace: {
        ...comm.resources.globalState.getState().workspace,
        selectedTaskId: null,
      },
    });
  }
});

window.addEventListener('esmap:task:status-change', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('task:status-change', e.detail);
  }
});

window.addEventListener('esmap:notification:click', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('notification:click', e.detail);
  }
});

// 인증 이벤트 구독 → ReadyGate 연동
comm.resources.eventBus.on('auth:login', (payload) => {
  log(`인증 완료: ${payload.name} (${payload.userId})`);
  comm.resources.globalState.setState({
    user: { id: payload.userId, name: payload.name },
    isAuthenticated: true,
  });
  gate.markReady('auth');

  // 인증 완료 후 auth 컨테이너 숨김
  const authContainer = document.getElementById('app-auth');
  if (authContainer) authContainer.style.display = 'none';

  // 라우터 재평가 트리거 — activeWhen 조건이 변경되었으므로 현재 URL에 맞는 앱을 마운트한다
  window.dispatchEvent(new PopStateEvent('popstate'));
});

comm.resources.eventBus.on('auth:logout', () => {
  log('로그아웃');
  comm.resources.globalState.setState({
    user: null,
    isAuthenticated: false,
  });
});

comm.resources.globalState.subscribe((state, prev) => {
  if (state.currentApp !== prev.currentApp) {
    log(`현재 앱: ${state.currentApp}`);
  }
});

/** 전체 프레임워크를 초기화하고 라우터를 시작한다 */
async function boot(): Promise<void> {
  log('Enterprise Platform 부팅 시작');

  // 1. Import map 로드 (서버 → 로컬 fallback)
  const importMap = await fetchImportMap();
  await loadImportMap({ inlineImportMap: importMap, injectPreload: true });
  log('import map 주입 완료');

  // 2. createEsmap — 전체 플러그인 조합
  const esmap = createEsmap({
    router: {
      onNoMatch: (ctx) => {
        log(`404: ${ctx.pathname}`);
      },
    },
    config: {
      apps: {
        // Auth: 루트 경로에서 활성 (오버레이 모달, ReadyGate 연동)
        '@enterprise/auth': {
          path: '/',
          activeWhen: '/',
          container: '#app-auth',
        },
        // Navigation bar: 인증 후 항상 표시
        // (nav는 별도 MFE 없이 host가 직접 렌더링)

        // Dashboard: 메인 페이지 + 중첩 Parcel 데모 (keepAlive → 별도 컨테이너)
        '@enterprise/dashboard': {
          path: '/',
          activeWhen: (loc: Location) => loc.pathname === '/' || loc.pathname === '/dashboard' || loc.pathname === '/index.html',
          container: '#app-dashboard',
        },
        // Team Directory: keepAlive 상태 보존 데모 (keepAlive → 별도 컨테이너)
        '@enterprise/team-directory': {
          path: '/team',
          activeWhen: '/team',
          container: '#app-team',
        },
        // Activity Feed: 독립 라우트 + Parcel 듀얼 모드 데모
        '@enterprise/activity-feed': {
          path: '/activity',
          activeWhen: '/activity',
          container: '#app-main',
        },
        // Legacy Settings: MF→import map 마이그레이션 데모
        '@enterprise/legacy-settings': {
          path: '/settings',
          activeWhen: '/settings',
          container: '#app-main',
        },
        // Task Board: 워크스페이스 메인 영역에서 태스크 관리
        '@enterprise/task-board': {
          path: '/workspace',
          activeWhen: '/workspace',
          container: '#workspace-main',
        },
        // Notifications: 워크스페이스 헤더에 알림 표시
        '@enterprise/notifications': {
          path: '/workspace',
          activeWhen: '/workspace',
          container: '#workspace-header',
        },
        // Team Sidebar: 워크스페이스 사이드바에서 팀 디렉토리 표시 (team-directory의 사이드바 모드)
        '@enterprise/team-sidebar': {
          path: '/workspace',
          activeWhen: '/workspace',
          container: '#workspace-sidebar',
        },
      },
      shared: {
        react: {
          requiredVersion: '^19.0.0',
          singleton: true,
          eager: true,
        },
        'react-dom': {
          requiredVersion: '^19.0.0',
          singleton: true,
          eager: true,
        },
        '@enterprise/design-system': {
          requiredVersion: '^1.0.0',
          singleton: true,
        },
      },
      server: { port: 3200, storage: 'filesystem', storageOptions: { path: './data' } },
    },
    importMap,
    plugins: [
      guardPlugin({
        cssStrategy: 'attribute',
        observeDynamic: true,
        onGlobalViolation: (appName, prop) => {
          log(`전역 오염: ${appName} → ${prop}`);
        },
      }),
      sandboxPlugin({
        exclude: ['@enterprise/auth'], // auth는 글로벌 접근 필요
      }),
      keepAlivePlugin({
        apps: ['@enterprise/team-directory', '@enterprise/dashboard'],
        maxCached: 2,
      }),
      domIsolationPlugin({
        exclude: ['@enterprise/auth'],
        globalSelectors: ['#esmap-devtools', '#app-auth', '#app-nav', '#app-dashboard', '#app-team', '#app-workspace'],
      }),
      smartPrefetch.plugin,
      comm.plugin,
      audit.plugin,
    ],
  });

  // ─── DevTools 패널 생성 (인페이지 위젯) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DevTools는 넓은 타입을 받으므로 any 캐스트 허용
  const panel = createDevtoolsPanel({
    registry: esmap.registry,
    eventBus: comm.resources.eventBus as any,
    globalState: comm.resources.globalState,
    router: esmap.router,
    perf: esmap.perf as any,
    prefetch: smartPrefetch.controller,
    sharedModules: esmap.sharedModules as any,
    importMap,
  });
  devtoolsRef.panel = panel;

  // ─── Chrome DevTools Extension Bridge ───
  // Extension이 없어도 postMessage는 무해하게 무시된다.
  createDevtoolsBridge({
    registry: esmap.registry,
    eventBus: comm.resources.eventBus as any,
    globalState: comm.resources.globalState,
    router: esmap.router,
    perf: esmap.perf as any,
    prefetch: smartPrefetch.controller,
    sharedModules: esmap.sharedModules as any,
    importMap,
  });

  // ─── 라이프사이클 훅 ───
  esmap.hooks.beforeEach('mount', (ctx) => {
    log(`마운트: ${ctx.appName}`);
    comm.resources.globalState.setState({ currentApp: ctx.appName });
  });

  esmap.hooks.afterEach('unmount', (ctx) => {
    log(`정리: ${ctx.appName}`);
  });

  esmap.registry.onStatusChange((event) => {
    log(`${event.appName}: ${event.from} → ${event.to}`);
  });

  // ─── 라우트 가드: 인증 전 보호 ───
  esmap.router.beforeRouteChange((_from, to) => {
    if (!gate.isAllReady() && to.pathname !== '/' && to.pathname !== '/dashboard') {
      log(`라우트 차단: 인증 필요 (${to.pathname}) → / 으로 리다이렉트`);
      history.replaceState(null, '', '/');
      return false;
    }
    return true;
  });

  esmap.router.afterRouteChange((_from, to) => {
    log(`라우트: ${to.pathname}`);
    updateNavHighlight(to.pathname);
    toggleWorkspaceContainer(to.pathname);
  });

  log(`${esmap.registry.getApps().length}개 앱 등록`);

  // ─── Host 자체 네비게이션 바 렌더링 ───
  renderNav();

  // ─── 시작 ───
  await esmap.start();
  log('라우터 시작');

  // 초기 라우트에 맞게 워크스페이스 컨테이너 표시
  toggleWorkspaceContainer(window.location.pathname);

  // ─── SSE: import map 실시간 업데이트 ───
  connectSSE();

  // 성능 요약
  setTimeout(() => {
    const summary = esmap.perf.summarize();
    for (const [appName, data] of summary) {
      log(`${appName}: ${data.total.toFixed(0)}ms`);
    }
  }, 1000);
}

/** Host 자체 네비게이션 바를 DOM에 렌더링한다 (MFE가 아닌 host 직접 관리) */
function renderNav(): void {
  const nav = document.getElementById('app-nav');
  if (!nav) return;

  const links = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/team', label: 'Team' },
    { path: '/workspace', label: 'Workspace' },
    { path: '/activity', label: 'Activity' },
    { path: '/settings', label: 'Settings (Legacy)' },
  ];

  nav.innerHTML = `
    <div style="display:flex;align-items:center;gap:24px;width:100%">
      <strong style="font-size:16px;margin-right:auto">Enterprise Platform</strong>
      ${links
        .map(
          (l) =>
            `<a href="${l.path}" data-link style="color:#94a3b8;text-decoration:none;font-size:14px;padding:4px 0;border-bottom:2px solid transparent;transition:all 0.15s" data-path="${l.path}">${l.label}</a>`,
        )
        .join('')}
    </div>
  `;

  nav.addEventListener('click', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const target = el.closest<HTMLAnchorElement>('[data-link]');
    if (!target) return;
    e.preventDefault();
    const href = target.getAttribute('href') ?? '/';
    history.pushState(null, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    toggleWorkspaceContainer(href);
    updateNavHighlight(href);
  });
}

/** 현재 경로에 맞는 네비게이션 링크를 하이라이트한다 */
function updateNavHighlight(pathname: string): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('#app-nav [data-path]');
  for (const link of links) {
    const isActive = link.dataset.path === pathname ||
      (pathname === '/' && link.dataset.path === '/dashboard');
    link.style.color = isActive ? '#ffffff' : '#94a3b8';
    link.style.borderBottomColor = isActive ? '#2563eb' : 'transparent';
  }
}

/** /workspace 라우트일 때 워크스페이스 컨테이너를 표시하고, 그 외에는 숨긴다 */
function toggleWorkspaceContainer(pathname: string): void {
  const workspace = document.getElementById('app-workspace');
  if (!workspace) return;
  workspace.style.display = pathname === '/workspace' ? 'grid' : 'none';
}

/** SSE로 import map 서버의 배포/롤백 이벤트를 실시간 수신한다 */
function connectSSE(): void {
  try {
    const eventSource = new EventSource('http://localhost:3200/events');

    eventSource.addEventListener('import-map-update', (event) => {
      const data = JSON.parse(event.data);
      log(`[SSE] 배포: ${data.service} → ${data.url}`);
    });

    eventSource.addEventListener('import-map-rollback', (event) => {
      const data = JSON.parse(event.data);
      log(`[SSE] 롤백: ${data.service} → ${data.rolledBackTo}`);
    });

    eventSource.onerror = () => {
      log('[SSE] 서버 연결 끊김 (재연결 시도 중)');
    };

    log('[SSE] import map 서버 연결');
  } catch {
    log('[SSE] 서버 미실행 (오프라인 모드)');
  }
}

boot().catch((error) => {
  log(`부팅 실패: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
});
