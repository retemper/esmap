/**
 * 설정 MFE — "/settings" 경로에서 활성화되는 설정 페이지.
 * 샌드박스 격리 검증을 위해 sandbox proxy에 __SETTINGS_APP_DATA__ 를 설정한다.
 */

declare global {
  interface Window {
    __ESMAP_SANDBOXES__?: Map<string, { proxy: Record<string, unknown> }>;
  }
}

/** 앱의 샌드박스 프록시를 가져온다. 없으면 window를 반환한다. */
function getSandboxProxy(): Record<string, unknown> {
  const sandbox = window.__ESMAP_SANDBOXES__?.get('app-settings');
  return sandbox?.proxy ?? (window as unknown as Record<string, unknown>);
}

/** 앱 부트스트랩 — 초기화 단계 */
export function bootstrap(): Promise<void> {
  console.log('[app-settings] bootstrap');
  return Promise.resolve();
}

/** 앱 마운트 — 전역 변수 설정 및 설정 UI 렌더링 */
export function mount(container: HTMLElement): Promise<void> {
  console.log('[app-settings] mount');

  // 샌드박스 프록시를 통해 전역 변수 설정 (실제 window 오염 방지)
  const proxy = getSandboxProxy();
  proxy['__SETTINGS_APP_DATA__'] = 'settings-active';
  console.log('[app-settings] sandbox.__SETTINGS_APP_DATA__ = "settings-active"');

  // home 앱의 전역 변수가 누출되는지 확인
  const homeLeak = String(proxy['__HOME_APP_DATA__'] ?? 'undefined (격리됨)');
  console.log(`[app-settings] sandbox.__HOME_APP_DATA__ = ${homeLeak}`);

  container.innerHTML = `
    <div style="padding:32px;">
      <h1>Settings</h1>
      <p style="color:#666;">이 페이지는 <code>app-settings</code> MFE가 렌더링합니다.</p>
      <div style="margin-top:24px;max-width:480px;">
        <div style="padding:16px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:12px;">
          <label style="display:flex;justify-content:space-between;align-items:center;">
            <span>다크 모드</span>
            <input type="checkbox" />
          </label>
        </div>
        <div style="padding:16px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:12px;">
          <label style="display:flex;justify-content:space-between;align-items:center;">
            <span>알림 활성화</span>
            <input type="checkbox" checked />
          </label>
        </div>
        <div style="padding:16px;border:1px solid #e0e0e0;border-radius:8px;">
          <label style="display:flex;justify-content:space-between;align-items:center;">
            <span>언어</span>
            <select>
              <option>한국어</option>
              <option>English</option>
              <option>日本語</option>
            </select>
          </label>
        </div>
      </div>
      <div style="margin-top:24px;padding:16px;background:#f5f5f5;border-radius:8px;font-family:monospace;font-size:13px;">
        <h4 style="margin:0 0 8px;">Sandbox Isolation Check</h4>
        <div>sandbox.__SETTINGS_APP_DATA__ = "settings-active" (via proxy)</div>
        <div>sandbox.__HOME_APP_DATA__ = "${homeLeak}"</div>
      </div>
    </div>
  `;
  return Promise.resolve();
}

/** 앱 언마운트 — 전역 변수 정리 및 DOM 초기화 */
export function unmount(container: HTMLElement): Promise<void> {
  console.log('[app-settings] unmount');
  const proxy = getSandboxProxy();
  delete proxy['__SETTINGS_APP_DATA__'];
  container.innerHTML = '';
  return Promise.resolve();
}
