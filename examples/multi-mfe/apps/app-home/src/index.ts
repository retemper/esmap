/**
 * 홈 MFE — "/" 경로에서 활성화되는 메인 대시보드.
 * 샌드박스 격리 검증을 위해 sandbox proxy에 __HOME_APP_DATA__ 를 설정한다.
 */

declare global {
  interface Window {
    __ESMAP_SANDBOXES__?: Map<string, { proxy: Record<string, unknown> }>;
  }
}

/** 앱의 샌드박스 프록시를 가져온다. 없으면 window를 반환한다. */
function getSandboxProxy(): Record<string, unknown> {
  const sandbox = window.__ESMAP_SANDBOXES__?.get('app-home');
  return sandbox?.proxy ?? (window as unknown as Record<string, unknown>);
}

/** 앱 부트스트랩 — 초기화 단계 */
export function bootstrap(): Promise<void> {
  console.log('[app-home] bootstrap');
  return Promise.resolve();
}

/** 앱 마운트 — 전역 변수 설정 및 대시보드 렌더링 */
export function mount(container: HTMLElement): Promise<void> {
  console.log('[app-home] mount');

  // 샌드박스 프록시를 통해 전역 변수 설정 (실제 window 오염 방지)
  const proxy = getSandboxProxy();
  proxy['__HOME_APP_DATA__'] = 'home-active';
  console.log('[app-home] sandbox.__HOME_APP_DATA__ = "home-active"');

  // settings 앱의 전역 변수가 누출되는지 확인
  const settingsLeak = String(proxy['__SETTINGS_APP_DATA__'] ?? 'undefined (격리됨)');
  console.log(`[app-home] sandbox.__SETTINGS_APP_DATA__ = ${settingsLeak}`);

  container.innerHTML = `
    <div style="padding:32px;">
      <h1>Home Dashboard</h1>
      <p style="color:#666;">이 페이지는 <code>app-home</code> MFE가 렌더링합니다.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px;">
        <div style="background:#f0f7ff;padding:20px;border-radius:8px;">
          <h3>직원 수</h3>
          <p style="font-size:2em;font-weight:bold;color:#1a73e8;">142</p>
        </div>
        <div style="background:#f0fff0;padding:20px;border-radius:8px;">
          <h3>이번 달 급여</h3>
          <p style="font-size:2em;font-weight:bold;color:#0d904f;">₩ 1.2B</p>
        </div>
        <div style="background:#fff8f0;padding:20px;border-radius:8px;">
          <h3>출근율</h3>
          <p style="font-size:2em;font-weight:bold;color:#e67700;">96.4%</p>
        </div>
      </div>
      <div style="margin-top:24px;padding:16px;background:#f5f5f5;border-radius:8px;font-family:monospace;font-size:13px;">
        <h4 style="margin:0 0 8px;">Sandbox Isolation Check</h4>
        <div>sandbox.__HOME_APP_DATA__ = "home-active" (via proxy)</div>
        <div>sandbox.__SETTINGS_APP_DATA__ = "${settingsLeak}"</div>
      </div>
    </div>
  `;
  return Promise.resolve();
}

/** 앱 언마운트 — 전역 변수 정리 및 DOM 초기화 */
export function unmount(container: HTMLElement): Promise<void> {
  console.log('[app-home] unmount');
  const proxy = getSandboxProxy();
  delete proxy['__HOME_APP_DATA__'];
  container.innerHTML = '';
  return Promise.resolve();
}
